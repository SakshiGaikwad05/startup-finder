"use client";
import type { StartupView } from "@/lib/types";
import { LOCATION_OPTIONS } from "@/lib/types";
import { ROLE_CATEGORIES } from "@/lib/jobs/roles";
import { STARTUP_TYPE_OPTIONS } from "@/lib/resume/parse";
import type { CandidateProfile } from "@/lib/types";
import { Icon } from "./Icon";

/** Default filters for a user: their locations and preferred startup types. */
export function filtersForProfile(p: CandidateProfile | null | undefined): FilterState {
  if (!p) return DEFAULT_FILTERS;
  // Skipped onboarding: recently funded startups, anywhere, newest funding first.
  if (p.explorer) return { ...DEFAULT_FILTERS, view: "all", locations: [], funding: ["funded_180"], hiringOnly: false, sort: "funding" };
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
  levels?: string[]; // experience a job asks for: fresher | junior | experienced | unknown; empty = any
  types?: string[]; // startup types ("AI", "HealthTech", …); empty = all
  hiringOnly: boolean;
  matchingOnly: boolean;
  relevance?: string[]; // best match level: strong (great) | potential (good); empty = any
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

export const EXPERIENCE_LEVELS = [
  ["fresher", "Fresher (0–1 yr)", "Internships, entry-level, or 0–1 years asked"],
  ["junior", "2–3 yrs", "Asks for 2–3 years of experience"],
  ["experienced", "4+ yrs / senior", "Senior titles or 4+ years asked"],
  ["unknown", "Not stated", "The job doesn't say how much experience it needs"],
] as const;

/** With a role or experience filter, each startup keeps only matching jobs (counts and best match follow). */
function restrictJobs(s: StartupView, roles: string[], levels: string[]): StartupView {
  if (!roles.length && !levels.length) return s;
  const jobs = s.jobs.filter(
    (j) => (!roles.length || j.role_categories.some((c) => roles.includes(c))) && (!levels.length || levels.includes(j.experience_level))
  );
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
  const levels = f.levels ?? [];
  const out = list.map((s) => restrictJobs(s, roles, levels)).filter((s) => {
    if ((roles.length || levels.length) && s.jobs.length === 0) return false;
    if (f.view === "today" && !s.is_fresh) return false;
    if (f.locations.length && !s.location_tags.includes("Unknown") && !s.location_tags.some((t) => f.locations.includes(t))) return false;
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
    if (f.relevance?.length && !f.relevance.includes(s.relevance)) return false;
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

const FUNDING_OPTIONS = [
  ["funded_30", "Last 30 days"],
  ["funded_90", "Last 3 months"],
  ["funded_180", "Last 6 months"],
] as const;

const AGE_OPTIONS = [
  ["new", "New (2024+)"],
  ["early", "Early stage"],
  ["growing", "Growing"],
  ["established", "Established"],
] as const;

/** Toggle pill — easier to scan than a column of checkboxes. */
function Pill({ label, on, onClick, title }: { label: string; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        on ? "border-brand-600 bg-brand-600 font-medium text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
      }`}
    >
      {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {label}
    </button>
  );
}

function Switch({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span className="text-sm text-gray-800">
        {label}
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

function Group({ title, children, hint, defaultOpen = true, active = 0 }: { title: string; children: React.ReactNode; hint?: string; defaultOpen?: boolean; active?: number }) {
  return (
    // A group with an active filter is always shown open, so you can see what's filtering the list.
    <details open={defaultOpen || active > 0} className="group border-t border-gray-200 py-4 first:border-t-0 first:pt-0">
      <summary className="flex list-none items-center justify-between gap-2 rounded-md text-sm font-semibold text-gray-900">
        <span className="flex items-center gap-2">
          {title}
          {active > 0 && <span className="rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold tabular-nums text-brand-700">{active}</span>}
        </span>
        <Icon name="chevron-down" className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </details>
  );
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** The filters currently narrowing the list, each with a one-click remove. Shown above the results. */
export function activeFilterChips(f: FilterState, set: (f: FilterState) => void): { key: string; label: string; remove: () => void }[] {
  const chips: { key: string; label: string; remove: () => void }[] = [];
  for (const r of f.roles ?? []) chips.push({ key: `r:${r}`, label: r, remove: () => set({ ...f, roles: (f.roles ?? []).filter((x) => x !== r) }) });
  for (const l of f.levels ?? []) {
    const label = EXPERIENCE_LEVELS.find(([k]) => k === l)?.[1] ?? l;
    chips.push({ key: `e:${l}`, label, remove: () => set({ ...f, levels: (f.levels ?? []).filter((x) => x !== l) }) });
  }
  for (const l of f.locations) chips.push({ key: `l:${l}`, label: l, remove: () => set({ ...f, locations: f.locations.filter((x) => x !== l) }) });
  for (const t of f.types ?? []) chips.push({ key: `t:${t}`, label: t, remove: () => set({ ...f, types: (f.types ?? []).filter((x) => x !== t) }) });
  for (const k of f.funding) {
    const label = FUNDING_OPTIONS.find(([x]) => x === k)?.[1] ?? k;
    chips.push({ key: `f:${k}`, label: `Funded: ${label.toLowerCase()}`, remove: () => set({ ...f, funding: f.funding.filter((x) => x !== k) }) });
  }
  for (const a of f.age) chips.push({ key: `a:${a}`, label: AGE_OPTIONS.find(([x]) => x === a)?.[1] ?? a, remove: () => set({ ...f, age: f.age.filter((x) => x !== a) }) });
  for (const r of f.relevance ?? [])
    chips.push({ key: `m:${r}`, label: r === "strong" ? "Great matches" : "Good matches", remove: () => set({ ...f, relevance: (f.relevance ?? []).filter((x) => x !== r) }) });
  if (f.hiringOnly) chips.push({ key: "hiring", label: "Hiring now", remove: () => set({ ...f, hiringOnly: false }) });
  if (f.matchingOnly) chips.push({ key: "fits", label: "Has a job that fits me", remove: () => set({ ...f, matchingOnly: false }) });
  if (f.emailOnly) chips.push({ key: "email", label: "Has an email", remove: () => set({ ...f, emailOnly: false }) });
  if (f.search) chips.push({ key: "q", label: `“${f.search}”`, remove: () => set({ ...f, search: "" }) });
  return chips;
}

export function Filters({ f, set, defaults = DEFAULT_FILTERS }: { f: FilterState; set: (f: FilterState) => void; defaults?: FilterState }) {
  const roles = f.roles ?? [];
  const levels = f.levels ?? [];
  const types = f.types ?? [];
  return (
    <div className="text-sm">
      <Group
        title="Experience needed"
        hint={levels.length ? "Only jobs at these levels are shown" : "Pick Fresher to see entry-level jobs only"}
        active={levels.length}
      >
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map(([k, l, hint]) => (
            <Pill key={k} label={l} title={hint} on={levels.includes(k)} onClick={() => set({ ...f, levels: toggle(levels, k) })} />
          ))}
        </div>
      </Group>

      <Group title="Job role" hint={roles.length ? "Only jobs in these roles are shown" : "Leave empty to see every role"} active={roles.length}>
        <div className="flex flex-wrap gap-2">
          {ROLE_CATEGORIES.map((r) => (
            <Pill key={r} label={r} on={roles.includes(r)} onClick={() => set({ ...f, roles: toggle(roles, r) })} />
          ))}
        </div>
      </Group>

      <Group title="Recently funded" active={f.funding.length} hint={f.funding.length ? "Startups that raised money in this period" : "Any funding date"}>
        <div className="flex flex-wrap gap-2">
          {FUNDING_OPTIONS.map(([k, l]) => (
            // One period at a time ("3 months" already includes "30 days").
            // Funding spans months, so picking a period looks at all startups, not just today's changes.
            // News-found startups usually have no jobs listed yet, so "Hiring now" is turned off too.
            <Pill
              key={k}
              label={l}
              on={f.funding.includes(k)}
              onClick={() => set(f.funding.includes(k) ? { ...f, funding: [] } : { ...f, funding: [k], view: "all", hiringOnly: false })}
            />
          ))}
          <Pill label="Any time" on={!f.funding.length} onClick={() => set({ ...f, funding: [] })} />
        </div>
      </Group>

      <Group title="Location" active={f.locations.length}>
        <div className="flex flex-wrap gap-2">
          <Pill label="Anywhere" on={f.locations.length === 0} onClick={() => set({ ...f, locations: [] })} />
          {LOCATION_OPTIONS.map((l) => (
            <Pill
              key={l}
              label={l}
              on={f.locations.includes(l)}
              onClick={() => set({ ...f, locations: toggle(f.locations, l) })}
              title={l === "Remote" ? "Remote jobs not restricted to another country" : l === "Remote - India" ? "Remote jobs explicitly open to India" : undefined}
            />
          ))}
        </div>
      </Group>

      <Group title="Show only" active={[f.hiringOnly, f.matchingOnly, f.emailOnly].filter(Boolean).length + (f.relevance ?? []).length}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["strong", "Great matches"],
              ["potential", "Good matches"],
            ].map(([k, l]) => (
              <Pill key={k} label={l} on={(f.relevance ?? []).includes(k)} onClick={() => set({ ...f, relevance: toggle(f.relevance ?? [], k) })} />
            ))}
          </div>
          <Switch label="Hiring now" hint="Has at least one open job" on={f.hiringOnly} onChange={(v) => set({ ...f, hiringOnly: v })} />
          <Switch label="Has a job that fits me" hint="A great or good match" on={f.matchingOnly} onChange={(v) => set({ ...f, matchingOnly: v })} />
          <Switch label="Has a contact email" hint="Published on their website" on={!!f.emailOnly} onChange={(v) => set({ ...f, emailOnly: v })} />
        </div>
      </Group>

      <Group title="Kind of startup" active={types.length} defaultOpen={types.length > 0}>
        <div className="flex flex-wrap gap-2">
          <Pill label="Any" on={!types.length} onClick={() => set({ ...f, types: [] })} />
          {STARTUP_TYPE_OPTIONS.map((t) => (
            <Pill key={t} label={t} on={types.includes(t)} onClick={() => set({ ...f, types: toggle(types, t) })} />
          ))}
        </div>
      </Group>

      <Group title="Startup age" active={f.age.length} defaultOpen={f.age.length > 0}>
        <div className="flex flex-wrap gap-2">
          {AGE_OPTIONS.map(([k, l]) => (
            <Pill key={k} label={l} on={f.age.includes(k)} onClick={() => set({ ...f, age: toggle(f.age, k) })} />
          ))}
        </div>
      </Group>

      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        onClick={() => set({ ...defaults, view: f.view, sort: f.sort })}
      >
        <Icon name="refresh" className="h-3.5 w-3.5" />
        Reset to my defaults
      </button>
    </div>
  );
}
