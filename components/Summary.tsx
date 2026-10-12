import type { StartupView } from "@/lib/types";
import { Icon } from "./Icon";

/** Which subset a summary tile stands for; clicking a tile filters the list to it. */
export type SummaryPick = "all" | "great" | "good" | "jobs" | "ai" | "funded" | "new" | "email";

export const isAiStartup = (s: StartupView) => s.is_ai === true || s.industry === "AI Startup";
export const isRecentlyFunded = (s: StartupView) => ["funded_30", "funded_90", "funded_180"].includes(s.funding_status);

function Tile({ label, value, hint, tone, onClick }: { label: string; value: number; hint: string; tone?: string; onClick?: () => void }) {
  const clickable = !!onClick && value > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      title={clickable ? `${hint}. Click to show them` : hint}
      className="group min-w-[112px] shrink-0 snap-start rounded-xl bg-gray-50 p-3 text-left transition-colors enabled:hover:bg-brand-50 disabled:cursor-default sm:min-w-0"
    >
      <div className={`font-display text-2xl font-bold leading-tight tabular-nums ${tone ?? "text-gray-900"}`}>{value}</div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        {label}
        {clickable && <Icon name="arrow-right" className="h-3 w-3 text-gray-400 transition-colors group-hover:text-brand-700" />}
      </div>
    </button>
  );
}

export function Summary({ list, label, onPick }: { list: StartupView[]; label: string; onPick?: (p: SummaryPick) => void }) {
  const strong = list.filter((s) => s.relevance === "strong").length;
  const potential = list.filter((s) => s.relevance === "potential").length;
  const pick = (p: SummaryPick) => (onPick ? () => onPick(p) : undefined);
  return (
    <section aria-label={label} className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
        <span className="hidden text-xs text-gray-500 sm:inline">Click a number to see those startups</span>
      </div>
      {/* Phones: one swipeable row. Larger screens: grid. */}
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-8">
        <Tile label="Startups found" value={list.length} hint="Startups in this view" onClick={pick("all")} />
        <Tile label="Great matches" value={strong} tone="text-emerald-700" hint="Have a job for your target role, in your locations, at your experience level" onClick={pick("great")} />
        <Tile label="Good matches" value={potential} tone="text-amber-700" hint="Have a job that fits, with something to check (location or role)" onClick={pick("good")} />
        <Tile label="Open jobs" value={list.reduce((n, s) => n + s.jobs.length, 0)} hint="All open jobs at these startups" onClick={pick("jobs")} />
        <Tile label="AI startups" value={list.filter(isAiStartup).length} hint="AI is central to their product" onClick={pick("ai")} />
        <Tile label="Funded recently" value={list.filter(isRecentlyFunded).length} hint="Raised money in the last 6 months" onClick={pick("funded")} />
        <Tile label="New (2024+)" value={list.filter((s) => s.is_new_startup === true).length} hint="Founded in 2024 or later" onClick={pick("new")} />
        <Tile label="With email" value={list.filter((s) => s.emails.length > 0).length} hint="A contact email is published on their website" onClick={pick("email")} />
      </div>
    </section>
  );
}
