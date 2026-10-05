"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StartupView } from "@/lib/types";
import { applyFilters, DEFAULT_FILTERS, Filters, type FilterState } from "./Filters";
import { StartupCard } from "./StartupCard";
import { Summary } from "./Summary";

interface RunState {
  running: boolean;
  log: string[];
  finishedAt: string | null;
  stats: { startups: number; created: number; updated: number; newJobs: number; errors: number };
}

const FILTER_KEY = "dsf.filters.v1";

export function Dashboard() {
  const [startups, setStartups] = useState<StartupView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<FilterState>(DEFAULT_FILTERS);
  const [run, setRun] = useState<RunState | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/startups", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Failed to load");
    else {
      setError(null);
      setStartups(data.startups);
      setLastRunAt(data.lastRun?.started_at ?? null);
    }
  }, []);

  const watchRun = useCallback(() => {
    if (poll.current) return;
    poll.current = setInterval(async () => {
      const s: RunState = await (await fetch("/api/discover", { cache: "no-store" })).json();
      setRun(s);
      if (!s.running) {
        clearInterval(poll.current!);
        poll.current = null;
        load();
      }
    }, 2000);
  }, [load]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY);
      if (saved) setF({ ...DEFAULT_FILTERS, ...JSON.parse(saved) });
    } catch {}
    load();
    fetch("/api/discover", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: RunState) => {
        if (s.running) {
          setRun(s);
          watchRun();
        }
      })
      .catch(() => {});
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [load, watchRun]);

  function setFilters(next: FilterState) {
    setF(next);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next));
    } catch {}
  }

  async function findToday() {
    const res = await fetch("/api/discover", { method: "POST" });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      return;
    }
    setRun(data);
    watchRun();
  }

  const viewList = useMemo(() => (startups ?? []).filter((s) => f.view === "all" || s.is_fresh), [startups, f.view]);
  const shown = useMemo(() => applyFilters(startups ?? [], f), [startups, f]);
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const lastRunLabel = lastRunAt ? new Date(lastRunAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
  const freshCount = (startups ?? []).filter((s) => s.is_fresh).length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Startups hiring for you</h1>
            <p className="text-sm text-gray-500">
              {today} · Showing {f.locations.length ? f.locations.join(", ") : "all locations"}
            </p>
          </div>
          <button
            onClick={findToday}
            disabled={run?.running}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
          >
            {run?.running && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {run?.running ? "Finding startups… (~3 min)" : "🔎 Find Startups Today"}
          </button>
        </div>
        <ol className="mt-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
          <li className="rounded-lg bg-gray-50 px-3 py-2">
            <b className="text-gray-800">1. Find</b> — pulls hiring startups from Y Combinator, funding news, job boards and company careers pages.
          </li>
          <li className="rounded-lg bg-gray-50 px-3 py-2">
            <b className="text-gray-800">2. Match</b> — scores every job against your resume: role, skills, location, experience.
          </li>
          <li className="rounded-lg bg-gray-50 px-3 py-2">
            <b className="text-gray-800">3. Apply</b> — open the job, email the team, and track it under Applications.
          </li>
        </ol>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <b>Error:</b> {error}
        </div>
      )}

      {startups && startups.length > 0 && !run?.running && lastRunAt && new Date(lastRunAt).toDateString() !== new Date().toDateString() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You haven’t searched today yet — showing what was found on <b>{lastRunLabel}</b>. Click <b>Find Startups Today</b> for fresh results.
        </div>
      )}

      {startups && <Summary list={viewList} label={f.view === "today" ? `Found in the latest search${lastRunLabel ? ` (${lastRunLabel})` : ""}` : "All startups found so far"} />}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div>
          <Filters f={f} set={setFilters} />
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
              {(
                [
                  ["today", `New & updated (${freshCount})`],
                  ["all", `All startups (${startups?.length ?? 0})`],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setFilters({ ...f, view: v })}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${f.view === v ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
                  title={v === "today" ? "Startups that are new, or have new jobs / funding, in the latest search" : "Everything found so far"}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-gray-500">
              <b className="text-gray-800">{shown.length}</b> match your filters
            </span>
            <label className="flex items-center gap-2 text-gray-600">
              Sort
              <select value={f.sort} onChange={(e) => setFilters({ ...f, sort: e.target.value as FilterState["sort"] })} className="rounded-lg border border-gray-200 bg-white px-2 py-1">
                <option value="match">Best profile match</option>
                <option value="discovered">Newest discovery</option>
                <option value="funding">Newest funding</option>
                <option value="founded">Recently founded</option>
                <option value="relevant_jobs">Most relevant jobs</option>
              </select>
            </label>
          </div>
          {!startups && !error && <div className="text-sm text-gray-500">Loading…</div>}
          {startups && startups.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              No startups yet. Click <b>Find Startups Today</b> to run discovery.
            </div>
          )}
          {startups && startups.length > 0 && shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              No startups match these filters.
              <div className="mt-3 flex justify-center gap-2">
                {f.view === "today" && (
                  <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50" onClick={() => setFilters({ ...f, view: "all" })}>
                    Show all startups
                  </button>
                )}
                <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Reset filters
                </button>
              </div>
            </div>
          )}
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {shown.map((s) => (
              <StartupCard key={s.id} s={s} onChanged={load} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
