import { Pool, types } from "pg";

// Return DATE columns as 'YYYY-MM-DD' strings. The default (local-midnight Date) shifts the day
// in IST when converted with toISOString, which made unchanged funding look "updated".
types.setTypeParser(1082, (v: string) => v);
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { CandidateProfile } from "@/lib/types";
import { SOURCE_DEFS } from "@/sources/registry-meta";

const g = globalThis as unknown as { __pgPool?: Pool; __schemaReady?: Promise<void> };

export function pool(): Pool {
  if (!g.__pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and run `npm run db:up` (or point it at your own PostgreSQL)."
      );
    }
    g.__pgPool = new Pool({ connectionString: url, max: 5 });
  }
  return g.__pgPool;
}

/** Creates tables (idempotent) and seeds the profile + sources on first use. */
export function ready(): Promise<void> {
  if (!g.__schemaReady) {
    g.__schemaReady = (async () => {
      const sql = fs.readFileSync(path.join(process.cwd(), "lib", "database", "schema.sql"), "utf8");
      await pool().query(sql);
      // A server restart kills any in-process run; don't leave it looking "running".
      await pool().query("UPDATE discovery_runs SET status = 'interrupted', finished_at = now() WHERE status = 'running'");

      // Multi-user migration: a database from the single-user version has a candidate_profile row
      // and applications without a user. Turn that profile into the first user so nothing is lost.
      const { rows: legacy } = await pool().query(
        `SELECT data FROM candidate_profile
         WHERE NOT EXISTS (SELECT 1 FROM users) ORDER BY id DESC LIMIT 1`
      );
      if (legacy[0]) {
        const { rows: u } = await pool().query(
          "INSERT INTO users (token, profile) VALUES ($1, $2) RETURNING id",
          [crypto.randomBytes(24).toString("base64url"), JSON.stringify(legacy[0].data)]
        );
        await pool().query("UPDATE applications SET user_id = $1 WHERE user_id IS NULL", [u[0].id]);
        await pool().query("UPDATE startups SET show_again = false");
      }
      for (const s of SOURCE_DEFS) {
        await pool().query(
          `INSERT INTO sources (id, name, kind, base_url, notes) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind,
             base_url = EXCLUDED.base_url, notes = EXCLUDED.notes`,
          [s.id, s.name, s.kind, s.baseUrl, s.notes]
        );
      }
    })().catch((e) => {
      g.__schemaReady = undefined;
      throw e;
    });
  }
  return g.__schemaReady;
}

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const res = await pool().query(text, params);
  return res.rows as T[];
}

/**
 * Profile used by shared discovery (search queries, "new relevant job" detection).
 * Per-user matching uses each user's own profile at read time.
 */
export async function getDiscoveryProfile(): Promise<CandidateProfile> {
  const rows = await query<{ profile: CandidateProfile }>("SELECT profile FROM users ORDER BY last_seen_at DESC LIMIT 25");
  if (!rows.length) return GENERIC_PROFILE;
  // Union of everyone's roles and skills, so queries cover all users.
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])];
  const all = rows.map((r) => r.profile);
  return {
    ...GENERIC_PROFILE,
    target_roles: uniq(all.flatMap((p) => p.target_roles ?? [])),
    skills: uniq(all.flatMap((p) => p.skills ?? [])),
    preferred_locations: uniq(all.flatMap((p) => p.preferred_locations ?? [])),
    tech_experience_years: Math.max(...all.map((p) => p.tech_experience_years ?? 0)),
  };
}

export const GENERIC_PROFILE: CandidateProfile = {
  target_roles: ["Software Engineer", "Full Stack Developer", "Backend Developer", "Frontend Developer", "AI Engineer"],
  skills: [],
  programming_languages: [],
  frameworks: [],
  libraries: [],
  databases: [],
  cloud_tools: [],
  testing_skills: [],
  ai_ml_skills: [],
  projects: [],
  experience: [],
  tech_experience_years: 1,
  education: [],
  preferred_locations: ["Pune", "Remote", "Remote - India"],
  remote_preference: "remote_or_onsite",
};
