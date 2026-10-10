import { NextResponse } from "next/server";
import { query, ready } from "@/lib/database";
import { runStatus, startDiscovery } from "@/lib/discovery/run";
import { currentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** Discovery is shared by all users, so a new run only starts if the last one is older than this. */
const COOLDOWN_HOURS = 3;

export async function GET() {
  return NextResponse.json(runStatus());
}

export async function POST(req: Request) {
  try {
    await ready();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  // Allowed for signed-up users, or for a scheduler that knows CRON_SECRET (daily auto-run).
  const cron = process.env.CRON_SECRET && req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  if (!cron && !(await currentUser())) return NextResponse.json({ error: "no_profile" }, { status: 401 });

  const [last] = await query<{ started_at: Date }>(
    "SELECT started_at FROM discovery_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1"
  );
  if (last && Date.now() - new Date(last.started_at).getTime() < COOLDOWN_HOURS * 3600_000) {
    return NextResponse.json({ started: false, upToDate: true, lastRunAt: last.started_at, ...runStatus() });
  }
  const started = startDiscovery();
  return NextResponse.json({ started, ...runStatus() }, { status: started ? 202 : 200 });
}
