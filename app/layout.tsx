import "./globals.css";
import type { Metadata, Viewport } from "next";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { themeBootScript } from "@/components/ThemeToggle";

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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e13" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may add class="dark" before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <NavBar />
        {/* Extra bottom padding on phones so content isn't hidden behind the tab bar. */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-24 sm:px-4 sm:py-6 sm:pb-6">{children}</main>
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
