// "Find Startups Today": runs every enabled source, stores results, records a run log.
import { getProfile, query } from "@/lib/database";
import { generateQueries } from "./queries";
import { upsertStartup } from "./store";
import { ENRICHERS, SOURCES } from "@/sources";
import type { DiscoveryContext, StartupSource } from "@/lib/types";

export interface RunState {
  runId: number | null;
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  log: string[];
  stats: { startups: number; created: number; updated: number; jobs: number; newJobs: number; errors: number };
}

const g = globalThis as unknown as { __run?: RunState };
function state(): RunState {
  if (!g.__run) {
    g.__run = {
      runId: null,
      running: false,
      startedAt: null,
      finishedAt: null,
      log: [],
      stats: { startups: 0, created: 0, updated: 0, jobs: 0, newJobs: 0, errors: 0 },
    };
  }
  return g.__run;
}

export function runStatus(): RunState {
  return state();
}

/** Starts a run in the background. Returns false if one is already running. */
export function startDiscovery(): boolean {
  const s = state();
  if (s.running) return false;
  s.running = true;
  s.log = [];
  s.stats = { startups: 0, created: 0, updated: 0, jobs: 0, newJobs: 0, errors: 0 };
  s.startedAt = new Date().toISOString();
  s.finishedAt = null;
  runDiscovery().catch((e) => {
    s.log.push(`Run failed: ${(e as Error).message}`);
    s.running = false;
  });
  return true;
}

export async function runDiscovery(onLog?: (m: string) => void): Promise<RunState> {
  const s = state();
  s.running = true;
  const log = (m: string) => {
    const line = `${new Date().toLocaleTimeString()}  ${m}`;
    s.log.push(line);
    onLog?.(line);
  };
  const [{ id: runId }] = await query<{ id: number }>("INSERT INTO discovery_runs DEFAULT VALUES RETURNING id");
  s.runId = runId;
  try {
    const profile = await getProfile();
    const ctx: DiscoveryContext = {
      profile,
      queries: generateQueries(profile),
      log,
      careersCandidates: [],
    };

    const runSource = async (src: StartupSource) => {
      const reason = src.disabledReason();
      if (reason) {
        log(`${src.name}: skipped — ${reason}`);
        await query("UPDATE sources SET last_status = $2 WHERE id = $1", [src.id, `skipped: ${reason}`]);
        return;
      }
      log(`${src.name}: starting`);
      try {
        const results = await src.discover(ctx);
        let created = 0;
        for (const r of results) {
          try {
            const out = await upsertStartup(r, profile);
            s.stats.startups++;
            s.stats.jobs += r.jobs?.length ?? 0;
            s.stats.newJobs += out.newJobs;
            if (out.created) created++;
            else if (out.changes.length || out.newRelevantJobs.length) s.stats.updated++;
          } catch (e) {
            s.stats.errors++;
            log(`  could not store ${r.name}: ${(e as Error).message}`);
          }
        }
        s.stats.created += created;
        log(`${src.name}: ${results.length} startups (${created} new)`);
        await query("UPDATE sources SET last_run_at = now(), last_status = $2 WHERE id = $1", [
          src.id,
          `ok: ${results.length} startups, ${created} new`,
        ]);
      } catch (e) {
        s.stats.errors++;
        log(`${src.name}: failed — ${(e as Error).message}`);
        await query("UPDATE sources SET last_run_at = now(), last_status = $2 WHERE id = $1", [src.id, `error: ${(e as Error).message}`]);
      }
    };

    for (const src of SOURCES) await runSource(src);

    // Careers-page candidates: recently funded first, then startups with no jobs yet, then the rest.
    ctx.careersCandidates = await query(
      `SELECT s.id, s.name, s.website FROM startups s
       WHERE s.website IS NOT NULL
         AND (s.careers_url IS NULL
              -- re-read boards we already found jobs on, so new openings show up daily
              OR EXISTS (SELECT 1 FROM jobs j WHERE j.startup_id = s.id AND j.source = 'company_careers'))
       ORDER BY (s.last_funding_date IS NOT NULL) DESC,
                EXISTS (SELECT 1 FROM jobs j WHERE j.startup_id = s.id AND j.is_active) ASC,
                s.first_discovered_at DESC`
    );
    for (const src of ENRICHERS) await runSource(src);

    log(`Done. ${s.stats.created} new startups, ${s.stats.updated} updated, ${s.stats.newJobs} new jobs.`);
    await query("UPDATE discovery_runs SET finished_at = now(), status = 'done', log = $2, stats = $3 WHERE id = $1", [
      runId,
      JSON.stringify(s.log),
      JSON.stringify(s.stats),
    ]);
  } catch (e) {
    log(`Run failed: ${(e as Error).message}`);
    await query("UPDATE discovery_runs SET finished_at = now(), status = 'failed', log = $2 WHERE id = $1", [runId, JSON.stringify(s.log)]);
  } finally {
    s.running = false;
    s.finishedAt = new Date().toISOString();
  }
  return s;
}
