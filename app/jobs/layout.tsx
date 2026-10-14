import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Startup Jobs",
  description: "Browse curated tech jobs at top startups with direct application links.",
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
