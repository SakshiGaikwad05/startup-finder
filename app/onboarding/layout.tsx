import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started & Find Matches",
  description: "Set up your developer profile, skills, and preferences to match with hiring YC and funded startups.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
