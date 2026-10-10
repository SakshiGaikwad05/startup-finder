"use client";
import type { StartupView } from "@/lib/types";
import { LOCATION_OPTIONS } from "@/lib/types";
import { ROLE_CATEGORIES } from "@/lib/jobs/roles";
import { STARTUP_TYPE_OPTIONS } from "@/lib/resume/parse";
import type { CandidateProfile } from "@/lib/types";

/** Default filters for a user: their locations and preferred startup types. */
export function filtersForProfile(p: CandidateProfile | null | undefined): FilterState {
  if (!p) return DEFAULT_FILTERS;
  const locs = (p.preferred_locations ?? []).filter((l) => (LOCATION_OPTIONS as readonly string[]).includes(l));
  // Someone who wants "Remote - India" should also see remote jobs whose region isn't stated.
  if (locs.includes("Remote - India") && !locs.includes("Remote")) locs.push("Remote");
  // Start on "All startups" (best matches first) so a new user never lands on an empty view.
  return { ...DEFAULT_FILTERS, view: "all", locations: locs.length ? locs : DEFAULT_FILTERS.locations, types: p.preferred_startup_types ?? [] };
}

export interface FilterState {
  view: "today" | "all";
  locations: string[];
  ai: { ai: boolean; nonAi: boolean; unknown: boolean };
  funding: string[]; // funded_30 | funded_90 | funded_180
  age: string[]; // new | early | growing | established
  roles: string[]; // job-role categories; empty = all roles
  types?: string[]; // startup types ("AI", "HealthTech", …); empty = all
  hiringOnly: boolean;
  matchingOnly: boolean;
  emailOnly?: boolean;
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
    const types = f.types ?? [];
    if (types.length && !((types.includes("AI") && (s.is_ai === true || s.industry === "AI Startup")) || (s.industry && types.includes(s.industry)))) return false;
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
    if (f.emailOnly && s.emails.length === 0) return false;
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

/** Toggle pill — easier to scan than a column of checkboxes. */
function Pill({ label, on, onClick, title }: { label: string; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        on ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
      }`}
    >
      {label}
    </button>
  );
}

function Switch({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-indigo-600" />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
      </span>
    </label>
  );
}

function Group({ title, children, hint, defaultOpen = true, active = 0 }: { title: string; children: React.ReactNode; hint?: string; defaultOpen?: boolean; active?: number }) {
  return (
    <details open={defaultOpen} className="group border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>
          {title}
          {active > 0 && <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 text-[10px] text-indigo-700">{active}</span>}
        </span>
        <span className="text-gray-300 transition group-open:rotate-180">▾</span>
      </summary>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
      <div className="mt-2">{children}</div>
    </details>
  );
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Filters({ f, set, defaults = DEFAULT_FILTERS }: { f: FilterState; set: (f: FilterState) => void; defaults?: FilterState }) {
  const roles = f.roles ?? [];
  const aiActive = [f.ai.ai, f.ai.nonAi, f.ai.unknown].filter((x) => !x).length;
  return (
    <aside className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 text-sm lg:sticky lg:top-4">
      <input
        value={f.search}
        onChange={(e) => set({ ...f, search: e.target.value })}
        placeholder="🔍 Search startup or job title"
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
      />

      <Group title="Job role" hint={roles.length ? "Cards show only jobs in these roles" : "Pick roles to focus on, or leave empty for all"} active={roles.length}>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_CATEGORIES.map((r) => (
            <Pill key={r} label={r} on={roles.includes(r)} onClick={() => set({ ...f, roles: toggle(roles, r) })} />
          ))}
        </div>
      </Group>

      <Group title="Location" active={f.locations.length}>
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_OPTIONS.map((l) => (
            <Pill
              key={l}
              label={l}
              on={f.locations.includes(l)}
              onClick={() => set({ ...f, locations: toggle(f.locations, l) })}
              title={l === "Remote" ? "Remote jobs not restricted to another country" : l === "Remote - India" ? "Remote jobs explicitly open to India" : undefined}
            />
          ))}
          <Pill label="Anywhere" on={f.locations.length === 0} onClick={() => set({ ...f, locations: [] })} />
        </div>
      </Group>

      <Group title="Show only" active={[f.hiringOnly, f.matchingOnly, f.emailOnly].filter(Boolean).length}>
        <div className="space-y-2">
          <Switch label="Hiring now" hint="Has at least one open job" on={f.hiringOnly} onChange={(v) => set({ ...f, hiringOnly: v })} />
          <Switch label="Has a job that fits me" hint="Great or good match" on={f.matchingOnly} onChange={(v) => set({ ...f, matchingOnly: v })} />
          <Switch label="Has a contact email" hint="Published on their website" on={!!f.emailOnly} onChange={(v) => set({ ...f, emailOnly: v })} />
        </div>
      </Group>

      <Group title="Funding" active={f.funding.length} defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["funded_30", "Last 30 days"],
            ["funded_90", "Last 3 months"],
            ["funded_180", "Last 6 months"],
          ].map(([k, l]) => (
            <Pill key={k} label={l} on={f.funding.includes(k)} onClick={() => set({ ...f, funding: toggle(f.funding, k) })} />
          ))}
        </div>
      </Group>

      <Group title="Startup type" active={(f.types ?? []).length + aiActive} hint={(f.types ?? []).length ? undefined : "Any type"}>
        <div className="flex flex-wrap gap-1.5">
          {STARTUP_TYPE_OPTIONS.map((t) => (
            <Pill key={t} label={t} on={(f.types ?? []).includes(t)} onClick={() => set({ ...f, types: toggle(f.types ?? [], t) })} />
          ))}
          <Pill label="Any" on={!(f.types ?? []).length} onClick={() => set({ ...f, types: [] })} />
        </div>
      </Group>

      <Group title="Startup age" active={f.age.length} defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["new", "New (2024+)"],
            ["early", "Early stage"],
            ["growing", "Growing"],
            ["established", "Established"],
          ].map(([k, l]) => (
            <Pill key={k} label={l} on={f.age.includes(k)} onClick={() => set({ ...f, age: toggle(f.age, k) })} />
          ))}
        </div>
      </Group>

      <button className="w-full rounded-lg border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50" onClick={() => set(defaults)}>
        Reset all filters
      </button>
    </aside>
  );
}
