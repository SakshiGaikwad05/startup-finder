import type { JobMatch } from "@/lib/types";

export function scoreColor(score: number, relevance: JobMatch["relevance"]) {
  if (relevance === "not_relevant") return "bg-gray-100 text-gray-500";
  if (relevance === "strong") return "bg-emerald-100 text-emerald-800";
  if (relevance === "potential") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-600";
}

export function MatchBadge({ match }: { match: JobMatch }) {
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${scoreColor(match.match_score, match.relevance)}`}>
      {match.relevance === "not_relevant" ? "not relevant" : `${match.match_score}% match`}
    </span>
  );
}

/** The transparent "why" breakdown. */
export function MatchWhy({ match }: { match: JobMatch }) {
  const ok = "text-emerald-700";
  const no = "text-gray-500";
  return (
    <div className="mt-1 grid gap-x-6 gap-y-1 rounded-md bg-gray-50 p-2 text-xs sm:grid-cols-2">
      {match.cap_reason && <div className="font-medium text-rose-700 sm:col-span-2">⚠ {match.cap_reason}</div>}
      <div>
        <div className="font-medium text-gray-700">Why ({match.match_score}/100)</div>
        <ul className="mt-0.5 space-y-0.5">
          <li className={match.role_match.level !== "none" ? ok : no}>
            {match.role_match.level === "strong" ? "✓" : match.role_match.level === "partial" ? "~" : "✗"} Role: {match.role_match.note}{" "}
            <span className="text-gray-400">(+{match.role_match.points}/40)</span>
          </li>
          {match.matched_skills.map((s) => (
            <li key={s} className={ok}>
              ✓ {s}
            </li>
          ))}
          <li className={match.location_match.points >= 20 ? ok : no}>
            {match.location_match.points >= 20 ? "✓" : match.location_match.points > 0 ? "~" : "✗"} {match.location_match.label}{" "}
            <span className="text-gray-400">(+{match.location_match.points}/20)</span>
          </li>
          <li className={match.experience_match.level === "fits" ? ok : no}>
            {match.experience_match.level === "fits" ? "✓" : match.experience_match.level === "too_senior" ? "✗" : "~"}{" "}
            {match.experience_match.label} <span className="text-gray-400">(+{match.experience_match.points}/10)</span>
          </li>
          <li className="text-gray-400">
            Skills: +{match.skill_points}/30{" "}
            {match.matched_skills.length + match.missing_skills.length === 0 ? "(job lists no specific skills)" : ""}
          </li>
        </ul>
      </div>
      <div>
        <div className="font-medium text-gray-700">Missing</div>
        {match.missing_skills.length ? (
          <ul className="mt-0.5 space-y-0.5 text-rose-700">
            {match.missing_skills.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-400">Nothing listed that you lack</div>
        )}
      </div>
    </div>
  );
}
