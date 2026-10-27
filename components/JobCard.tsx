"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApplicationView, JobView } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/types";
import { MatchBadge } from "./MatchScore";
import { Avatar, Icon, type IconName } from "./Icon";
import { Dropdown } from "./Dropdown";
import { api, jsonBody } from "./api";

/** Friendlier names for the stored statuses. */
export const STATUS_LABEL: Record<string, string> = {
  "Not Applied": "Not applied",
  Saved: "Saved",
  Applied: "Applied",
  Interview: "Interviewing",
  Rejected: "Rejected",
  Offer: "Offer",
  "Not Interested": "Not interested",
};

export const STATUS_TONE: Record<string, string> = {
  "Not Applied": "bg-gray-100 text-gray-600",
  Saved: "bg-brand-100 text-brand-800",
  Applied: "bg-sky-100 text-sky-700",
  Interview: "bg-violet-100 text-violet-700",
  Offer: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-rose-100 text-rose-700",
  "Not Interested": "bg-gray-100 text-gray-500",
};

function postStatus(startupId: number, jobId: number | null, status: string) {
  return api("/api/applications", { method: "POST", ...jsonBody({ startup_id: startupId, job_id: jobId, status }) });
}

/** Status as a pill-shaped select. Used once a job is being tracked. */
export function StatusPill({ status, onChange, disabled }: { status: string; onChange: (s: string) => void; disabled?: boolean }) {
  return (
    <span className={`relative inline-flex items-center rounded-full ${STATUS_TONE[status] ?? STATUS_TONE["Not Applied"]}`}>
      <Dropdown
        label="Application status"
        value={status}
        onChange={onChange}
        disabled={disabled}
        variant="compact"
        options={APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
      />
    </span>
  );
}

function Fact({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={icon} className="h-3.5 w-3.5 text-gray-400" />
      {children}
    </span>
  );
}

export function JobCard({
  job,
  application,
  onChanged,
  showCompany,
  showScore = true,
  funding,
}: {
  job: JobView;
  application?: ApplicationView;
  onChanged?: () => void;
  showCompany?: string;
  showScore?: boolean;
  /** The startup's latest funding, shown in the job's source line. */
  funding?: FundingInfo;
}) {
  const funded = fundedLabel(funding);
  const [status, setStatus] = useState(application?.status ?? "Not Applied");
  const [busy, setBusy] = useState(false);
  const [askApplied, setAskApplied] = useState(false);
  const [failed, setFailed] = useState(false);

  // Follow the saved status when the list reloads (e.g. it was changed on another page).
  useEffect(() => setStatus(application?.status ?? "Not Applied"), [application?.status]);

  async function change(next: string) {
    const prev = status;
    setBusy(true);
    setFailed(false);
    setStatus(next); // optimistic
    setAskApplied(false);
    const { ok } = await postStatus(job.startup_id, job.id, next);
    setBusy(false);
    if (!ok) {
      setStatus(prev);
      setFailed(true);
      return;
    }
    onChanged?.();
  }

  const where =
    job.remote === "yes"
      ? `Remote${job.remote_scope ? ` (${job.remote_scope})` : ""}`
      : job.location ?? "Location not listed";
  const tracked = status !== "Not Applied";
  const applyUrl = job.apply_url ?? job.job_url;

  return (
    <div className="py-3.5">
      {showCompany && (
        <Link href={`/startups/${job.startup_id}`} className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <Avatar name={showCompany} size="sm" />
          {showCompany}
        </Link>
      )}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <h4 className="min-w-0 flex-1 basis-56 text-[15px] font-semibold leading-snug text-gray-900">{job.job_title}</h4>
        <MatchBadge match={job.match} showScore={showScore} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-gray-500">
        <Fact icon="pin">{where}</Fact>
        {job.employment_type && <Fact icon="briefcase">{job.employment_type}</Fact>}
        {job.min_experience && <Fact icon="cap">{job.min_experience}</Fact>}
        {job.salary && <Fact icon="money">{job.salary}</Fact>}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Posted {postedLabel(job.posted_date)} · Found on{" "}
        <a className="underline hover:text-gray-800" href={job.source_url ?? job.job_url} target="_blank" rel="noreferrer">
          {SOURCE_NAMES[job.source] ?? job.source}
        </a>
        {funded && <> · Funded {funded}</>}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <a
          href={applyUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            if (status === "Not Applied" || status === "Saved") setAskApplied(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Apply
          <Icon name="external" className="h-3.5 w-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {tracked ? (
          <StatusPill status={status} onChange={change} disabled={busy} />
        ) : (
          <button
            onClick={() => change("Saved")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Icon name="bookmark" className="h-3.5 w-3.5" />
            Save
          </button>
        )}
      </div>

      {failed && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] text-rose-700">
          <Icon name="alert" className="h-3.5 w-3.5" />
          Couldn&apos;t save that. Please try again.
        </p>
      )}

      {askApplied && (
        <div role="status" className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-100/60 px-3 py-2 text-[13px] text-gray-800">
          <span className="mr-auto">Did you apply? Track it so you remember to follow up.</span>
          <button onClick={() => change("Applied")} className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
            <Icon name="check" className="h-3.5 w-3.5" />
            Yes, mark applied
          </button>
          <button onClick={() => setAskApplied(false)} className="rounded-md px-2 py-1 text-gray-600 hover:text-gray-900">
            Not yet
          </button>
        </div>
      )}

    </div>
  );
}

export type FundingInfo = { last_funding_date: string | null; last_funding_amount: string | null; funding_round: string | null };

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "3 days ago" stays as is; "2026-07-10" becomes "10 Jul 2026". */
function postedLabel(posted: string | null) {
  if (!posted) return "date unknown";
  return /^\d{4}-\d{2}-\d{2}$/.test(posted) ? fmtDate(posted) : posted;
}

/** "9 Oct 2026 ($30M, Series A)" / "Jun 2026 (Y Combinator Spring 2026)" / null when unknown. */
function fundedLabel(f?: FundingInfo) {
  if (!f || (!f.last_funding_date && !f.funding_round)) return null;
  const yc = /Y Combinator/i.test(f.funding_round ?? "");
  // YC dates are approximate (Demo Day month), so show only the month.
  const when = f.last_funding_date
    ? yc && !f.last_funding_amount
      ? new Date(f.last_funding_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" })
      : fmtDate(f.last_funding_date)
    : null;
  const what = [f.last_funding_amount, f.funding_round].filter(Boolean).join(", ");
  return when ? `${when}${what ? ` (${what})` : ""}` : what;
}

export const SOURCE_NAMES: Record<string, string> = {
  yc: "Y Combinator",
  remotive: "Remotive",
  himalayas: "Himalayas",
  funding_rss: "funding news",
  company_careers: "company careers page",
  search: "web search",
};
