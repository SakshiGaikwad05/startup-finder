import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Unauthenticated health check for Render. Doesn't touch the database. */
export function GET() {
  return NextResponse.json({ ok: true });
}
