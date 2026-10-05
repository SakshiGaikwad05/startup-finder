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
  return (
    <select
      aria-label="Application status"
      value={status}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs"
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
  const loc = job.remote === "yes" ? `${job.location ?? "Remote"}` : job.location ?? "Location unknown";
  return (
    <div className="border-t border-gray-100 py-2 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(!open)} className="text-left text-sm font-medium text-gray-900 hover:underline" title="Show why this matches">
          {showCompany ? <span className="text-gray-500">{showCompany} · </span> : null}
          {job.job_title}
        </button>
        <MatchBadge match={job.match} />
        <span className="text-xs text-gray-500">{loc}</span>
        {job.remote === "yes" && <span className="rounded bg-sky-50 px-1 text-xs text-sky-700">Remote{job.remote_scope ? ` · ${job.remote_scope}` : ""}</span>}
        {job.salary && <span className="text-xs text-gray-500">{job.salary}</span>}
        <span className="ml-auto flex items-center gap-2">
          <a href={job.apply_url ?? job.job_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 hover:underline">
            Apply ↗
          </a>
          <StatusSelect startupId={job.startup_id} jobId={job.id} application={application} onChanged={onChanged} />
        </span>
      </div>
      {open && (
        <>
          <MatchWhy match={job.match} />
          <div className="mt-1 text-xs text-gray-400">
            {job.employment_type ?? "Type unknown"} · Posted: {job.posted_date ?? "unknown"} · Min. experience: {job.min_experience ?? "not stated"} · Source:{" "}
            <a className="underline" href={job.source_url ?? job.job_url} target="_blank" rel="noreferrer">
              {job.source}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
