"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StartupView } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { activeFilterChips, applyFilters, DEFAULT_FILTERS, Filters, filtersForProfile, type FilterState } from "./Filters";
import { StartupCard } from "./StartupCard";
import { GettingStarted } from "./GettingStarted";
import { Summary, type SummaryPick } from "./Summary";
import { Icon, type IconName } from "./Icon";
import { api } from "./api";
import { Banner, btnPrimary, btnSecondary, CardSkeleton, EmptyState } from "./ui";

interface RunState {
  running: boolean;
  log: string[];
  finishedAt: string | null;
  stats: { startups: number; created: number; updated: number; newJobs: number; errors: number };
}

const FILTER_KEY = "dsf.filters.v1";

const SORTS: [FilterState["sort"], string][] = [
  ["match", "Best match for me"],
  ["relevant_jobs", "Most jobs that fit me"],
  ["discovered", "Newest found"],
  ["funding", "Most recently funded"],
  ["founded", "Youngest startups"],
];

const HOW_IT_WORKS: [IconName, string, string][] = [
  ["search", "We find startups", "From Y Combinator, funding news, job boards and company careers pages."],
  ["file", "We match them to you", "Every job is scored on role, skills, location and experience."],
  ["briefcase", "You apply and track", "Open the job, email the team, and keep track under Applications."],
];

function ago(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`;
}

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const [startups, setStartups] = useState<StartupView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<FilterState>(DEFAULT_FILTERS);
  const [defaults, setDefaults] = useState<FilterState>(DEFAULT_FILTERS);
  const [run, setRun] = useState<RunState | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [explorer, setExplorer] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // phones: filters open in a bottom sheet
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const filtersReady = useRef(false);

  const load = useCallback(async () => {
    const { ok, status, data, error } = await api("/api/startups");
    if (status === 401) {
      router.replace("/onboarding");
      return;
    }
    if (!ok) setError(error);
    else {
      setError(null);
      setStartups(data.startups);
      setLastRunAt(data.lastRun?.started_at ?? null);
      setName((data.profile?.name as string) || null);
      setExplorer(!!data.profile?.explorer);
      // First load: filters default to this user's preferences unless they've changed them before.
      if (!filtersReady.current) {
        filtersReady.current = true;
        const d = filtersForProfile(data.profile);
        setDefaults(d);
        let saved: Partial<FilterState> | null = null;
        try {
          const raw = localStorage.getItem(FILTER_KEY);
          if (raw) saved = JSON.parse(raw);
        } catch {}
        setF(saved ? { ...d, ...saved } : d);
      }
    }
  }, [router]);

  const watchRun = useCallback(() => {
    if (poll.current) return;
    poll.current = setInterval(async () => {
      const { ok, data: s } = await api<RunState>("/api/discover");
      if (!ok) return; // a missed poll is fine; try again on the next tick
      setRun(s);
      if (!s.running) {
        clearInterval(poll.current!);
        poll.current = null;
        load();
      }
    }, 2000);
  }, [load]);

  useEffect(() => {
    load();
    // Just finished onboarding: fetch startups for them right away (or use today's fresh results).
    if (params.get("welcome") === "1") {
      router.replace("/dashboard");
      findToday(true);
    }
    api<RunState>("/api/discover").then(({ ok, data: s }) => {
      if (ok && s.running) {
        setRun(s);
        watchRun();
      }
    });
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, watchRun]);

  // Bottom sheet: lock page scroll behind it and close on Escape.
  useEffect(() => {
    if (!showFilters) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowFilters(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [showFilters]);

  function setFilters(next: FilterState) {
    setF(next);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next));
    } catch {}
  }

  async function findToday(welcome = false) {
    setNotice(null);
    const { ok, data, error } = await api("/api/discover", { method: "POST" });
    if (!ok) {
      setError(error);
      return;
    }
    if (data.upToDate) {
      setNotice(
        welcome
          ? `Welcome! Here are startups matched to your profile, from a search ${ago(data.lastRunAt)} ago.`
          : `You're up to date. We last checked ${ago(data.lastRunAt)} ago, so try again later for new startups.`
      );
      return;
    }
    if (welcome) setNotice("Welcome! We're finding startups for you now.");
    setRun(data);
    watchRun();
  }

  const viewList = useMemo(() => (startups ?? []).filter((s) => f.view === "all" || s.is_fresh), [startups, f.view]);
  const shown = useMemo(() => applyFilters(startups ?? [], f), [startups, f]);
  const chips = activeFilterChips(f, setFilters);

  /** Summary tile clicked: show exactly the startups that tile counted (same view, other filters cleared). */
  function pickSummary(p: SummaryPick) {
    const base: FilterState = {
      ...DEFAULT_FILTERS,
      view: f.view,
      sort: f.sort,
      locations: [],
      hiringOnly: false,
      matchingOnly: false,
      relevance: [],
      emailOnly: false,
      levels: [],
      types: [],
    };
    const by: Record<SummaryPick, Partial<FilterState>> = {
      all: {},
      great: { relevance: ["strong"], sort: "match" },
      good: { relevance: ["potential"], sort: "match" },
      jobs: { hiringOnly: true, sort: "relevant_jobs" },
      ai: { types: ["AI"] },
      funded: { funding: ["funded_180"], sort: "funding" },
      new: { age: ["new"], sort: "founded" },
      email: { emailOnly: true },
    };
    setFilters({ ...base, ...by[p] });
    setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  /** Nothing matches: which single filter, if loosened, would bring startups back (and how many). */
  const loosen = useMemo(() => {
    if (!startups?.length || shown.length) return [];
    const options: [string, FilterState][] = [
      ["Show all startups, not just new & updated", { ...f, view: "all" }],
      ["Include startups with no open jobs found", { ...f, hiringOnly: false }],
      ["Any funding date", { ...f, funding: [] }],
      ["Any location", { ...f, locations: [] }],
      ["Any job role", { ...f, roles: [] }],
      ["Any experience level", { ...f, levels: [] }],
      ["Any startup type", { ...f, types: [] }],
      ["Any startup age", { ...f, age: [] }],
      ["Not only jobs that fit me", { ...f, matchingOnly: false }],
      ["Any match level", { ...f, relevance: [] }],
      ["Not only startups with an email", { ...f, emailOnly: false }],
      ["Clear the search", { ...f, search: "" }],
    ];
    return options
      .filter(([, next]) => JSON.stringify(next) !== JSON.stringify(f))
      .map(([label, next]) => ({ label, next, count: applyFilters(startups, next).length }))
      .filter((o) => o.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [startups, shown.length, f]);

  /** "Show my best match": all startups, best match first, then scroll to the top card. */
  function showBest() {
    setFilters({ ...f, view: "all", sort: "match", search: "" });
    setTimeout(() => {
      const card = document.querySelector("article");
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      // Smooth scrolling can be interrupted (re-render, background tab) — make sure we arrive.
      setTimeout(() => {
        const top = card.getBoundingClientRect().top;
        if (top > window.innerHeight * 0.5 || top < -50) card.scrollIntoView({ block: "start" });
      }, 700);
    }, 80);
  }

  const lastRunLabel = lastRunAt ? new Date(lastRunAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
  const freshCount = (startups ?? []).filter((s) => s.is_fresh).length;
  const stale = !!(startups?.length && lastRunAt && new Date(lastRunAt).toDateString() !== new Date().toDateString());
  const running = !!run?.running;
  const lastLog = run?.log?.[run.log.length - 1];

  // One status message at a time, most important first.
  let banner: React.ReactNode = null;
  if (error)
    banner = (
      <Banner
        tone="error"
        action={
          <button onClick={() => load()} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
            Try again
          </button>
        }
        onDismiss={() => setError(null)}
      >
        {error}
      </Banner>
    );
  else if (running && startups?.length)
    banner = (
      <Banner tone="progress">
        <b className="font-semibold">Looking for new startups.</b> This takes about 3 minutes. Keep browsing, new results appear here on their own.
        {lastLog && <span className="mt-0.5 block truncate text-xs text-gray-500">{lastLog}</span>}
      </Banner>
    );
  else if (notice) banner = <Banner onDismiss={() => setNotice(null)}>{notice}</Banner>;
  else if (stale)
    banner = (
      <Banner
        tone="warn"
        action={
          <button onClick={() => findToday()} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
            Check now
          </button>
        }
      >
        These results are from <b className="font-semibold">{lastRunLabel}</b>. Click <b className="font-semibold">Find Startups Today</b> for fresh ones.
      </Banner>
    );

  const filterPanel = <Filters f={f} set={setFilters} defaults={defaults} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {name && <p className="text-sm font-medium text-gray-500">Hi {name.split(" ")[0]},</p>}
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[28px]">Startups hiring for you</h1>
          <p className="mt-1 text-sm text-gray-600">
            {lastRunLabel ? `Last checked ${lastRunLabel}` : "Not checked yet"}
            {startups && startups.length > 0 && ` · ${startups.length} startups found so far`}
          </p>
        </div>
        <button onClick={() => findToday()} disabled={running} className={`${btnPrimary} w-full sm:w-auto`}>
          <Icon name={running ? "spinner" : "refresh"} className="h-4 w-4" />
          {running ? "Finding startups…" : "Find Startups Today"}
        </button>
      </header>

      {banner}

      {explorer && (
        <Banner
          action={
            <button onClick={() => router.push("/onboarding")} className="rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-700">
              Add my skills
            </button>
          }
        >
          <b className="font-semibold">You&apos;re exploring recently funded startups.</b> Add your skills and we&apos;ll show the jobs that fit you.
        </Banner>
      )}

      {startups && startups.length > 0 && <GettingStarted startups={startups} onShowBest={showBest} />}

      {startups && startups.length > 0 && (
        <Summary
          list={viewList}
          label={f.view === "today" ? `Found in the latest search${lastRunLabel ? ` (${lastRunLabel})` : ""}` : "All startups found so far"}
          onPick={pickSummary}
        />
      )}

      {!startups && !error && <CardSkeleton />}

      {startups && startups.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <h3 className="font-display text-xl font-semibold text-gray-900">{running ? "Finding startups for you…" : "Let's find your first startups"}</h3>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-gray-600">
            {running
              ? "This takes about 3 minutes. Results show up here on their own, so you can leave this page open."
              : "One click checks the latest startups and matches their jobs to your profile."}
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map(([icon, title, body], i) => (
              <li key={title} className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-gray-400">Step {i + 1}</span>
                </div>
                <div className="mt-3 text-sm font-semibold text-gray-900">{title}</div>
                <p className="mt-1 text-[13px] leading-snug text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
          {!running && (
            <button onClick={() => findToday()} className={`${btnPrimary} mt-6`}>
              <Icon name="search" className="h-4 w-4" />
              Find startups now
            </button>
          )}
        </div>
      )}

      {/* minmax(0,1fr): without it the single phone column grows to its widest child and the page overflows. */}
      {startups && startups.length > 0 && (
        <div id="results" className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[264px_minmax(0,1fr)]">
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="scroll-thin sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pr-2">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Filters</h2>
              {filterPanel}
            </div>
          </aside>

          <section aria-label="Startups" className="min-w-0 space-y-4">
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search startups and job titles</span>
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={f.search}
                  onChange={(e) => setFilters({ ...f, search: e.target.value })}
                  placeholder="Search startups or jobs"
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
                />
              </label>
              <button
                onClick={() => setShowFilters(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 lg:hidden"
                aria-haspopup="dialog"
              >
                <Icon name="sliders" className="h-4 w-4" />
                Filters
                {chips.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold tabular-nums text-white">{chips.length}</span>}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label="Which startups" className="inline-flex rounded-xl bg-gray-200/70 p-1">
                {(
                  [
                    ["today", "New & updated", freshCount, "Startups that are new, or have new jobs or funding, in the latest check"],
                    ["all", "All", startups?.length ?? 0, "Everything found so far"],
                  ] as const
                ).map(([v, label, n, hint]) => (
                  <button
                    key={v}
                    onClick={() => setFilters({ ...f, view: v })}
                    aria-pressed={f.view === v}
                    title={hint}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      f.view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {label} <span className="font-medium tabular-nums text-gray-500">{n}</span>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-gray-600">
                Sort by
                <span className="relative">
                  <select
                    value={f.sort}
                    onChange={(e) => setFilters({ ...f, sort: e.target.value as FilterState["sort"] })}
                    className="appearance-none rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-[13px] font-medium text-gray-900 focus:border-brand-500 focus:outline-none"
                  >
                    {SORTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                </span>
              </label>
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    onClick={c.remove}
                    className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-2.5 pr-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:ring-gray-400"
                    aria-label={`Remove filter: ${c.label}`}
                  >
                    {c.label}
                    <Icon name="x" className="h-3 w-3 text-gray-400" />
                  </button>
                ))}
                <button
                  onClick={() => setFilters({ ...DEFAULT_FILTERS, locations: [], hiringOnly: false, view: f.view, sort: f.sort })}
                  className="px-1.5 py-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {startups && startups.length > 0 && (
              <p className="text-sm text-gray-600" aria-live="polite">
                Showing <b className="font-semibold text-gray-900">{shown.length}</b> startup{shown.length === 1 ? "" : "s"}
              </p>
            )}

            {startups && startups.length > 0 && shown.length === 0 && (
              <EmptyState
                icon="search"
                title="No startups match all of these filters together"
                actions={
                  <div className="flex w-full flex-col items-center gap-2">
                    {loosen.map((o) => (
                      <button
                        key={o.label}
                        className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100"
                        onClick={() => setFilters(o.next)}
                      >
                        {o.label}
                        <span className="rounded-full bg-white px-2 text-xs tabular-nums text-brand-700">{o.count}</span>
                      </button>
                    ))}
                    <button className={btnSecondary} onClick={() => setFilters(defaults)}>
                      Reset filters
                    </button>
                  </div>
                }
              >
                {loosen.length > 0 ? "Try loosening one of them:" : "Try removing a filter above."}
              </EmptyState>
            )}

            <div className="space-y-4">
              {shown.map((s) => (
                <StartupCard key={s.id} s={s} onChanged={load} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Phone filters: bottom sheet over the results, with a clear "show results" button. */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="filters-title">
          <button className="absolute inset-0 bg-black/40" aria-label="Close filters" onClick={() => setShowFilters(false)} />
          <div className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
              <h2 id="filters-title" className="text-lg font-semibold text-gray-900">
                Filters
              </h2>
              <button onClick={() => setShowFilters(false)} className="-mr-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close filters">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto overscroll-contain px-5 py-4">{filterPanel}</div>
            <div className="border-t border-gray-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button onClick={() => setShowFilters(false)} className={`${btnPrimary} w-full`}>
                Show {shown.length} startup{shown.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
