// Dashboard filter state and the filtering/sorting logic. Pure (no React), so it is unit-tested
// in scripts/test-lib.ts and shared by the Filters panel and the Dashboard.
import type { CandidateProfile, StartupView } from "@/lib/types";
import { LOCATION_OPTIONS } from "@/lib/types";

/** Default filters for a user: their locations and preferred startup types. */
export function filtersForProfile(p: CandidateProfile | null | undefined): FilterState {
  if (!p) return DEFAULT_FILTERS;
  // Skipped onboarding: startups funded in the last 30 days, anywhere, newest funding first.
  if (p.explorer) return { ...DEFAULT_FILTERS, view: "all", locations: [], fundingDays: 30, hiringOnly: false, sort: "funding" };
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
  /** Old saved filters only (funded_30 | funded_90 | funded_180); replaced by fundingDays. */
  funding: string[];
  /** Funded within this many days (7 / 30 / 60 / 90; 180 from the summary tile). Null = any time. */
  fundingDays?: number | null;
  /** Hide planned rounds and unconfirmed reports. */
  confirmedOnly?: boolean;
  /** Headquarters country. */
  country?: "any" | "india" | "usa" | "both";
  stages?: string[]; // pre_seed | seed | series_a | series_b_plus
  amounts?: string[]; // AMOUNT_BUCKETS keys, by USD value
  age: string[]; // new | early | growing | established
  roles: string[]; // job-role categories; empty = all roles
  levels?: string[]; // internship | fresher | junior | experienced | unknown; empty = any
  arrangements?: string[]; // remote | hybrid | onsite; empty = any
  types?: string[]; // industry categories (plus legacy profile types like "AI", "Web3"); empty = all
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

const LEGACY_FUNDING_DAYS: Record<string, number> = { funded_30: 30, funded_90: 90, funded_180: 180 };

/** Funding window in days, also understanding filters saved before day windows existed. */
export function fundingWindow(f: FilterState): number | null {
  if (f.fundingDays !== undefined) return f.fundingDays;
  const legacy = f.funding.map((x) => LEGACY_FUNDING_DAYS[x]).filter(Boolean);
  return legacy.length ? Math.max(...legacy) : null;
}

export const FUNDING_DAY_OPTIONS = [7, 30, 60, 90] as const;

export const STAGE_OPTIONS = ["pre_seed", "seed", "series_a", "series_b_plus"] as const;

/** USD amount buckets: [key, label, min, max). */
export const AMOUNT_BUCKETS: [string, string, number, number][] = [
  ["lt1", "Under $1M", 0, 1e6],
  ["1to10", "$1M–$10M", 1e6, 1e7],
  ["10to50", "$10M–$50M", 1e7, 5e7],
  ["50plus", "$50M+", 5e7, Infinity],
];

export const COUNTRY_OPTIONS = [
  ["any", "Any country"],
  ["india", "India"],
  ["usa", "USA"],
  ["both", "India + USA"],
] as const;

export const EXPERIENCE_LEVELS = [
  ["internship", "Internship", "Internships, trainee and apprentice roles"],
  ["fresher", "Fresher (0–1 yr)", "Internships, entry-level, or 0–1 years asked"],
  ["junior", "Junior (2–3 yrs)", "Asks for 2–3 years of experience"],
  ["experienced", "Experienced (4+ yrs)", "Senior titles or 4+ years asked"],
  ["unknown", "Not stated", "The job doesn't say how much experience it needs"],
] as const;

export const ARRANGEMENT_OPTIONS = [
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "Onsite"],
] as const;

const daysSince = (date: string) => (Date.now() - new Date(date).getTime()) / 86_400_000;

/**
 * Funded within `days`. A date in the future (an estimated YC Demo Day that hasn't happened yet)
 * never counts, so "last 30 days" only means money announced or invested by now.
 */
export function fundedWithin(s: Pick<StartupView, "last_funding_date">, days: number): boolean {
  if (!s.last_funding_date) return false;
  const d = daysSince(s.last_funding_date);
  return d >= -1 && d <= days; // -1: tolerate time zones on today's announcements
}

/** Profile types from onboarding ("AI") map onto our categories; others match a category or the stored industry. */
function matchesType(s: StartupView, t: string): boolean {
  if (t === "AI") return s.categories.includes("AI & AI Agents") || s.is_ai === true || s.industry === "AI Startup";
  return s.categories.includes(t) || s.industry === t;
}

/** With a role, experience or work-arrangement filter, each startup keeps only matching jobs (counts and best match follow). */
function restrictJobs(s: StartupView, roles: string[], levels: string[], arrangements: string[] = []): StartupView {
  if (!roles.length && !levels.length && !arrangements.length) return s;
  const jobs = s.jobs.filter(
    (j) =>
      (!roles.length || j.role_categories.some((c) => roles.includes(c))) &&
      (!levels.length || levels.includes(j.role_type) || levels.includes(j.experience_level)) &&
      (!arrangements.length || arrangements.includes(j.work_arrangement))
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
  const arrangements = f.arrangements ?? [];
  const days = fundingWindow(f);
  const country = f.country ?? "any";
  const out = list.map((s) => restrictJobs(s, roles, levels, arrangements)).filter((s) => {
    if ((roles.length || levels.length || arrangements.length) && s.jobs.length === 0) return false;
    if (f.view === "today" && !s.is_fresh) return false;
    if (f.locations.length && !s.location_tags.includes("Unknown") && !s.location_tags.some((t) => f.locations.includes(t))) return false;
    // Country = headquarters only; unknown HQ is hidden once a country is picked.
    if (country === "india" && s.hq_country !== "India") return false;
    if (country === "usa" && s.hq_country !== "United States") return false;
    if (country === "both" && s.hq_country !== "India" && s.hq_country !== "United States") return false;
    const types = f.types ?? [];
    if (types.length && !types.some((t) => matchesType(s, t))) return false;
    if (s.is_ai === true && !f.ai.ai) return false;
    if (s.is_ai === false && !f.ai.nonAi) return false;
    if (s.is_ai === null && !f.ai.unknown) return false;
    // "30 days" also includes 7 days, etc. Undated or future (estimated) funding never counts as recent.
    if (days != null && !fundedWithin(s, days)) return false;
    if (f.confirmedOnly && s.funding_kind !== "confirmed") return false;
    if (f.stages?.length && !(s.funding_stage && f.stages.includes(s.funding_stage))) return false;
    if (f.amounts?.length) {
      const usd = s.funding_amount_usd;
      if (usd == null || !AMOUNT_BUCKETS.some(([k, , min, max]) => f.amounts!.includes(k) && usd >= min && usd < max)) return false;
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
