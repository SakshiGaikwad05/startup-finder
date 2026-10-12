// 1) Force HTTPS in production (when behind proxy or via plain HTTP).
// 2) Optional site-wide password (HTTP Basic Auth) — only when APP_PASSWORD is set.
//    Leave it unset for a public deployment that anyone can use.
// 3) Visitors without a profile cookie are sent to /onboarding before seeing app pages.
import { NextResponse, type NextRequest } from "next/server";

const APP_PAGES = ["/dashboard", "/jobs", "/applications", "/settings", "/startups"];

export function middleware(req: NextRequest) {
  // Force HTTPS in production / when behind a reverse proxy (e.g. Render, Vercel, AWS)
  const host = req.headers.get("host") ?? "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("::1");
  const proto = req.headers.get("x-forwarded-proto");

  if (!isLocal && (proto === "http" || (process.env.NODE_ENV === "production" && req.nextUrl.protocol === "http:"))) {
    const forwardedHost = req.headers.get("x-forwarded-host") || host;
    const httpsUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${forwardedHost}`);
    return NextResponse.redirect(httpsUrl, 301);
  }

  const password = process.env.APP_PASSWORD;
  if (password) {
    const user = process.env.APP_USER || "admin";
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
