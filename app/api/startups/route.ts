import { NextResponse } from "next/server";
import { freshWindowStart, loadStartups } from "@/lib/discovery/read";
import { query } from "@/lib/database";
import { currentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "no_profile" }, { status: 401 });
    const startups = await loadStartups(user);
    const [lastRun] = await query("SELECT id, started_at, finished_at, status, stats FROM discovery_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1");
    const freshSince = await freshWindowStart();
    return NextResponse.json({ startups, lastRun: lastRun ?? null, freshSince: freshSince.toISOString(), profile: user.profile });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
