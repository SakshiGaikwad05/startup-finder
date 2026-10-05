import { NextResponse } from "next/server";
import { query } from "@/lib/database";

export const dynamic = "force-dynamic";

/** PATCH { show_again: boolean } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (typeof body.show_again !== "boolean") return NextResponse.json({ error: "show_again must be boolean" }, { status: 400 });
  await query("UPDATE startups SET show_again = $2 WHERE id = $1", [Number(id), body.show_again]);
  return NextResponse.json({ ok: true });
}
