// Builds the dashboard read model. Matching is computed here, from the *current* profile,
// so editing the profile on the Settings page immediately changes scores.
import { query } from "@/lib/database";
import type { AppUser } from "@/lib/users";
import { jobLevel, matchJob } from "@/lib/matching";
import { isJobTooOld } from "@/lib/jobs/age";
import { settings } from "@/config/settings";
import { isOpenSource } from "@/lib/filters";
import { candidateSkillSet } from "@/lib/matching/skills";
import { companyLocationTags, locationTags } from "@/lib/jobs/location";
import { ageBucket, fundingStatus, isRecentYcBatch, launchedRecentlyEnough, ycBatchFundingDate } from "@/lib/funding";
import { roleCategories } from "@/lib/jobs/roles";
import { roleType, workArrangement } from "@/lib/jobs/arrangement";
import { startupCategories } from "@/lib/classification";
import { emailPriority } from "@/lib/emails";
import { countryFromLocation } from "@/lib/country";
import type { ApplicationView, JobView, StartupView } from "@/lib/types";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * "New & updated" window = the day of the latest finished discovery run (not the calendar day),
 * so the view isn't empty just because you haven't run discovery yet today.
 */
export async function freshWindowStart(): Promise<Date> {
  const [run] = await query<{ started_at: Date }>(
    "SELECT started_at FROM discovery_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1"
  );
  return startOfDay(run ? new Date(run.started_at) : new Date());
}

/**
 * Stored HQ country, or — for rows saved before HQ evidence was recorded — the country of the stored
 * HQ location text (never a job's location or an investor's).
 */
export function hqOf(s: any): Pick<StartupView, "hq_country" | "hq_confidence" | "hq_evidence" | "hq_source_url"> {
  if (s.hq_country) return { hq_country: s.hq_country, hq_confidence: s.hq_confidence ?? null, hq_evidence: s.hq_evidence ?? null, hq_source_url: s.hq_source_url ?? null };
  const country = countryFromLocation(s.location);
  if (!country) return { hq_country: null, hq_confidence: null, hq_evidence: null, hq_source_url: null };
  return {
    hq_country: country,
    hq_confidence: "medium",
    hq_evidence: `Headquarters listed as “${s.location}”`,
    hq_source_url: s.field_sources?.location?.url ?? s.source_url ?? null,
  };
}

const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const dateOnly = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// ---------- shared data cache ----------
// Startups and jobs are the same for every user and only change when a discovery run finishes,
// so they're loaded once and kept in memory. Per-user parts (match scores, applications, pins)
// are still computed on every request. The cache is cleared when a run finishes, and expires
// after a few minutes as a safety net (e.g. a run made from the CLI in another process).
interface SharedJob {
  row: any;
  tags: string[];
  roles: string[];
}
interface SharedData {
  startups: any[];
  jobsByStartup: Map<number, SharedJob[]>;
  fresh: Date;
}
const CACHE_MS = 10 * 60_000;
const cache = globalThis as unknown as { __sfShared?: Promise<SharedData>; __sfSharedAt?: number };

export function invalidateSharedData() {
  cache.__sfShared = undefined;
}

async function loadShared(): Promise<SharedData> {
  const [startups, jobs, fresh] = await Promise.all([
    query("SELECT * FROM startups ORDER BY id"),
    query("SELECT * FROM jobs WHERE is_active ORDER BY id"),
    freshWindowStart(),
  ]);
  const jobsByStartup = new Map<number, SharedJob[]>();
  for (const j of jobs) {
    const shared: SharedJob = {
      row: j,
      tags: locationTags(j.location, j.remote, j.remote_scope),
      // Title, plus the short role label some sources give (YC: "Engineering · Machine learning").
      roles: roleCategories(j.job_title, j.description && j.description.length < 80 ? j.description : ""),
    };
    if (!jobsByStartup.has(j.startup_id)) jobsByStartup.set(j.startup_id, []);
    jobsByStartup.get(j.startup_id)!.push(shared);
  }
  return { startups, jobsByStartup, fresh };
}

function sharedData(): Promise<SharedData> {
  if (!cache.__sfShared || Date.now() - (cache.__sfSharedAt ?? 0) > CACHE_MS) {
    cache.__sfSharedAt = Date.now();
    cache.__sfShared = loadShared().catch((e) => {
      cache.__sfShared = undefined;
      throw e;
    });
  }
  return cache.__sfShared;
}

/**
 * @param opts.id    one startup (details page)
 * @param opts.slim  dashboard list: leave out fields the cards don't show, to keep the response small
 */
export async function loadStartups(user: AppUser, opts: { id?: number; slim?: boolean } = {}): Promise<StartupView[]> {
  const profile = user.profile;
  const owned = candidateSkillSet(profile);
  const pinned = new Set(user.pinned ?? []);
  const [data, apps] = await Promise.all([
    sharedData(),
    query<any>(
      `SELECT a.*, j.job_title FROM applications a LEFT JOIN jobs j ON j.id = a.job_id
       WHERE a.user_id = $1 ${opts.id ? "AND a.startup_id = $2" : ""}`,
      opts.id ? [user.id, opts.id] : [user.id]
    ),
  ]);
  const startups = opts.id ? data.startups.filter((s) => s.id === opts.id) : data.startups;
  const today = data.fresh;
  const slim = !!opts.slim;

  const jobsBy = new Map<number, JobView[]>();
  for (const s of startups) {
    for (const { row: j, tags, roles } of data.jobsByStartup.get(s.id) ?? []) {
    if (isJobTooOld(j.posted_date, new Date(), j.discovered_at)) continue; // only last week's postings
    const level = jobLevel(j.job_title, j.min_experience, j.description);
    const view: JobView = {
      id: j.id,
      startup_id: j.startup_id,
      job_title: j.job_title,
      job_url: j.job_url,
      apply_url: j.apply_url,
      location: j.location,
      remote: j.remote,
      remote_scope: j.remote_scope,
      employment_type: j.employment_type,
      posted_date: j.posted_date,
      min_experience: j.min_experience,
      salary: j.salary,
      skills: slim ? [] : j.skills ?? [],
      source: j.source,
      source_url: j.source_url,
      discovered_at: iso(j.discovered_at)!,
      is_active: j.is_active,
      location_tags: tags,
      role_categories: roles,
      experience_level: level,
      role_type: roleType(j.job_title, j.employment_type, level),
      work_arrangement: workArrangement(j.location, j.remote, j.employment_type),
      match: matchJob(
        {
          job_title: j.job_title,
          skills: j.skills ?? [],
          description: j.description,
          min_experience: j.min_experience,
          location: j.location,
          remote_scope: j.remote_scope,
          location_tags: tags,
        },
        profile,
        owned
      ),
    };
    if (!jobsBy.has(j.startup_id)) jobsBy.set(j.startup_id, []);
    jobsBy.get(j.startup_id)!.push(view);
    }
  }
  const appsBy = new Map<number, ApplicationView[]>();
  for (const a of apps) {
    const v: ApplicationView = {
      id: a.id,
      startup_id: a.startup_id,
      job_id: a.job_id,
      status: a.status,
      applied_at: dateOnly(a.applied_at),
      application_url: a.application_url,
      notes: a.notes,
      updated_at: iso(a.updated_at)!,
      job_title: a.job_title ?? null,
    };
    if (!appsBy.has(a.startup_id)) appsBy.set(a.startup_id, []);
    appsBy.get(a.startup_id)!.push(v);
  }

  // Only recently funded startups are shown, plus any this user saved, applied to or pinned.
  const keep = (s: any) => {
    if (opts.id || pinned.has(s.id) || appsBy.has(s.id)) return true;
    if (isRecentYcBatch(s.funding_round)) return true; // every YC batch of this year (Winter → Fall)
    const ph = s.ph_launched_at && { date: dateOnly(s.ph_launched_at)!, votes: s.ph_votes ?? 0, url: s.ph_url ?? "" };
    if (ph && launchedRecentlyEnough(ph)) return true; // recent Product Hunt launch
    const date = dateOnly(s.last_funding_date) ?? ycBatchFundingDate(s.funding_round);
    // A future date is an upcoming YC Demo Day: the company is in a batch now, so already funded.
    return !!date && (Date.now() - new Date(date).getTime()) / 86_400_000 <= settings.addFundedWithinDays;
  };

  return startups.filter(keep).map((s: any) => {
    const js = (jobsBy.get(s.id) ?? []).sort((a, b) => b.match.match_score - a.match.match_score);
    const relevant = js.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential");
    const best = relevant[0]?.match.match_score ?? 0;
    const tags = new Set<string>(companyLocationTags(s.location));
    for (const j of js) for (const t of j.location_tags) tags.add(t);
    // Nothing says where they are (typical for funding-news startups): location filters don't hide them.
    if (tags.size === 0) tags.add("Unknown");
    // No dated funding news: a YC batch still dates the investment (approximate Demo Day).
    const lastFunding = dateOnly(s.last_funding_date) ?? ycBatchFundingDate(s.funding_round);
    const view: StartupView = {
      id: s.id,
      name: s.name,
      website: s.website,
      domain: s.domain,
      linkedin_url: s.linkedin_url,
      github_url: s.github_url ?? null,
      open_source: isOpenSource(s.github_url, s.raw_tags),
      ph_launched_at: dateOnly(s.ph_launched_at),
      ph_votes: s.ph_votes ?? null,
      ph_url: s.ph_url ?? null,
      careers_url: s.careers_url,
      // Cards show two lines of description; the details page gets the full text.
      description: slim && s.description && s.description.length > 300 ? s.description.slice(0, 297) + "…" : s.description,
      location: s.location,
      remote_available: s.remote_available,
      industry: s.industry,
      is_ai: s.is_ai,
      ai_category: s.ai_category,
      classification_confidence: s.classification_confidence,
      classification_reasons: s.classification_reasons ?? [],
      founded_year: s.founded_year,
      is_new_startup: s.is_new_startup,
      age_bucket: ageBucket(s.founded_year),
      funding_status: fundingStatus(lastFunding, s.funding_round),
      last_funding_date: lastFunding,
      last_funding_amount: s.last_funding_amount,
      funding_round: s.funding_round,
      investors: s.investors,
      funding_source: s.funding_source,
      funding_source_url: s.funding_source_url,
      funding_date_approximate: !s.last_funding_date && !!lastFunding,
      funding_stage: s.funding_stage ?? null,
      funding_kind: s.funding_kind ?? (s.funding_round || s.last_funding_date ? "confirmed" : null),
      funding_currency: s.funding_currency ?? null,
      funding_amount_usd: s.funding_amount_usd == null ? null : Number(s.funding_amount_usd),
      funding_verification_url: s.funding_verification_url ?? null,
      funding_conflicts: s.funding_conflicts ?? [],
      funding_reports: slim ? [] : s.funding_reports ?? [],
      ...hqOf(s),
      other_locations: s.other_locations ?? [],
      founders: slim ? [] : s.founders ?? [],
      categories: startupCategories({ industry: s.industry, is_ai: s.is_ai, ai_category: s.ai_category, description: s.description, tags: s.raw_tags }),
      last_verified_at: iso(s.last_seen_at)!,
      source: s.source,
      source_url: s.source_url,
      sources_seen: slim ? [] : s.sources_seen ?? [],
      field_sources: slim ? {} : s.field_sources ?? {},
      first_discovered_at: iso(s.first_discovered_at)!,
      last_seen_at: iso(s.last_seen_at)!,
      last_updated_at: iso(s.last_updated_at)!,
      last_change_reason: s.last_change_reason,
      show_again: pinned.has(s.id),
      is_fresh: pinned.has(s.id) || new Date(s.first_discovered_at) >= today || new Date(s.last_updated_at) >= today,
      location_tags: [...tags],
      // Careers / recruiting first, then hiring contacts, then general, then people
      emails: [...(s.emails ?? [])].sort((a: any, b: any) => emailPriority(a) - emailPriority(b)),
      jobs: js,
      relevant_jobs: relevant.length,
      best_match: best,
      relevance: relevant.some((j) => j.match.relevance === "strong") ? "strong" : relevant.length ? "potential" : "low",
      applications: appsBy.get(s.id) ?? [],
    };
    return view;
  });
}
