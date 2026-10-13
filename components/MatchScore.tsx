import type { JobMatch } from "@/lib/types";
import { Icon } from "./Icon";

export const MATCH_LABEL: Record<JobMatch["relevance"], string> = {
  strong: "Great match",
  potential: "Good match",
  low: "Weak match",
  not_relevant: "Not your role",
};

const STYLE: Record<JobMatch["relevance"], string> = {
  strong: "bg-emerald-100 text-emerald-800",
  potential: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-600",
  not_relevant: "bg-gray-100 text-gray-500",
};

const DOT: Record<JobMatch["relevance"], string> = {
  strong: "bg-emerald-500",
  potential: "bg-amber-500",
  low: "bg-gray-400",
  not_relevant: "bg-gray-300",
};

/** `showScore={false}` inside a startup card, whose corner badge already shows the percentage. */
export function MatchBadge({ match, showScore = true }: { match: JobMatch; showScore?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[match.relevance]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[match.relevance]}`} aria-hidden="true" />
      {MATCH_LABEL[match.relevance]}
      {showScore && match.relevance !== "not_relevant" && <span className="font-medium tabular-nums opacity-75">{match.match_score}%</span>}
    </span>
  );
}

/** The matcher's cap reasons ("Marked low relevance: …") reworded for students. */
function friendlyCapReason(r: string) {
  return r.replace(/^Marked low relevance:\s*/i, "Ranked lower because of: ").replace(/^Marked potential \(not strong\):\s*/i, "Good, not great: ");
}

/** The whole match in one sentence: role · skills · location · experience (and why it was marked down). */
export function matchSummary(match: JobMatch): string {
  const r = match.role_match;
  const role =
    r.level === "strong" ? `${r.matched_role ?? "Your target"} role` : r.level === "partial" ? "Tech role, not one of your targets" : "Not one of your target roles";
  const listed = match.matched_skills.length + match.missing_skills.length;
  const missing = match.missing_skills.slice(0, 2);
  const skills = listed
    ? `you have ${match.matched_skills.length} of ${listed} skills${missing.length ? ` (missing ${missing.join(", ")}${match.missing_skills.length > 2 ? "…" : ""})` : ""}`
    : null;
  const parts = [role, skills, match.location_match.label, match.experience_match.label].filter(Boolean);
  return (match.cap_reason ? `${friendlyCapReason(match.cap_reason)}. ` : "") + parts.join(" · ");
}

/** One-line "why" shown under a job. */
export function MatchLine({ match }: { match: JobMatch }) {
  return (
    <p className={`mt-1 flex items-start gap-1.5 text-xs ${match.cap_reason ? "text-amber-800" : "text-gray-600"}`}>
      <Icon name={match.cap_reason ? "info" : "circle-check"} className="mt-px h-3.5 w-3.5 opacity-70" />
      {matchSummary(match)}
    </p>
  );
}
