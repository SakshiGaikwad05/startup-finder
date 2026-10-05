import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Startup Finder",
  description: "Startups in Pune / Remote that are hiring for your profile",
};

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/jobs", "Jobs"],
  ["/applications", "Applications"],
  ["/settings", "Settings"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-gray-200 bg-white">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/dashboard" className="font-semibold text-gray-900">
              Daily Startup Finder
            </Link>
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-sm text-gray-600 hover:text-gray-900">
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
