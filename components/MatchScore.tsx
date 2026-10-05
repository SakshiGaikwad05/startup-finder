import type { JobMatch } from "@/lib/types";

export const MATCH_LABEL: Record<JobMatch["relevance"], string> = {
  strong: "Great match",
  potential: "Good match",
  low: "Weak match",
  not_relevant: "Not your role",
};

const STYLE: Record<JobMatch["relevance"], string> = {
  strong: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  potential: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-gray-100 text-gray-600 ring-gray-200",
  not_relevant: "bg-gray-50 text-gray-400 ring-gray-200",
};

export function MatchBadge({ match }: { match: JobMatch }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STYLE[match.relevance]}`}>
      {MATCH_LABEL[match.relevance]}
      {match.relevance !== "not_relevant" && <span className="font-normal opacity-80">· {match.match_score}%</span>}
    </span>
  );
}

function Row({ ok, label, pts, max }: { ok: "yes" | "partly" | "no"; label: string; pts?: number; max?: number }) {
  const icon = ok === "yes" ? "✓" : ok === "partly" ? "~" : "✗";
  const color = ok === "yes" ? "text-emerald-700" : ok === "partly" ? "text-amber-700" : "text-gray-500";
  return (
    <li className={`flex gap-2 ${color}`}>
      <span className="w-3 shrink-0 font-bold">{icon}</span>
      <span className="flex-1">{label}</span>
      {max !== undefined && <span className="text-gray-400 tabular-nums">{pts}/{max}</span>}
    </li>
  );
}

/** Plain-language "why" breakdown. */
export function MatchWhy({ match }: { match: JobMatch }) {
  const r = match.role_match;
  const l = match.location_match;
  const e = match.experience_match;
  const skillsMentioned = match.matched_skills.length + match.missing_skills.length;
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
      {match.cap_reason && <div className="mb-2 rounded bg-rose-50 px-2 py-1 font-medium text-rose-700">⚠ {match.cap_reason}</div>}
      <ul className="space-y-1">
        <Row ok={r.level === "strong" ? "yes" : r.level === "partial" ? "partly" : "no"} label={`Role — ${r.note}`} pts={r.points} max={40} />
        <Row
          ok={match.skill_points >= 20 ? "yes" : match.skill_points >= 10 ? "partly" : "no"}
          label={
            skillsMentioned === 0
              ? "Skills — the job doesn't list specific skills"
              : `Skills — you have ${match.matched_skills.length} of ${skillsMentioned} listed`
          }
          pts={match.skill_points}
          max={30}
        />
        <Row ok={l.points >= 20 ? "yes" : l.points > 0 ? "partly" : "no"} label={`Location — ${l.label}`} pts={l.points} max={20} />
        <Row ok={e.level === "fits" ? "yes" : e.level === "too_senior" ? "no" : "partly"} label={`Experience — ${e.label}`} pts={e.points} max={10} />
      </ul>
      {(match.matched_skills.length > 0 || match.missing_skills.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {match.matched_skills.map((s) => (
            <span key={s} className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
              ✓ {s}
            </span>
          ))}
          {match.missing_skills.map((s) => (
            <span key={s} className="rounded-full bg-white px-2 py-0.5 text-rose-700 ring-1 ring-rose-200" title="Mentioned by the job, not on your profile">
              missing: {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
