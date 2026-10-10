// Source status for the Settings page. (Profiles live under /api/me.)
import { NextResponse } from "next/server";
import { query } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await query("SELECT id, name, kind, enabled, last_run_at, last_status, notes FROM sources ORDER BY id");
  return NextResponse.json({ sources });
}
