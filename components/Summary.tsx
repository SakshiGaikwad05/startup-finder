import type { StartupView } from "@/lib/types";

function Tile({ label, value, hint, tone = "text-gray-900" }: { label: string; value: number; hint: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3" title={hint}>
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export function Summary({ list, label }: { list: StartupView[]; label: string }) {
  const strong = list.filter((s) => s.relevance === "strong").length;
  const potential = list.filter((s) => s.relevance === "potential").length;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{label}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Tile label="Startups found" value={list.length} hint="Startups in this view" />
        <Tile label="Great matches" value={strong} tone="text-emerald-700" hint="Have a job for your target role, in Pune / remote India, at your experience level" />
        <Tile label="Good matches" value={potential} tone="text-amber-600" hint="Have a job that fits, with something to check (location or role)" />
        <Tile label="Open jobs" value={list.reduce((n, s) => n + s.jobs.length, 0)} hint="All open jobs at these startups" />
        <Tile label="AI startups" value={list.filter((s) => s.is_ai === true).length} hint="AI is central to their product" />
        <Tile label="Funded recently" value={list.filter((s) => ["funded_30", "funded_90", "funded_180"].includes(s.funding_status)).length} hint="Raised money in the last 6 months" />
        <Tile label="New (2024+)" value={list.filter((s) => s.is_new_startup === true).length} hint="Founded in 2024 or later" />
        <Tile label="With email" value={list.filter((s) => s.emails.length > 0).length} hint="A contact email is published on their website" />
      </div>
    </section>
  );
}
