// GET /api/me/link?t=<token> — opens a profile on this device via its private link.
import { NextResponse } from "next/server";
import { userByToken, USER_COOKIE, cookieOptions } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await userByToken(url.searchParams.get("t"));
  if (!user) return NextResponse.redirect(new URL("/onboarding?link=invalid", url));
  const res = NextResponse.redirect(new URL("/dashboard", url));
  res.cookies.set(USER_COOKIE, user.token, cookieOptions);
  return res;
}
