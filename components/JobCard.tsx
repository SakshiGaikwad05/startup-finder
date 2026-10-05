"use client";
import { useState } from "react";
import type { ApplicationView, JobView } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/types";
import { MatchBadge, MatchWhy } from "./MatchScore";

export function StatusSelect({
  startupId,
  jobId,
  application,
  onChanged,
}: {
  startupId: number;
  jobId: number | null;
  application?: ApplicationView;
  onChanged?: () => void;
}) {
  const [status, setStatus] = useState(application?.status ?? "Not Applied");
  const [busy, setBusy] = useState(false);
  async function change(next: string) {
    setBusy(true);
    setStatus(next);
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startup_id: startupId, job_id: jobId, status: next }),
    });
    setBusy(false);
    onChanged?.();
  }
  const tracked = status !== "Not Applied";
  return (
    <select
      aria-label="Application status"
      title="Track your application"
      value={status}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className={`rounded-md border px-1.5 py-1 text-xs ${tracked ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"}`}
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}

export function JobCard({
  job,
  application,
  onChanged,
  showCompany,
}: {
  job: JobView;
  application?: ApplicationView;
  onChanged?: () => void;
  showCompany?: string;
}) {
  const [open, setOpen] = useState(false);
  const where =
    job.remote === "yes"
      ? `Remote${job.remote_scope ? ` (${job.remote_scope === "India" ? "India" : job.remote_scope})` : ""}`
      : job.location ?? "Location not listed";
  const facts = [where, job.employment_type, job.salary, job.min_experience ? `Exp: ${job.min_experience}` : null].filter(Boolean);
  return (
    <div className="py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {showCompany && <span className="text-sm text-gray-500">{showCompany} ·</span>}
            <span className="text-sm font-medium text-gray-900">{job.job_title}</span>
            <MatchBadge match={job.match} />
          </div>
          <div className="mt-0.5 truncate text-xs text-gray-500">{facts.join(" · ")}</div>
          <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">
            {open ? "Hide details ▴" : "Why this match? ▾"}
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <a
            href={job.apply_url ?? job.job_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Apply ↗
          </a>
          <StatusSelect startupId={job.startup_id} jobId={job.id} application={application} onChanged={onChanged} />
        </div>
      </div>
      {open && (
        <>
          <MatchWhy match={job.match} />
          <div className="mt-1 text-[11px] text-gray-400">
            Posted: {job.posted_date ?? "unknown"} · Found on{" "}
            <a className="underline" href={job.source_url ?? job.job_url} target="_blank" rel="noreferrer">
              {SOURCE_NAMES[job.source] ?? job.source}
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export const SOURCE_NAMES: Record<string, string> = {
  yc: "Y Combinator",
  remotive: "Remotive",
  funding_rss: "funding news",
  company_careers: "company careers page",
  search: "web search",
};
