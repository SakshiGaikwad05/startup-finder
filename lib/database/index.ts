import { Pool, types } from "pg";

// Return DATE columns as 'YYYY-MM-DD' strings. The default (local-midnight Date) shifts the day
// in IST when converted with toISOString, which made unchanged funding look "updated".
types.setTypeParser(1082, (v: string) => v);
import fs from "node:fs";
import path from "node:path";
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

      const { rows } = await pool().query("SELECT count(*)::int AS n FROM candidate_profile");
      if (rows[0].n === 0) {
        const file = path.join(process.cwd(), "config", "candidate_profile.json");
        await pool().query("INSERT INTO candidate_profile (data) VALUES ($1)", [fs.readFileSync(file, "utf8")]);
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

export async function getProfile(): Promise<CandidateProfile> {
  const rows = await query<{ data: CandidateProfile }>(
    "SELECT data FROM candidate_profile ORDER BY id DESC LIMIT 1"
  );
  return rows[0].data;
}

export async function saveProfile(data: CandidateProfile): Promise<void> {
  await query("UPDATE candidate_profile SET data = $1, updated_at = now() WHERE id = (SELECT max(id) FROM candidate_profile)", [
    JSON.stringify(data),
  ]);
}
