"use client";
import type { StartupView } from "@/lib/types";
import { LOCATION_OPTIONS } from "@/lib/types";
import { ROLE_CATEGORIES } from "@/lib/jobs/roles";

export interface FilterState {
  view: "today" | "all";
  locations: string[];
  ai: { ai: boolean; nonAi: boolean; unknown: boolean };
  funding: string[]; // funded_30 | funded_90 | funded_180
  age: string[]; // new | early | growing | established
  roles: string[]; // job-role categories; empty = all roles
  hiringOnly: boolean;
  matchingOnly: boolean;
  search: string;
  sort: "match" | "discovered" | "funding" | "founded" | "relevant_jobs";
}

export const DEFAULT_FILTERS: FilterState = {
  view: "today",
  locations: ["Pune", "Remote", "Remote - India"],
  ai: { ai: true, nonAi: true, unknown: true },
  funding: [],
  age: [],
  roles: [],
  hiringOnly: true,
  matchingOnly: false,
  search: "",
  sort: "match",
};

const FUNDING_RANK: Record<string, number> = { funded_30: 1, funded_90: 2, funded_180: 3 };

/** With a role filter, each startup keeps only jobs in those roles (counts and best match follow). */
function restrictToRoles(s: StartupView, roles: string[]): StartupView {
  if (!roles.length) return s;
  const jobs = s.jobs.filter((j) => j.role_categories.some((c) => roles.includes(c)));
  const relevant = jobs.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential");
  return {
    ...s,
    jobs,
    relevant_jobs: relevant.length,
    best_match: relevant.reduce((m, j) => Math.max(m, j.match.match_score), 0),
    relevance: relevant.some((j) => j.match.relevance === "strong") ? "strong" : relevant.length ? "potential" : "low",
  };
}

export function applyFilters(list: StartupView[], f: FilterState): StartupView[] {
  const roles = f.roles ?? [];
  const out = list.map((s) => restrictToRoles(s, roles)).filter((s) => {
    if (roles.length && s.jobs.length === 0) return false;
    if (f.view === "today" && !s.is_fresh) return false;
    if (f.locations.length && !s.location_tags.some((t) => f.locations.includes(t))) return false;
    if (s.is_ai === true && !f.ai.ai) return false;
    if (s.is_ai === false && !f.ai.nonAi) return false;
    if (s.is_ai === null && !f.ai.unknown) return false;
    if (f.funding.length) {
      // "Funded <90 days" also includes <30 days, etc.
      const max = Math.max(...f.funding.map((x) => FUNDING_RANK[x]));
      const r = FUNDING_RANK[s.funding_status];
      if (!r || r > max) return false;
    }
    if (f.age.length && !f.age.includes(s.age_bucket)) return false;
    if (f.hiringOnly && s.jobs.length === 0) return false;
    if (f.matchingOnly && s.relevant_jobs === 0) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${s.name} ${s.description ?? ""} ${s.industry ?? ""} ${s.jobs.map((j) => j.job_title).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const by: Record<FilterState["sort"], (a: StartupView, b: StartupView) => number> = {
    match: (a, b) => b.best_match - a.best_match || b.relevant_jobs - a.relevant_jobs,
    discovered: (a, b) => b.first_discovered_at.localeCompare(a.first_discovered_at),
    funding: (a, b) => (b.last_funding_date ?? "").localeCompare(a.last_funding_date ?? ""),
    founded: (a, b) => (b.founded_year ?? 0) - (a.founded_year ?? 0),
    relevant_jobs: (a, b) => b.relevant_jobs - a.relevant_jobs || b.best_match - a.best_match,
  };
  return out.sort(by[f.sort]);
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-600" />
      {label}
    </label>
  );
}

function toggle(list: string[], v: string, on: boolean) {
  return on ? [...new Set([...list, v])] : list.filter((x) => x !== v);
}

export function Filters({ f, set }: { f: FilterState; set: (f: FilterState) => void }) {
  const group = "space-y-1.5";
  const title = "mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400";
  return (
    <aside className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <div>
        <div className={title}>Show</div>
        <div className="flex rounded-md border border-gray-200 p-0.5 text-xs">
          {(["today", "all"] as const).map((v) => (
            <button key={v} onClick={() => set({ ...f, view: v })} className={`flex-1 rounded px-2 py-1 ${f.view === v ? "bg-gray-900 text-white" : "text-gray-600"}`}>
              {v === "today" ? "New & updated (latest run)" : "All startups"}
            </button>
          ))}
        </div>
      </div>
      <input
        value={f.search}
        onChange={(e) => set({ ...f, search: e.target.value })}
        placeholder="Search name, job, industry…"
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <div className={group}>
        <div className={title}>Job roles</div>
        {ROLE_CATEGORIES.map((r) => (
          <Check key={r} label={r} checked={(f.roles ?? []).includes(r)} onChange={(v) => set({ ...f, roles: toggle(f.roles ?? [], r, v) })} />
        ))}
        <div className="text-xs text-gray-400">{(f.roles ?? []).length ? "Cards show only these roles" : "None ticked = all roles"}</div>
      </div>
      <div className={group}>
        <div className={title}>Location</div>
        {LOCATION_OPTIONS.map((l) => (
          <Check key={l} label={l} checked={f.locations.includes(l)} onChange={(v) => set({ ...f, locations: toggle(f.locations, l, v) })} />
        ))}
        <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => set({ ...f, locations: [] })}>
          Any location
        </button>
      </div>
      <div className={group}>
        <div className={title}>Startup type</div>
        <Check label="AI" checked={f.ai.ai} onChange={(v) => set({ ...f, ai: { ...f.ai, ai: v } })} />
        <Check label="Non-AI" checked={f.ai.nonAi} onChange={(v) => set({ ...f, ai: { ...f.ai, nonAi: v } })} />
        <Check label="Unknown" checked={f.ai.unknown} onChange={(v) => set({ ...f, ai: { ...f.ai, unknown: v } })} />
      </div>
      <div className={group}>
        <div className={title}>Funding</div>
        {[
          ["funded_30", "Funded <30 days"],
          ["funded_90", "Funded <90 days"],
          ["funded_180", "Funded <180 days"],
        ].map(([k, l]) => (
          <Check key={k} label={l} checked={f.funding.includes(k)} onChange={(v) => set({ ...f, funding: toggle(f.funding, k, v) })} />
        ))}
      </div>
      <div className={group}>
        <div className={title}>Startup age</div>
        {[
          ["new", "New"],
          ["early", "Early stage"],
          ["growing", "Growing"],
          ["established", "Established"],
        ].map(([k, l]) => (
          <Check key={k} label={l} checked={f.age.includes(k)} onChange={(v) => set({ ...f, age: toggle(f.age, k, v) })} />
        ))}
      </div>
      <div className={group}>
        <div className={title}>Jobs</div>
        <Check label="Currently hiring" checked={f.hiringOnly} onChange={(v) => set({ ...f, hiringOnly: v })} />
        <Check label="Has jobs matching my profile" checked={f.matchingOnly} onChange={(v) => set({ ...f, matchingOnly: v })} />
      </div>
      <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => set(DEFAULT_FILTERS)}>
        Reset filters
      </button>
    </aside>
  );
}
