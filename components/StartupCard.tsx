"use client";
import { useState } from "react";
import Link from "next/link";
import type { StartupView } from "@/lib/types";
import { JobCard, STATUS_LABEL } from "./JobCard";
import { Emails } from "./Emails";
import { MATCH_LABEL } from "./MatchScore";
import { Avatar, Icon, type IconName } from "./Icon";
import { api, jsonBody } from "./api";
import { COUNTRY_SHORT } from "@/lib/country";
import { STAGE_LABELS } from "@/lib/funding";
import { daysAgo, fundingAmountText, fundingDateText, FundingKindBadge } from "./format";
import { fundedWithin } from "@/lib/filters";
import { settings } from "@/config/settings";

function Fact({ icon, children, title, strong }: { icon: IconName; children: React.ReactNode; title?: string; strong?: boolean }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 ${strong ? "font-medium text-gray-800" : ""}`}>
      <Icon name={icon} className="h-4 w-4 text-gray-400" />
      {children}
    </span>
  );
}

const SCORE_TONE = {
  strong: "text-emerald-700",
  potential: "text-amber-700",
  low: "text-gray-500",
};

const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors";

export function StartupCard({ s, onChanged }: { s: StartupView; onChanged: () => void }) {
  const [showOthers, setShowOthers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const relevant = s.jobs.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential");
  const others = s.jobs.filter((j) => !relevant.includes(j));
  const saved = s.applications.find((a) => a.job_id === null);
  const recentlyFunded = fundedWithin(s, settings.addFundedWithinDays);
  const careers = s.careers_url ?? s.website ?? s.source_url;
  const first = relevant.length ? relevant.slice(0, 3) : [];
  const topJob = relevant[0];
  const rest = [...relevant.slice(3), ...others];
  const appFor = (jobId: number) => s.applications.find((a) => a.job_id === jobId);
  const remote = s.location_tags.includes("Remote - India") ? "Remote (India)" : s.location_tags.includes("Remote") ? "Remote" : null;
  const meta = [s.industry, s.is_ai && s.ai_category ? s.ai_category : null].filter(Boolean).join(" · ");
  const tag = s.is_fresh ? (s.show_again ? "Kept in New" : s.last_change_reason === "New discovery" ? "New" : "Updated") : null;

  /** Runs one card action; ignores double clicks and shows a message if the server says no. */
  async function act(url: string, init: RequestInit) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const { ok } = await api(url, init);
    setBusy(false);
    if (!ok) setFailed(true);
    else onChanged();
  }
  const save = () => act("/api/applications", { method: "POST", ...jsonBody({ startup_id: s.id, job_id: null, status: "Saved" }) });
  const toggleShowAgain = () => act(`/api/startups/${s.id}`, { method: "PATCH", ...jsonBody({ show_again: !s.show_again }) });

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <Avatar name={s.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3 className="font-display text-lg font-semibold leading-tight text-gray-900">
                <Link href={`/startups/${s.id}`} className="hover:text-brand-700 hover:underline">
                  {s.name}
                </Link>
              </h3>
              {tag && (
                <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700" title={s.last_change_reason ?? ""}>
                  {tag}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-gray-500">
              {s.hq_country ? (
                <span title={s.hq_evidence ?? undefined} className="font-medium text-gray-700">
                  {COUNTRY_SHORT[s.hq_country]}
                  {s.hq_confidence === "low" ? " (likely)" : ""}
                </span>
              ) : (
                <span title="No source says where they're headquartered">Country unknown</span>
              )}
              {s.location && s.location !== s.hq_country ? ` · HQ ${s.location}` : ""}
              {` · ${meta || "Category unknown"}`}
            </p>
          </div>
          {relevant.length > 0 && (
            <div className="shrink-0 text-right" title="Your best job match at this startup">
              <div className={`font-display text-2xl font-bold leading-none tabular-nums ${SCORE_TONE[s.relevance]}`}>{s.best_match}%</div>
              <div className="mt-1 text-xs text-gray-500">{MATCH_LABEL[s.relevance]}</div>
            </div>
          )}
        </div>

        {s.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">{s.description}</p>}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-gray-600">
          {s.jobs.length > 0 && (
            <Fact icon="briefcase" strong title="Read from a job board or their own careers page">
              {`${s.jobs.length} verified opening${s.jobs.length > 1 ? "s" : ""}`}
            </Fact>
          )}
          {remote && <Fact icon="pin">{remote}</Fact>}
          {s.is_ai === true && (
            <Fact icon="cpu" title={s.classification_reasons.join("\n")}>
              AI product
            </Fact>
          )}
          {s.founded_year && (
            <Fact icon="calendar" strong={!!s.is_new_startup} title={s.is_new_startup ? "Founded in 2024 or later" : undefined}>
              <span className={s.is_new_startup ? "text-sky-700" : ""}>
                Founded {s.founded_year}
                {s.is_new_startup ? " · new startup" : ""}
              </span>
            </Fact>
          )}
          {s.ph_launched_at && s.ph_url && (
            <Fact icon="rocket" title="Launch date and upvotes from Product Hunt">
              <a href={s.ph_url} target="_blank" rel="noreferrer" className="hover:underline">
                Launched on Product Hunt {daysAgo(s.ph_launched_at)}
                {s.ph_votes ? ` · ${s.ph_votes.toLocaleString("en-IN")} upvotes` : ""}
              </a>
            </Fact>
          )}
        </div>

        {(s.funding_round || s.last_funding_amount) && (
          <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Icon name="money" className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">
                {[s.funding_stage && s.funding_stage !== "other" ? STAGE_LABELS[s.funding_stage] : s.funding_round, fundingAmountText(s)].filter(Boolean).join(" · ") ||
                  "Funding round"}
              </span>
              <FundingKindBadge kind={s.funding_kind} />
              {s.funding_conflicts.length > 0 && (
                <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700" title={s.funding_conflicts.join("\n")}>
                  Sources disagree
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-6 text-xs text-gray-500">
              <span title={recentlyFunded || s.funding_date_approximate ? undefined : "Older than 6 months"}>
                {fundingDateText(s)}
              </span>
              {s.funding_source_url && (
                <a href={s.funding_source_url} target="_blank" rel="noreferrer" className="underline hover:text-gray-800">
                  Source: {s.funding_source ?? "article"}
                </a>
              )}
              {s.funding_verification_url && (
                <a href={s.funding_verification_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline hover:text-emerald-900" title="A second, independent outlet reported the same round">
                  Independently confirmed
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {s.jobs.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-3 text-[13px] text-gray-600 sm:px-5">
          No verified opening found. Funding doesn&apos;t always mean they&apos;re hiring, so check by hand:{" "}
          {s.careers_url ? (
            <a href={s.careers_url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">
              careers page
            </a>
          ) : (
            <span className="text-gray-500">careers page not publicly available</span>
          )}
          {" · "}
          <a
            href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(s.name)}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-700 underline"
          >
            LinkedIn Jobs search
          </a>
        </div>
      )}

      {s.jobs.length > 0 && (
        <div className="border-t border-gray-100 px-4 sm:px-5">
          {first.length > 0 ? (
            <>
              <h4 className="pt-3.5 text-[13px] font-semibold text-gray-500">Jobs that fit you</h4>
              <div className="divide-y divide-gray-100">
                {first.map((j) => (
                  <JobCard key={j.id} job={j} application={appFor(j.id)} onChanged={onChanged} showScore={false} funding={s} />
                ))}
              </div>
            </>
          ) : (
            <p className="pt-3.5 text-sm text-gray-500">None of their open jobs fit your profile right now.</p>
          )}
          {showOthers && (
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {rest.map((j) => (
                <JobCard key={j.id} job={j} application={appFor(j.id)} onChanged={onChanged} showScore={false} funding={s} />
              ))}
            </div>
          )}
          {rest.length > 0 ? (
            <button
              onClick={() => setShowOthers(!showOthers)}
              aria-expanded={showOthers}
              className="-mx-2 mb-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              {showOthers ? "Show fewer jobs" : first.length ? `Show ${rest.length} more job${rest.length > 1 ? "s" : ""}${others.length ? " (incl. other roles)" : ""}` : `See their ${rest.length} open job${rest.length > 1 ? "s" : ""}`}
              <Icon name={showOthers ? "chevron-up" : "chevron-down"} className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="pb-1" />
          )}
        </div>
      )}

      {s.emails.length > 0 ? (
        <div className="border-t border-gray-100 px-4 py-3.5 sm:px-5">
          <h4 className="mb-2 text-[13px] font-semibold text-gray-500">Public contact (from their own website)</h4>
          <Emails emails={s.emails} limit={2} />
        </div>
      ) : (
        <p className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 sm:px-5">Public contact email: not publicly available</p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
        {topJob && (
          <a href={topJob.apply_url ?? topJob.job_url} target="_blank" rel="noreferrer" className={`${btn} bg-brand-600 font-semibold text-white hover:bg-brand-700`}>
            Apply to best job
            <Icon name="external" className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        <button
          onClick={save}
          disabled={!!saved || busy}
          className={`${btn} ${saved ? "bg-brand-100 text-brand-800" : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"}`}
          title={saved ? "In your Applications list" : "Add to your Applications list"}
        >
          <Icon name="bookmark" filled={!!saved} className="h-3.5 w-3.5" />
          {saved ? STATUS_LABEL[saved.status] ?? "Saved" : "Save startup"}
        </button>
        {careers && (
          <a href={careers} target="_blank" rel="noreferrer" className={`${btn} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}>
            {s.careers_url ? "Careers page" : s.website ? "Website" : "Source article"}
            <Icon name="external" className="h-3.5 w-3.5 text-gray-400" />
          </a>
        )}
        <span className="ml-auto flex items-center gap-1">
          <span className="hidden px-1 text-xs text-gray-400 md:inline" title={`Last verified ${new Date(s.last_verified_at).toLocaleString("en-IN")}`}>
            Verified {daysAgo(s.last_verified_at)}
          </span>
          <button
            onClick={toggleShowAgain}
            disabled={busy}
            className={`${btn} px-2 ${s.show_again ? "text-brand-700" : "text-gray-500 hover:text-gray-800"}`}
            title={s.show_again ? "Stop keeping this startup in the New list" : "Keep this startup in the New list so you can come back to it"}
            aria-pressed={s.show_again}
            aria-label="Keep in New list"
          >
            <Icon name="star" filled={s.show_again} className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{s.show_again ? "Kept in New" : "Keep in New"}</span>
          </button>
          <Link href={`/startups/${s.id}`} className={`${btn} px-2 text-gray-700 hover:text-gray-900`}>
            Details
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        </span>
        {failed && (
          <p role="alert" className="flex w-full items-center gap-1.5 text-[13px] text-rose-700">
            <Icon name="alert" className="h-3.5 w-3.5" />
            Couldn&apos;t save that. Please try again.
          </p>
        )}
      </div>
    </article>
  );
}
