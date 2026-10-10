import { NextResponse } from "next/server";
import { query } from "@/lib/database";
import { APPLICATION_STATUSES } from "@/lib/types";
import { currentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** PATCH { status?, notes?, applied_at?, application_url? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "no_profile" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  if (b.status !== undefined && !APPLICATION_STATUSES.includes(b.status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  const rows = await query(
    `UPDATE applications SET
       status = COALESCE($2, status),
       notes = CASE WHEN $3::boolean THEN $4 ELSE notes END,
       application_url = CASE WHEN $5::boolean THEN $6 ELSE application_url END,
       applied_at = CASE
         WHEN $7::boolean THEN $8::date
         WHEN $2 = 'Applied' AND applied_at IS NULL THEN CURRENT_DATE
         ELSE applied_at END,
       updated_at = now()
     WHERE id = $1 AND user_id = $9 RETURNING *`,
    [
      Number(id),
      b.status ?? null,
      b.notes !== undefined,
      b.notes ?? null,
      b.application_url !== undefined,
      b.application_url || null,
      b.applied_at !== undefined,
      b.applied_at || null,
      user.id,
    ]
  );
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ application: rows[0] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "no_profile" }, { status: 401 });
  const { id } = await params;
  await query("DELETE FROM applications WHERE id = $1 AND user_id = $2", [Number(id), user.id]);
  return NextResponse.json({ ok: true });
}
