// Builds the dashboard read model. Matching is computed here, from the *current* profile,
// so editing the profile on the Settings page immediately changes scores.
import { getProfile, query } from "@/lib/database";
import { matchJob } from "@/lib/matching";
import { candidateSkillSet } from "@/lib/matching/skills";
import { companyLocationTags, locationTags } from "@/lib/jobs/location";
import { ageBucket, fundingStatus } from "@/lib/funding";
import { roleCategories } from "@/lib/jobs/roles";
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

const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const dateOnly = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export async function loadStartups(opts: { id?: number } = {}): Promise<StartupView[]> {
  const profile = await getProfile();
  const owned = candidateSkillSet(profile);
  const where = opts.id ? "WHERE id = $1" : "";
  const startups = await query(`SELECT * FROM startups ${where} ORDER BY id`, opts.id ? [opts.id] : []);
  const jobs = await query(
    `SELECT * FROM jobs WHERE is_active ${opts.id ? "AND startup_id = $1" : ""} ORDER BY id`,
    opts.id ? [opts.id] : []
  );
  const apps = await query<any>(
    `SELECT a.*, j.job_title FROM applications a LEFT JOIN jobs j ON j.id = a.job_id ${opts.id ? "WHERE a.startup_id = $1" : ""}`,
    opts.id ? [opts.id] : []
  );
  const today = await freshWindowStart();

  const jobsBy = new Map<number, JobView[]>();
  for (const j of jobs) {
    const tags = locationTags(j.location, j.remote, j.remote_scope);
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
      skills: j.skills ?? [],
      source: j.source,
      source_url: j.source_url,
      discovered_at: iso(j.discovered_at)!,
      is_active: j.is_active,
      location_tags: tags,
      // Title, plus the short role label some sources give (YC: "Engineering · Machine learning").
      role_categories: roleCategories(j.job_title, j.description && j.description.length < 80 ? j.description : ""),
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

  return startups.map((s: any) => {
    const js = (jobsBy.get(s.id) ?? []).sort((a, b) => b.match.match_score - a.match.match_score);
    const relevant = js.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential");
    const best = relevant[0]?.match.match_score ?? 0;
    const tags = new Set<string>(companyLocationTags(s.location));
    for (const j of js) for (const t of j.location_tags) tags.add(t);
    if (tags.size === 0) tags.add("Other");
    const lastFunding = dateOnly(s.last_funding_date);
    const view: StartupView = {
      id: s.id,
      name: s.name,
      website: s.website,
      domain: s.domain,
      linkedin_url: s.linkedin_url,
      careers_url: s.careers_url,
      description: s.description,
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
      source: s.source,
      source_url: s.source_url,
      sources_seen: s.sources_seen ?? [],
      field_sources: s.field_sources ?? {},
      first_discovered_at: iso(s.first_discovered_at)!,
      last_seen_at: iso(s.last_seen_at)!,
      last_updated_at: iso(s.last_updated_at)!,
      last_change_reason: s.last_change_reason,
      show_again: s.show_again,
      is_fresh: s.show_again || new Date(s.first_discovered_at) >= today || new Date(s.last_updated_at) >= today,
      location_tags: [...tags],
      // careers@ first, then general, then people
      emails: [...(s.emails ?? [])].sort(
        (a: any, b: any) => ["careers", "general", "person"].indexOf(a.type) - ["careers", "general", "person"].indexOf(b.type)
      ),
      jobs: js,
      relevant_jobs: relevant.length,
      best_match: best,
      relevance: relevant.some((j) => j.match.relevance === "strong") ? "strong" : relevant.length ? "potential" : "low",
      applications: appsBy.get(s.id) ?? [],
    };
    return view;
  });
}
