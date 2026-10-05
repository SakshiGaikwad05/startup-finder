import Link from "next/link";
import { notFound } from "next/navigation";
import { loadStartups } from "@/lib/discovery/read";
import { FUNDING_LABELS } from "@/lib/funding";
import { StartupJobs } from "./StartupJobs";

export const dynamic = "force-dynamic";

function Field({ label, value, href, source }: { label: string; value: React.ReactNode; href?: string | null; source?: string | null }) {
  const unknown = value === null || value === undefined || value === "";
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 border-b border-gray-100 py-1.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className={unknown ? "text-gray-400" : "text-gray-900"}>
        {unknown ? "Unknown" : href ? <a className="text-indigo-600 hover:underline" href={href} target="_blank" rel="noreferrer">{value}</a> : value}
        {source && !unknown && (
          <a href={source} target="_blank" rel="noreferrer" className="ml-2 text-xs text-gray-400 underline">
            source
          </a>
        )}
      </dd>
    </div>
  );
}

export default async function StartupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s] = await loadStartups({ id: Number(id) });
  if (!s) notFound();
  const src = (f: string) => s.field_sources[f]?.url ?? null;
  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
        ← Dashboard
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="text-2xl font-semibold">{s.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{s.description ?? "No description available."}</p>
        <dl className="mt-4">
          <Field label="Website" value={s.website} href={s.website} source={src("website")} />
          <Field label="Careers page" value={s.careers_url} href={s.careers_url} source={src("careers_url")} />
          <Field label="LinkedIn" value={s.linkedin_url} href={s.linkedin_url} source={src("linkedin_url")} />
          <Field label="Location (HQ)" value={s.location} source={src("location")} />
          <Field label="Remote jobs" value={s.remote_available === null ? null : s.remote_available ? "Yes (a job explicitly says remote)" : "No (all jobs on-site)"} />
          <Field label="Industry" value={s.industry} />
          <Field
            label="AI startup"
            value={s.is_ai === null ? null : `${s.is_ai ? "Yes" : "No"}${s.ai_category ? ` · ${s.ai_category}` : ""} (${s.classification_confidence} confidence)`}
          />
          <Field label="Why" value={s.classification_reasons.join(" · ")} />
          <Field label="Founded" value={s.founded_year} source={src("founded_year")} />
          <Field label="New startup" value={s.is_new_startup === null ? null : s.is_new_startup ? "Yes" : "No"} />
          <Field label="Funding status" value={FUNDING_LABELS[s.funding_status]} />
          <Field label="Last funding" value={[s.funding_round, s.last_funding_amount, s.last_funding_date].filter(Boolean).join(" · ") || null} source={s.funding_source_url} />
          <Field label="Investors" value={s.investors?.join(", ")} />
          <Field label="Funding source" value={s.funding_source} href={s.funding_source_url} />
          <Field label="Found via" value={s.sources_seen.join(", ")} href={s.source_url} />
          <Field label="First discovered" value={new Date(s.first_discovered_at).toLocaleString("en-IN")} />
          <Field label="Last updated" value={`${new Date(s.last_updated_at).toLocaleString("en-IN")}${s.last_change_reason ? ` — ${s.last_change_reason}` : ""}`} />
        </dl>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-2 font-semibold">Jobs ({s.jobs.length})</h2>
        <StartupJobs s={s} />
      </section>
    </div>
  );
}
