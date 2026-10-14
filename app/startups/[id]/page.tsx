import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/users";
import { loadStartups } from "@/lib/discovery/read";
import { FUNDING_LABELS, KIND_LABELS, STAGE_LABELS } from "@/lib/funding";
import { fmtDate, fundingAmountText, fundingDateText, FundingKindBadge, formatUsd } from "@/components/format";
import { StartupJobs } from "./StartupJobs";
import { Emails } from "@/components/Emails";
import { Avatar, Icon, type IconName } from "@/components/Icon";
import { btnPrimary, btnSecondary } from "@/components/ui";

export const dynamic = "force-dynamic";

function Fact({ icon, label, value, source }: { icon: IconName; label: string; value: React.ReactNode; source?: string | null }) {
  const unknown = value === null || value === undefined || value === "";
  return (
    <div className="flex gap-3 rounded-xl bg-gray-50 p-3.5">
      <Icon name={icon} className="mt-0.5 h-4 w-4 text-gray-400" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-gray-500">{label}</dt>
        <dd className={`mt-0.5 break-words text-sm [overflow-wrap:anywhere] ${unknown ? "text-gray-400" : "font-medium text-gray-900"}`}>
          {unknown ? "Not known" : value}
          {source && !unknown && (
            <a href={source} target="_blank" rel="noreferrer" className="ml-1.5 text-xs font-normal text-gray-400 underline hover:text-gray-700">
              source
            </a>
          )}
        </dd>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: React.ReactNode; href?: string | null }) {
  const unknown = value === null || value === undefined || value === "";
  return (
    // Phones: label above value. Long URLs wrap instead of pushing the page wider than the screen.
    <div className="grid grid-cols-1 gap-0.5 border-b border-gray-100 py-2.5 text-sm last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`min-w-0 break-words [overflow-wrap:anywhere] ${unknown ? "text-gray-400" : "text-gray-900"}`}>
        {unknown ? "Not known" : href ? <a className="text-brand-700 hover:underline" href={href} target="_blank" rel="noreferrer">{value}</a> : value}
      </dd>
    </div>
  );
}

export default async function StartupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  const [s] = await loadStartups(user, { id: Number(id) });
  if (!s) notFound();
  const src = (f: string) => s.field_sources[f]?.url ?? null;
  const funding = [s.funding_round, fundingAmountText(s), s.last_funding_date && !s.funding_date_approximate ? fmtDate(s.last_funding_date) : null]
    .filter(Boolean)
    .join(" · ");
  const confirmedReports = s.funding_reports.filter((r) => r.kind === "confirmed");
  const otherReports = s.funding_reports.filter((r) => r.kind !== "confirmed");
  const fitting = s.jobs.filter((j) => j.match.relevance === "strong" || j.match.relevance === "potential").length;

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900">
        <Icon name="arrow-left" className="h-4 w-4" />
        All startups
      </Link>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <Avatar name={s.name} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{s.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {[s.hq_country ?? "Country unknown", s.categories.join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-3xl leading-relaxed text-gray-700">{s.description ?? "No description available yet."}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {s.careers_url && (
            <a href={s.careers_url} target="_blank" rel="noreferrer" className={btnPrimary}>
              Careers page
              <Icon name="external" className="h-4 w-4" />
            </a>
          )}
          {s.website && (
            <a href={s.website} target="_blank" rel="noreferrer" className={btnSecondary}>
              <Icon name="globe" className="h-4 w-4 text-gray-400" />
              Website
            </a>
          )}
          {s.linkedin_url && (
            <a href={s.linkedin_url} target="_blank" rel="noreferrer" className={btnSecondary}>
              <Icon name="link" className="h-4 w-4 text-gray-400" />
              LinkedIn
            </a>
          )}
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            icon="pin"
            label="Headquarters"
            value={[s.location, s.hq_country && s.location !== s.hq_country ? s.hq_country : null].filter(Boolean).join(", ") || null}
            source={s.hq_source_url ?? src("location")}
          />
          <Fact icon="globe" label="Other locations" value={s.other_locations.length ? s.other_locations.join(" · ") : null} />
          <Fact
            icon="globe"
            label="Remote jobs"
            value={s.remote_available === null ? null : s.remote_available ? "Yes, at least one job is remote" : "No, all jobs are on-site"}
          />
          <Fact icon="calendar" label="Founded" value={s.founded_year} source={src("founded_year")} />
          <Fact icon="money" label="Last funding" value={funding || null} source={s.funding_source_url} />
          <Fact icon="user" label="Investors" value={s.investors?.join(", ")} />
          <Fact icon="cpu" label="AI product" value={s.is_ai === null ? null : s.is_ai ? `Yes${s.ai_category ? `, ${s.ai_category}` : ""}` : "No"} />
          <Fact icon="calendar" label="Last verified" value={new Date(s.last_verified_at).toLocaleString("en-IN")} />
        </dl>
        {s.hq_evidence && (
          <p className="mt-3 text-xs text-gray-500">
            Country from: {s.hq_evidence}
            {s.hq_confidence === "low" ? " (low confidence: no source states the headquarters directly)" : ""}.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-gray-900">Founders</h2>
        {s.founders.length ? (
          <ul className="mt-3 space-y-1.5 text-sm">
            {s.founders.map((f) => (
              <li key={f.name} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium text-gray-900">{f.name}</span>
                {f.title && <span className="text-gray-500">{f.title}</span>}
                {f.profile_url ? (
                  <a href={f.profile_url} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                    profile
                  </a>
                ) : (
                  <span className="text-gray-400">profile not publicly available</span>
                )}
                <a href={f.source_url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 underline">
                  source
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-500">Not publicly available from our sources. Founders are only listed when a public company page (e.g. YC) names them.</p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Funding evidence</h2>
          <FundingKindBadge kind={s.funding_kind} />
        </div>
        <dl className="mt-3">
          <Row
            label="Round"
            value={
              s.funding_stage && s.funding_stage !== "other"
                ? `${STAGE_LABELS[s.funding_stage]}${s.funding_round && s.funding_round.toLowerCase() !== STAGE_LABELS[s.funding_stage].toLowerCase() ? ` (${s.funding_round})` : ""}`
                : s.funding_round
            }
          />
          <Row label="Amount" value={fundingAmountText(s)} />
          <Row
            label="Announced"
            value={s.last_funding_date ? (s.funding_date_approximate ? fundingDateText(s) : `${fmtDate(s.last_funding_date)} (earliest confirmed report)`) : null}
          />
          <Row label="Status" value={s.funding_kind ? KIND_LABELS[s.funding_kind] : null} />
          <Row label="Source" value={s.funding_source} href={s.funding_source_url} />
          <Row label="Independent confirmation" value={s.funding_verification_url ? "Another outlet reported the same round" : "None found yet"} href={s.funding_verification_url} />
        </dl>
        {s.funding_conflicts.length > 0 && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            <p className="font-semibold">Sources disagree</p>
            <ul className="mt-1 list-disc pl-5">
              {s.funding_conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {confirmedReports.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-gray-700">Confirmed reports</h3>
            <ul className="mt-1 space-y-1 text-sm text-gray-700">
              {confirmedReports.map((r) => (
                <li key={r.url || r.source}>
                  {r.date ? fmtDate(r.date) : "Undated"} · {[r.round, r.amount, r.amount_usd && r.currency !== "USD" ? `≈ ${formatUsd(r.amount_usd)}` : null].filter(Boolean).join(" · ") || "Round details not stated"} ·{" "}
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                      {r.source}
                    </a>
                  ) : (
                    r.source
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {otherReports.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-amber-800">Unverified: planned rounds and unconfirmed reports</h3>
            <ul className="mt-1 space-y-1 text-sm text-gray-600">
              {otherReports.map((r) => (
                <li key={r.url || r.source}>
                  {r.date ? fmtDate(r.date) : "Undated"} · {KIND_LABELS[r.kind]} · {[r.round, r.amount].filter(Boolean).join(" · ") || "No details"} ·{" "}
                  <a href={r.url} target="_blank" rel="noreferrer" className="underline">
                    {r.source}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-gray-900">Open jobs</h2>
        <p className="mt-1 text-sm text-gray-600">
          {s.jobs.length
            ? `${s.jobs.length} verified opening${s.jobs.length > 1 ? "s" : ""} (read from a job board or their careers page), ${fitting} that fit${fitting === 1 ? "s" : ""} your profile.`
            : "No verified opening found. Funding doesn't always mean they're hiring. Check their careers page or LinkedIn Jobs by hand."}
        </p>
        <div className="mt-2 divide-y divide-gray-100">
          <StartupJobs s={s} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-gray-900">Contact</h2>
        <p className="mb-4 mt-1 text-sm text-gray-600">
          Only addresses published on {s.domain ?? "their website"} itself. We never guess emails. &ldquo;Receives mail&rdquo; means the domain has mail
          servers; it doesn&apos;t guarantee a particular inbox is read.
        </p>
        <Emails emails={s.emails} checked />
      </section>

      <details className="group rounded-2xl border border-gray-200 bg-white">
        <summary className="flex list-none items-center justify-between gap-3 rounded-2xl p-5 sm:px-7">
          <span>
            <span className="block font-semibold text-gray-900">How we found this startup</span>
            <span className="block text-sm text-gray-500">Sources, dates and how we classified it</span>
          </span>
          <Icon name="chevron-down" className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="px-5 pb-5 sm:px-7">
          <Row label="Found via" value={s.sources_seen.join(", ")} href={s.source_url} />
          <Row label="Funding status" value={FUNDING_LABELS[s.funding_status]} />
          <Row label="Funding source" value={s.funding_source} href={s.funding_source_url} />
          <Row label="Careers page" value={s.careers_url} href={s.careers_url} />
          <Row
            label="AI classification"
            value={s.is_ai === null ? null : `${s.is_ai ? "AI startup" : "Not an AI startup"} (${s.classification_confidence} confidence)`}
          />
          <Row label="Why" value={s.classification_reasons.join(" · ")} />
          <Row label="New startup" value={s.is_new_startup === null ? null : s.is_new_startup ? "Yes" : "No"} />
          <Row label="First found" value={new Date(s.first_discovered_at).toLocaleString("en-IN")} />
          <Row label="Last updated" value={`${new Date(s.last_updated_at).toLocaleString("en-IN")}${s.last_change_reason ? ` (${s.last_change_reason})` : ""}`} />
        </dl>
      </details>
    </div>
  );
}
