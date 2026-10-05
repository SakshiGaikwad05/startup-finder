"use client";
import { useState } from "react";
import Link from "next/link";
import type { StartupView } from "@/lib/types";
import { FUNDING_LABELS } from "@/lib/funding";
import { JobCard } from "./JobCard";

export function StartupCard({ s, onChanged }: { s: StartupView; onChanged: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const relevant = s.jobs.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential");
  const others = s.jobs.filter((j) => !relevant.includes(j));
  const saved = s.applications.find((a) => a.job_id === null);
  const recentlyFunded = ["funded_30", "funded_90", "funded_180"].includes(s.funding_status);
  const careers = s.careers_url ?? s.website ?? s.source_url;
  const topJob = relevant[0];
  const appFor = (jobId: number) => s.applications.find((a) => a.job_id === jobId);

  async function save() {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startup_id: s.id, job_id: null, status: "Saved" }),
    });
    onChanged();
  }
  async function toggleShowAgain() {
    await fetch(`/api/startups/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_again: !s.show_again }),
    });
    onChanged();
  }

  const where = [
    s.location ?? (s.jobs.length ? null : "Location unknown"),
    s.location_tags.includes("Remote") ? "Remote jobs" : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/startups/${s.id}`} className="text-base font-semibold text-gray-900 hover:underline">
            {s.name}
          </Link>
          <div className="text-xs text-gray-500">
            {s.industry ?? "Category unknown"}
            {s.is_ai && s.ai_category ? ` · ${s.ai_category}` : ""}
          </div>
          <div className="text-xs text-gray-500">{where || "Location unknown"}</div>
        </div>
        {s.is_fresh && (
          <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700" title={s.last_change_reason ?? ""}>
            {s.show_again ? "Show again" : s.last_change_reason === "New discovery" ? "New today" : "Updated"}
          </span>
        )}
      </div>

      {s.description && <p className="mt-2 line-clamp-2 text-xs text-gray-600">{s.description}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {s.jobs.length > 0 ? (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">🟢 Hiring ({s.jobs.length})</span>
        ) : (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">No open jobs found</span>
        )}
        {s.is_ai === true && (
          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700" title={s.classification_reasons.join("\n")}>
            🤖 AI Startup{s.classification_confidence !== "high" ? ` (${s.classification_confidence} confidence)` : ""}
          </span>
        )}
        {s.is_ai === null && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">AI: unknown</span>}
        {recentlyFunded && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800" title={s.funding_source_url ?? ""}>
            💰 {FUNDING_LABELS[s.funding_status]}
            {s.last_funding_amount ? ` · ${s.last_funding_amount}` : ""}
            {s.funding_round ? ` · ${s.funding_round}` : ""}
          </span>
        )}
        {s.founded_year && (
          <span className={`rounded px-1.5 py-0.5 ${s.is_new_startup ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-600"}`}>
            {s.is_new_startup ? "🆕 " : ""}Founded {s.founded_year}
          </span>
        )}
      </div>

      <div className="mt-3 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Matching jobs</div>
        {relevant.length === 0 && <div className="py-1 text-xs text-gray-500">No jobs matching your profile.</div>}
        {relevant.slice(0, showAll ? undefined : 3).map((j) => (
          <JobCard key={j.id} job={j} application={appFor(j.id)} onChanged={onChanged} />
        ))}
        {showAll && others.map((j) => <JobCard key={j.id} job={j} application={appFor(j.id)} onChanged={onChanged} />)}
        {(relevant.length > 3 || others.length > 0) && (
          <button onClick={() => setShowAll(!showAll)} className="mt-1 text-xs text-gray-500 hover:text-gray-800">
            {showAll ? "Show less" : `Show all ${s.jobs.length} jobs${others.length ? ` (${others.length} not relevant)` : ""}`}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs">
        {careers && (
          <a href={careers} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
            Careers ↗
          </a>
        )}
        {topJob && (
          <a href={topJob.apply_url ?? topJob.job_url} target="_blank" rel="noreferrer" className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-700">
            Apply ↗
          </a>
        )}
        <button
          onClick={save}
          disabled={!!saved}
          className={`rounded border px-2 py-1 ${saved ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 hover:bg-gray-50"}`}
        >
          {saved ? `★ ${saved.status}` : "☆ Save"}
        </button>
        <button onClick={toggleShowAgain} className="ml-auto text-gray-400 hover:text-gray-700" title="Pin this startup to the Today view">
          {s.show_again ? "Unpin from today" : "Show again"}
        </button>
      </div>
    </article>
  );
}
