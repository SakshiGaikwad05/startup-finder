"use client";
import { useState } from "react";
import Link from "next/link";
import type { StartupView } from "@/lib/types";
import { JobCard } from "./JobCard";
import { MATCH_LABEL } from "./MatchScore";
import { Emails } from "./Emails";

function daysAgo(date: string) {
  const d = Math.round((Date.now() - new Date(date).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

function Chip({ children, tone = "gray", title }: { children: React.ReactNode; tone?: "gray" | "green" | "violet" | "amber" | "sky"; title?: string }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-800",
    sky: "bg-sky-50 text-sky-700",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

const HEADLINE_STYLE = {
  strong: "bg-emerald-600 text-white",
  potential: "bg-amber-500 text-white",
  low: "bg-gray-200 text-gray-600",
};

export function StartupCard({ s, onChanged }: { s: StartupView; onChanged: () => void }) {
  const [showOthers, setShowOthers] = useState(false);
  const relevant = s.jobs.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential");
  const others = s.jobs.filter((j) => !relevant.includes(j));
  const saved = s.applications.find((a) => a.job_id === null);
  const recentlyFunded = ["funded_30", "funded_90", "funded_180"].includes(s.funding_status);
  const careers = s.careers_url ?? s.website ?? s.source_url;
  const topJob = relevant[0];
  const hidden = Math.max(0, relevant.length - 3) + others.length;
  const appFor = (jobId: number) => s.applications.find((a) => a.job_id === jobId);
  const where = [s.location, s.location_tags.includes("Remote - India") ? "Remote jobs (India)" : s.location_tags.includes("Remote") ? "Remote jobs" : null]
    .filter(Boolean)
    .join(" · ");

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

  return (
    <article className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-base font-semibold text-indigo-700">
          {s.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/startups/${s.id}`} className="truncate text-base font-semibold text-gray-900 hover:text-indigo-700">
              {s.name}
            </Link>
            {s.is_fresh && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700" title={s.last_change_reason ?? ""}>
                {s.show_again ? "Pinned" : s.last_change_reason === "New discovery" ? "New" : "Updated"}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-gray-500">
            {[s.industry, s.is_ai && s.ai_category ? s.ai_category : null].filter(Boolean).join(" · ") || "Category unknown"}
            {where ? ` · 📍 ${where}` : ""}
          </div>
        </div>
        {relevant.length > 0 && (
          <div className={`shrink-0 rounded-lg px-2.5 py-1 text-center ${HEADLINE_STYLE[s.relevance]}`} title="Best job match for your profile">
            <div className="text-base font-bold leading-tight">{s.best_match}%</div>
            <div className="text-[10px] leading-tight opacity-90">{MATCH_LABEL[s.relevance === "low" ? "low" : s.relevance]}</div>
          </div>
        )}
      </div>

      {s.description && <p className="line-clamp-2 px-4 text-xs text-gray-600">{s.description}</p>}

      {/* Quick facts */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-2">
        {s.jobs.length > 0 ? <Chip tone="green">● Hiring · {s.jobs.length} open</Chip> : <Chip>No open jobs found</Chip>}
        {s.is_ai === true && (
          <Chip tone="violet" title={s.classification_reasons.join("\n")}>
            🤖 AI startup
          </Chip>
        )}
        {recentlyFunded && (
          <Chip tone="amber" title={s.funding_source ? `Source: ${s.funding_source}` : ""}>
            💰 Raised {s.last_funding_amount ?? ""}
            {s.funding_round ? ` ${s.funding_round}` : ""} · {s.last_funding_date ? daysAgo(s.last_funding_date) : ""}
          </Chip>
        )}
        {s.founded_year && <Chip tone={s.is_new_startup ? "sky" : "gray"}>{s.is_new_startup ? "🆕 " : ""}Founded {s.founded_year}</Chip>}
      </div>

      {/* Jobs */}
      <div className="mt-3 flex-1 border-t border-gray-100 px-4 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Jobs for you</div>
        {relevant.length === 0 && <div className="py-2 text-xs text-gray-500">None of their open jobs fit your profile.</div>}
        <div className="divide-y divide-gray-100">
          {relevant.slice(0, 3).map((j) => (
            <JobCard key={j.id} job={j} application={appFor(j.id)} onChanged={onChanged} />
          ))}
          {showOthers && [...relevant.slice(3), ...others].map((j) => <JobCard key={j.id} job={j} application={appFor(j.id)} onChanged={onChanged} />)}
        </div>
        {hidden > 0 && (
          <button onClick={() => setShowOthers(!showOthers)} className="py-1 text-xs text-gray-500 hover:text-gray-800">
            {showOthers ? "Show fewer jobs ▴" : `Show ${hidden} more job${hidden > 1 ? "s" : ""}${others.length ? " (incl. other roles)" : ""} ▾`}
          </button>
        )}
      </div>

      {/* Contact */}
      {s.emails.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Contact (from their website)</div>
          <Emails emails={s.emails} limit={2} />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-b-xl border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs">
        {topJob && (
          <a href={topJob.apply_url ?? topJob.job_url} target="_blank" rel="noreferrer" className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700">
            Apply to best job ↗
          </a>
        )}
        {careers && (
          <a href={careers} target="_blank" rel="noreferrer" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50">
            {s.careers_url ? "Careers page ↗" : "Website ↗"}
          </a>
        )}
        <button
          onClick={save}
          disabled={!!saved}
          className={`rounded-md border px-3 py-1.5 ${saved ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-white hover:bg-gray-50"}`}
        >
          {saved ? `★ ${saved.status}` : "☆ Save"}
        </button>
        <span className="ml-auto flex items-center gap-3">
          <button onClick={toggleShowAgain} className="text-gray-400 hover:text-gray-700" title="Keep this startup in the New & updated view">
            {s.show_again ? "Unpin" : "Pin"}
          </button>
          <Link href={`/startups/${s.id}`} className="font-medium text-gray-600 hover:text-gray-900">
            Details →
          </Link>
        </span>
      </div>
    </article>
  );
}
