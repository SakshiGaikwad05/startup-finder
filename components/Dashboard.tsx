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

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Daily Startup Finder</h1>
          <p className="text-sm text-gray-500">
            Today: {today} · {f.locations.length ? f.locations.join(" + ") : "Any location"}
          </p>
        </div>
        <button
          onClick={findToday}
          disabled={run?.running}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {run?.running ? "Finding startups…" : "Find Startups Today"}
        </button>
      </section>

      {run && (run.running || run.log.length > 0) && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-800">
            {run.running ? "Discovery running… (YC pages are fetched politely, ~1.5 s apart)" : "Last run finished"}
            <span className="ml-2 text-gray-500">
              {run.stats.startups} startups processed · {run.stats.created} new · {run.stats.updated} updated · {run.stats.newJobs} new jobs
              {run.stats.errors ? ` · ${run.stats.errors} errors` : ""}
            </span>
          </div>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-600">{run.log.slice(-12).join("\n")}</pre>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <b>Error:</b> {error}
        </div>
      )}

      {startups && startups.length > 0 && !run?.running && lastRunAt && new Date(lastRunAt).toDateString() !== new Date().toDateString() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No discovery run today yet. “New &amp; updated” is showing results from the last run on{" "}
          <b>{new Date(lastRunAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</b>. Click <b>Find Startups Today</b> for fresh results.
        </div>
      )}

      {startups && (
        <Summary
          list={viewList}
          label={
            f.view === "today"
              ? `New & updated in latest run${lastRunAt ? ` (${new Date(lastRunAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})` : ""}`
              : "All startups"
          }
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <Filters f={f} set={setFilters} />
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-600">
              Showing <b>{shown.length}</b> of {startups?.length ?? 0} startups
            </span>
            <label className="flex items-center gap-2 text-gray-600">
              Sort by
              <select value={f.sort} onChange={(e) => setFilters({ ...f, sort: e.target.value as FilterState["sort"] })} className="rounded border border-gray-300 bg-white px-2 py-1">
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
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              Nothing matches these filters.{" "}
              {f.view === "today" && (
                <button className="text-indigo-600 underline" onClick={() => setFilters({ ...f, view: "all" })}>
                  Show all startups
                </button>
              )}
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {shown.map((s) => (
              <StartupCard key={s.id} s={s} onChanged={load} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
