// Persisting source results: dedup (domain → LinkedIn → normalized name), merge without
// overwriting verified data with blanks, and change detection for "show again" logic.
import type { CandidateProfile, JobResult, StartupResult } from "@/lib/types";
import { query } from "@/lib/database";
import { domainOf, normalizeLinkedin, normalizeName } from "@/lib/deduplication";
import { classifyStartup } from "@/lib/classification";
import { isNewStartup, fundingStatus } from "@/lib/funding";
import { matchJob } from "@/lib/matching";
import { locationTags } from "@/lib/jobs/location";
import { candidateSkillSet } from "@/lib/matching/skills";

export interface UpsertOutcome {
  id: number;
  created: boolean;
  newJobs: number;
  newRelevantJobs: string[];
  changes: string[];
}

async function findExisting(r: StartupResult, domain: string | null, linkedin: string | null, norm: string) {
  if (domain) {
    const rows = await query("SELECT * FROM startups WHERE domain = $1", [domain]);
    if (rows[0]) return rows[0];
  }
  if (linkedin) {
    const rows = await query("SELECT * FROM startups WHERE linkedin_url = $1", [linkedin]);
    if (rows[0]) return rows[0];
  }
  if (norm.length >= 3) {
    // Name match only if it doesn't contradict a known domain.
    const rows = await query("SELECT * FROM startups WHERE normalized_name = $1 ORDER BY id LIMIT 5", [norm]);
    const hit = rows.find((s: any) => !domain || !s.domain || s.domain === domain);
    if (hit) return hit;
  }
  return null;
}

/** Which source is more authoritative for company facts (higher wins). */
const PRIORITY: Record<string, number> = { yc: 4, company_careers: 3, search: 2, remotive: 2, funding_rss: 1 };
const priority = (s: string | undefined) => (s ? PRIORITY[s] ?? 0 : 0);

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export async function upsertStartup(r: StartupResult, profile: CandidateProfile): Promise<UpsertOutcome> {
  const domain = domainOf(r.website);
  const linkedin = normalizeLinkedin(r.linkedinUrl);
  const norm = normalizeName(r.name);
  const existing = await findExisting(r, domain, linkedin, norm);
  const changes: string[] = [];

  // ----- merge simple fields -----
  const fieldSources: Record<string, { source: string; url: string }> = { ...(existing?.field_sources ?? {}) };
  const merged: Record<string, any> = {};
  const simple: [string, any][] = [
    ["website", r.website ?? null],
    ["domain", domain],
    ["linkedin_url", linkedin],
    ["careers_url", r.careersUrl ?? null],
    ["description", r.description ?? null],
    ["location", r.location ?? null],
    ["founded_year", r.foundedYear ?? null],
  ];
  for (const [field, value] of simple) {
    const old = existing?.[field] ?? null;
    if (value == null || value === "") {
      merged[field] = old;
      continue;
    }
    const prev = fieldSources[field]?.source ?? existing?.source;
    // Higher-priority sources win; a source may refresh its own data (except news, where
    // different articles would keep overwriting each other).
    const mayOverwrite = !existing || priority(r.source) > priority(prev) || (r.source === prev && r.source !== "funding_rss");
    if (old == null || (mayOverwrite && !same(old, value))) {
      if (existing && old != null && !same(old, value) && field !== "domain") changes.push(field.replace(/_/g, " "));
      if (existing && old == null && field === "careers_url") changes.push("career page found");
      merged[field] = value;
      if (field !== "domain") fieldSources[field] = { source: r.source, url: r.sourceUrl };
    } else {
      merged[field] = old;
    }
  }

  // ----- funding: newest dated announcement wins; undated only fills blanks -----
  let funding = {
    last_funding_date: existing?.last_funding_date ? new Date(existing.last_funding_date).toISOString().slice(0, 10) : null,
    last_funding_amount: existing?.last_funding_amount ?? null,
    funding_round: existing?.funding_round ?? null,
    investors: existing?.investors ?? null,
    funding_source: existing?.funding_source ?? null,
    funding_source_url: existing?.funding_source_url ?? null,
  };
  if (r.funding) {
    const f = r.funding;
    const newer = f.date && (!funding.last_funding_date || f.date > funding.last_funding_date);
    const fillBlank = !funding.funding_round && !funding.last_funding_date;
    if (newer || fillBlank) {
      const next = {
        last_funding_date: f.date,
        last_funding_amount: f.amount,
        funding_round: f.round,
        investors: f.investors.length ? f.investors : null,
        funding_source: f.source,
        funding_source_url: f.sourceUrl,
      };
      if (existing && !same(next, funding)) changes.push("funding");
      funding = next;
    }
  }

  // ----- classification (re-run when description/tags change) -----
  const tags = [...new Set([...(existing?.raw_tags ?? []), ...(r.tags ?? [])])];
  const cls = classifyStartup({
    name: r.name,
    description: merged.description,
    tags,
    industryHint: r.industryHint ?? null,
  });
  const keepOldCls =
    existing && existing.industry && (priority(r.source) < priority(existing.source) || (!r.tags?.length && !r.description));

  const sourcesSeen = [...new Set([...(existing?.sources_seen ?? []), r.source])];
  const values = {
    name: existing?.name ?? r.name,
    normalized_name: existing?.normalized_name ?? norm,
    ...merged,
    industry: keepOldCls ? existing.industry : cls.industry,
    is_ai: keepOldCls ? existing.is_ai : cls.is_ai,
    ai_category: keepOldCls ? existing.ai_category : cls.ai_category,
    classification_confidence: keepOldCls ? existing.classification_confidence : cls.classification_confidence,
    classification_reasons: JSON.stringify(keepOldCls ? existing.classification_reasons : cls.reasons),
    is_new_startup: isNewStartup(merged.founded_year),
    ...funding,
    funding_status: fundingStatus(funding.last_funding_date, funding.funding_round),
    sources_seen: sourcesSeen,
    field_sources: JSON.stringify(fieldSources),
    raw_tags: tags,
  };

  let id: number;
  let created = false;
  if (!existing) {
    const cols = Object.keys(values);
    const rows = await query<{ id: number }>(
      `INSERT INTO startups (${cols.join(",")}, source, source_url, last_change_reason)
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}, $${cols.length + 1}, $${cols.length + 2}, 'New discovery')
       RETURNING id`,
      [...Object.values(values), r.source, r.sourceUrl]
    );
    id = rows[0].id;
    created = true;
  } else {
    id = existing.id;
    const cols = Object.keys(values);
    await query(
      `UPDATE startups SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, last_seen_at = now()
       ${changes.length ? `, last_updated_at = now(), last_change_reason = $${cols.length + 2}` : ""}
       WHERE id = $${cols.length + 1}`,
      [...Object.values(values), id, ...(changes.length ? [`Updated: ${changes.join(", ")}`] : [])]
    );
  }

  // ----- jobs -----
  const { newJobs, newRelevant } = await upsertJobs(id, r, profile);
  if (!created && newRelevant.length) {
    await query(
      "UPDATE startups SET last_updated_at = now(), last_change_reason = $2 WHERE id = $1",
      [id, `New relevant job: ${newRelevant.slice(0, 3).join(", ")}`]
    );
  }
  await refreshRemoteAvailable(id);
  return { id, created, newJobs, newRelevantJobs: newRelevant, changes };
}

async function upsertJobs(startupId: number, r: StartupResult, profile: CandidateProfile) {
  const owned = candidateSkillSet(profile);
  let newJobs = 0;
  const newRelevant: string[] = [];
  if (!r.jobs) return { newJobs, newRelevant };
  const seenUrls: string[] = [];
  for (const j of r.jobs as JobResult[]) {
    if (!j.url || !j.title) continue;
    seenUrls.push(j.url);
    const rows = await query<{ inserted: boolean }>(
      `INSERT INTO jobs (startup_id, job_title, job_url, apply_url, location, remote, remote_scope, employment_type,
         posted_date, min_experience, salary, skills, description, source, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (job_url) DO UPDATE SET
         job_title = EXCLUDED.job_title, location = EXCLUDED.location, remote = EXCLUDED.remote,
         remote_scope = EXCLUDED.remote_scope, employment_type = EXCLUDED.employment_type,
         min_experience = EXCLUDED.min_experience, salary = EXCLUDED.salary, skills = EXCLUDED.skills,
         description = COALESCE(EXCLUDED.description, jobs.description), last_seen_at = now(), is_active = true
       RETURNING (xmax = 0) AS inserted`,
      [
        startupId, j.title, j.url, j.applyUrl ?? null, j.location ?? null, j.remote, j.remoteScope ?? null,
        j.employmentType ?? null, j.postedDate ?? null, j.minExperience ?? null, j.salary ?? null,
        j.skills ?? [], j.description ?? null, j.source, j.sourceUrl,
      ]
    );
    if (rows[0]?.inserted) {
      newJobs++;
      const m = matchJob(
        {
          job_title: j.title,
          skills: j.skills ?? [],
          description: j.description ?? null,
          min_experience: j.minExperience ?? null,
          location: j.location ?? null,
          remote_scope: j.remoteScope ?? null,
          location_tags: locationTags(j.location, j.remote, j.remoteScope ?? null),
        },
        profile,
        owned
      );
      if (m.relevance === "strong" || m.relevance === "potential") newRelevant.push(j.title);
    }
  }
  // Jobs from this source that disappeared from the listing are no longer active.
  await query(
    `UPDATE jobs SET is_active = false WHERE startup_id = $1 AND source = $2 AND NOT (job_url = ANY($3))`,
    [startupId, r.source, seenUrls]
  );
  return { newJobs, newRelevant };
}

async function refreshRemoteAvailable(id: number) {
  await query(
    `UPDATE startups SET remote_available = (
       SELECT CASE WHEN bool_or(remote = 'yes') THEN true
                   WHEN count(*) > 0 AND bool_and(remote = 'no') THEN false
                   ELSE NULL END
       FROM jobs WHERE startup_id = $1 AND is_active)
     WHERE id = $1`,
    [id]
  );
}
