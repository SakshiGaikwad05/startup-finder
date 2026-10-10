import { NextResponse } from "next/server";
import { query } from "@/lib/database";
import { currentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** PATCH { show_again: boolean } — pin/unpin a startup for the current user. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "no_profile" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  if (typeof body.show_again !== "boolean") return NextResponse.json({ error: "show_again must be boolean" }, { status: 400 });
  await query(
    body.show_again
      ? "UPDATE users SET pinned = array_append(array_remove(pinned, $2), $2) WHERE id = $1"
      : "UPDATE users SET pinned = array_remove(pinned, $2) WHERE id = $1",
    [user.id, Number(id)]
  );
  return NextResponse.json({ ok: true });
}
