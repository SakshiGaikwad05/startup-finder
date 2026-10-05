import { NextResponse } from "next/server";
import { freshWindowStart, loadStartups } from "@/lib/discovery/read";
import { query } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startups = await loadStartups();
    const [lastRun] = await query("SELECT id, started_at, finished_at, status, stats FROM discovery_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1");
    const freshSince = await freshWindowStart();
    return NextResponse.json({ startups, lastRun: lastRun ?? null, freshSince: freshSince.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
