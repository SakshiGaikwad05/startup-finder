import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { themeBootScript } from "@/components/ThemeToggle";

// Self-hosted (SIL Open Font License) so builds never depend on reaching Google Fonts.
const body = localFont({ src: "./fonts/figtree-latin.woff2", variable: "--font-body", weight: "300 900", display: "swap" });
const heading = localFont({ src: "./fonts/bricolage-grotesque-latin.woff2", variable: "--font-heading", weight: "600 700", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://startup-finder.sakshii.tech"),
  title: {
    default: "Daily Startup Finder — Startups Hiring For Your Skills",
    template: "%s | Daily Startup Finder",
  },
  description:
    "Find YC and recently funded startups actively hiring for your tech stack. Upload your resume or choose your skills to see tailored matches with detailed match reasons.",
  keywords: [
    "startup jobs",
    "software engineer jobs",
    "YC startups",
    "funded startups",
    "tech hiring",
    "remote jobs",
    "India startup jobs",
    "Pune jobs",
    "developer matching",
  ],
  authors: [{ name: "Daily Startup Finder" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://startup-finder.sakshii.tech",
    siteName: "Daily Startup Finder",
    title: "Daily Startup Finder — Startups Hiring For Your Skills",
    description:
      "Find YC and recently funded startups actively hiring for your tech stack. Upload your resume or choose your skills to see tailored matches.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Startup Finder — Startups Hiring For Your Skills",
    description:
      "Find YC and recently funded startups actively hiring for your tech stack. Upload your resume or choose your skills to see tailored matches.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
