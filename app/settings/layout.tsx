import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile & Settings",
  description: "Manage your candidate profile, target roles, tech stack, and private link.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
