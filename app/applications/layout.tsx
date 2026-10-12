import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Application Tracker",
  description: "Track and manage your startup job applications, interview stages, and follow-ups.",
};

export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
