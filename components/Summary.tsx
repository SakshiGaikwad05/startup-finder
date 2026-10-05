import type { StartupView } from "@/lib/types";

export function Summary({ list, label }: { list: StartupView[]; label: string }) {
  const strong = list.filter((s) => s.relevance === "strong").length;
  const potential = list.filter((s) => s.relevance === "potential").length;
  const stats: [string, number][] = [
    ["Startups discovered", list.length],
    ["Relevant startups", strong + potential],
    ["AI startups", list.filter((s) => s.is_ai === true).length],
    ["Pune", list.filter((s) => s.location_tags.includes("Pune")).length],
    ["Remote", list.filter((s) => s.location_tags.includes("Remote")).length],
    ["Recently funded", list.filter((s) => ["funded_30", "funded_90", "funded_180"].includes(s.funding_status)).length],
    ["New startups", list.filter((s) => s.is_new_startup === true).length],
    ["Jobs found", list.reduce((n, s) => n + s.jobs.length, 0)],
  ];
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-emerald-700">{strong}</span> match strongly ·{" "}
          <span className="font-semibold text-amber-700">{potential}</span> potentially relevant ·{" "}
          <span className="font-semibold text-gray-500">{list.length - strong - potential}</span> low relevance
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className="text-xl font-semibold tabular-nums text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
