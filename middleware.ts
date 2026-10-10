// 1) Optional site-wide password (HTTP Basic Auth) — only when APP_PASSWORD is set.
//    Leave it unset for a public deployment that anyone can use.
// 2) Visitors without a profile cookie are sent to /onboarding before seeing app pages.
import { NextResponse, type NextRequest } from "next/server";

const APP_PAGES = ["/dashboard", "/jobs", "/applications", "/settings", "/startups"];

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (password) {
    const user = process.env.APP_USER || "sakshi";
    const header = req.headers.get("authorization") ?? "";
    let ok = false;
    if (header.startsWith("Basic ")) {
      try {
        const [u, ...rest] = atob(header.slice(6)).split(":");
        ok = u === user && rest.join(":") === password;
      } catch {}
    }
    if (!ok) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Startup Finder", charset="UTF-8"' },
      });
    }
  }

  const path = req.nextUrl.pathname;
  if (APP_PAGES.some((p) => path === p || path.startsWith(p + "/")) && !req.cookies.get("sf_uid")?.value) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
