import { NextResponse } from "next/server";
import { ready } from "@/lib/database";
import { runStatus, startDiscovery } from "@/lib/discovery/run";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(runStatus());
}

export async function POST() {
  try {
    await ready();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const started = startDiscovery();
  return NextResponse.json({ started, ...runStatus() }, { status: started ? 202 : 409 });
}
