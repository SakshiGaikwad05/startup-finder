// Role type and work arrangement for a job, only from what the posting itself states.
import type { RemoteFlag, RoleType, WorkArrangement } from "@/lib/types";

const INTERN = /\bintern(ship)?s?\b|\btrainee\b|\bapprentice(ship)?\b/i;

/** Internship when the title or employment type says so; otherwise the experience level. */
export function roleType(
  title: string,
  employmentType: string | null,
  level: "fresher" | "junior" | "experienced" | "unknown"
): RoleType {
  if (INTERN.test(title) || INTERN.test(employmentType ?? "")) return "internship";
  return level;
}

/** Remote / Hybrid / Onsite. "Hybrid" must be written in the posting; onsite needs a stated location. */
export function workArrangement(location: string | null, remote: RemoteFlag, employmentType: string | null = null): WorkArrangement {
  const text = `${location ?? ""} ${employmentType ?? ""}`;
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (remote === "yes") return "remote";
  if (remote === "no" && location && location.trim()) return "onsite";
  return "unknown";
}

export const ROLE_TYPE_LABELS: Record<RoleType, string> = {
  internship: "Internship",
  fresher: "Fresher (0–1 yr)",
  junior: "Junior (2–3 yrs)",
  experienced: "Experienced (4+ yrs)",
  unknown: "Not stated",
};

export const ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
  unknown: "Not stated",
};
