import { NextResponse } from "next/server";
import { query } from "@/lib/database";
import { currentUser } from "@/lib/users";
import { APPLICATION_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "no_profile" }, { status: 401 });
  const rows = await query(
    `SELECT a.*, s.name AS startup_name, j.job_title, j.job_url, COALESCE(s.careers_url, s.website, s.source_url) AS careers_url
     FROM applications a JOIN startups s ON s.id = a.startup_id LEFT JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = $1
     ORDER BY a.updated_at DESC`,
    [user.id]
  );
  return NextResponse.json({ applications: rows });
}

/** POST { startup_id, job_id?, status? } — creates or updates the user's (startup, job) row. Used by "Save". */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "no_profile" }, { status: 401 });
  const b = await req.json();
  const status = b.status ?? "Saved";
  if (!APPLICATION_STATUSES.includes(status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
  if (!Number.isInteger(b.startup_id)) return NextResponse.json({ error: "startup_id required" }, { status: 400 });
  // application_url: only a URL we already hold for that job (never invented).
  const [job] = b.job_id ? await query("SELECT apply_url, job_url FROM jobs WHERE id = $1", [b.job_id]) : [null];
  const rows = await query(
    `INSERT INTO applications (user_id, startup_id, job_id, status, application_url, applied_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = 'Applied' THEN CURRENT_DATE END)
     ON CONFLICT (COALESCE(user_id, 0), startup_id, COALESCE(job_id, 0))
     DO UPDATE SET status = EXCLUDED.status, updated_at = now(),
       applied_at = COALESCE(applications.applied_at, EXCLUDED.applied_at)
     RETURNING *`,
    [user.id, b.startup_id, b.job_id ?? null, status, job?.apply_url ?? job?.job_url ?? null]
  );
  return NextResponse.json({ application: rows[0] });
}
