import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NavBar } from "@/components/NavBar";
import { themeBootScript } from "@/components/ThemeToggle";

// Self-hosted (SIL Open Font License) so builds never depend on reaching Google Fonts.
const body = localFont({ src: "./fonts/figtree-latin.woff2", variable: "--font-body", weight: "300 900", display: "swap" });
const heading = localFont({ src: "./fonts/bricolage-grotesque-latin.woff2", variable: "--font-heading", weight: "600 700", display: "swap" });

export const metadata: Metadata = {
  title: "Daily Startup Finder",
  description: "Find startups hiring for your skills, matched to your resume, with the reason for every match.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the phone tab bar sit above the home indicator (safe-area padding)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#131210" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may add class="dark" before React hydrates.
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${heading.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">
          Skip to content
        </a>
        <NavBar />
        {/* Extra bottom padding on phones so content isn't hidden behind the tab bar. */}
        <main id="main" className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:py-8 sm:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
