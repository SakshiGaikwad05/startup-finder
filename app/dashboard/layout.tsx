import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Explore matched startups and job openings tailored to your tech stack and preferences.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
