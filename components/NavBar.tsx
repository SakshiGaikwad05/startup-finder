"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Startups", icon: "compass" },
  { href: "/jobs", label: "Jobs", icon: "briefcase" },
  { href: "/applications", label: "Applications", icon: "clipboard" },
];
const PROFILE = { href: "/settings", label: "My profile", icon: "user" as IconName };

/** Top bar: name left, main sections centred, profile + theme right (links from tablet up). Phones get a bottom tab bar. */
export function NavBar() {
  const path = usePathname() ?? "";
  const onboarding = path.startsWith("/onboarding");
  const active = (href: string) => path === href || path.startsWith(href + "/") || (href === "/dashboard" && path.startsWith("/startups"));
  const link = (on: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      on ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <nav aria-label="Main" className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto] items-center gap-2 px-4 sm:grid-cols-[1fr_auto_1fr]">
          <Link
            href={onboarding ? "/onboarding" : "/dashboard"}
            className="justify-self-start whitespace-nowrap rounded-lg font-display text-[17px] font-bold tracking-tight text-gray-900"
          >
            Daily Startup Finder
          </Link>

          {!onboarding && (
            <div className="hidden items-center gap-1 sm:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={link(active(n.href))}>
                  <Icon name={n.icon} className="h-4 w-4" />
                  {n.label}
                </Link>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 justify-self-end ${onboarding ? "sm:col-start-3" : ""}`}>
            {!onboarding && (
              <Link href={PROFILE.href} aria-current={active(PROFILE.href) ? "page" : undefined} className={`hidden sm:flex ${link(active(PROFILE.href))}`}>
                <Icon name={PROFILE.icon} className="h-4 w-4" />
                {PROFILE.label}
              </Link>
            )}
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {!onboarding && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-gray-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        >
          {[...NAV, { ...PROFILE, label: "Profile" }].map((n) => {
            const on = active(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium ${on ? "text-brand-700" : "text-gray-500"}`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${on ? "bg-brand-100" : ""}`}>
                  <Icon name={n.icon} className="h-5 w-5" strokeWidth={on ? 2.2 : 1.8} />
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
