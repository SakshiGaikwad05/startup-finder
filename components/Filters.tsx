"use client";
import { LOCATION_OPTIONS } from "@/lib/types";
import { ROLE_CATEGORIES } from "@/lib/jobs/roles";
import { INDUSTRY_CATEGORIES } from "@/lib/classification";
import { STAGE_LABELS } from "@/lib/funding";
import { Icon } from "./Icon";

export {
  AMOUNT_BUCKETS,
  ARRANGEMENT_OPTIONS,
  applyFilters,
  COUNTRY_OPTIONS,
  DEFAULT_FILTERS,
  EXPERIENCE_LEVELS,
  filtersForProfile,
  FUNDING_DAY_OPTIONS,
  fundingWindow,
  STAGE_OPTIONS,
  type FilterState,
} from "@/lib/filters";
import {
  AMOUNT_BUCKETS,
  ARRANGEMENT_OPTIONS,
  COUNTRY_OPTIONS,
  DEFAULT_FILTERS,
  EXPERIENCE_LEVELS,
  FUNDING_DAY_OPTIONS,
  fundingWindow,
  STAGE_OPTIONS,
  type FilterState,
} from "@/lib/filters";

const daysLabel = (d: number) => (d === 180 ? "last 6 months" : `last ${d} days`);

const AGE_OPTIONS = [
  ["new", "New (2024+)"],
  ["early", "Early stage"],
  ["growing", "Growing"],
  ["established", "Established"],
] as const;

/** Toggle pill — easier to scan than a column of checkboxes. */
function Pill({ label, on, onClick, title }: { label: string; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
        on ? "border-brand-600 bg-brand-600 font-medium text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
      }`}
    >
      {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {label}
    </button>
  );
}

function Switch({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span className="text-sm text-gray-800">
        {label}
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

function Group({ title, children, hint, defaultOpen = true, active = 0 }: { title: string; children: React.ReactNode; hint?: string; defaultOpen?: boolean; active?: number }) {
  return (
    // A group with an active filter is always shown open, so you can see what's filtering the list.
    <details open={defaultOpen || active > 0} className="group border-t border-gray-200 py-4 first:border-t-0 first:pt-0">
      <summary className="flex list-none items-center justify-between gap-2 rounded-md text-sm font-semibold text-gray-900">
        <span className="flex items-center gap-2">
          {title}
          {active > 0 && <span className="rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold tabular-nums text-brand-700">{active}</span>}
        </span>
        <Icon name="chevron-down" className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </details>
  );
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** The filters currently narrowing the list, each with a one-click remove. Shown above the results. */
export function activeFilterChips(f: FilterState, set: (f: FilterState) => void): { key: string; label: string; remove: () => void }[] {
  const chips: { key: string; label: string; remove: () => void }[] = [];
  for (const r of f.roles ?? []) chips.push({ key: `r:${r}`, label: r, remove: () => set({ ...f, roles: (f.roles ?? []).filter((x) => x !== r) }) });
  for (const l of f.levels ?? []) {
    const label = EXPERIENCE_LEVELS.find(([k]) => k === l)?.[1] ?? l;
    chips.push({ key: `e:${l}`, label, remove: () => set({ ...f, levels: (f.levels ?? []).filter((x) => x !== l) }) });
  }
  for (const a of f.arrangements ?? [])
    chips.push({ key: `w:${a}`, label: ARRANGEMENT_OPTIONS.find(([k]) => k === a)?.[1] ?? a, remove: () => set({ ...f, arrangements: (f.arrangements ?? []).filter((x) => x !== a) }) });
  const country = f.country ?? "any";
  if (country !== "any") chips.push({ key: "c", label: COUNTRY_OPTIONS.find(([k]) => k === country)![1], remove: () => set({ ...f, country: "any" }) });
  for (const l of f.locations) chips.push({ key: `l:${l}`, label: l, remove: () => set({ ...f, locations: f.locations.filter((x) => x !== l) }) });
  for (const t of f.types ?? []) chips.push({ key: `t:${t}`, label: t, remove: () => set({ ...f, types: (f.types ?? []).filter((x) => x !== t) }) });
  const days = fundingWindow(f);
  if (days != null) chips.push({ key: "f", label: `Funded: ${daysLabel(days)}`, remove: () => set({ ...f, fundingDays: null, funding: [] }) });
  if (f.confirmedOnly) chips.push({ key: "fc", label: "Confirmed funding only", remove: () => set({ ...f, confirmedOnly: false }) });
  for (const st of f.stages ?? [])
    chips.push({ key: `s:${st}`, label: STAGE_LABELS[st as keyof typeof STAGE_LABELS] ?? st, remove: () => set({ ...f, stages: (f.stages ?? []).filter((x) => x !== st) }) });
  for (const a of f.amounts ?? [])
    chips.push({ key: `$:${a}`, label: AMOUNT_BUCKETS.find(([k]) => k === a)?.[1] ?? a, remove: () => set({ ...f, amounts: (f.amounts ?? []).filter((x) => x !== a) }) });
  for (const a of f.age) chips.push({ key: `a:${a}`, label: AGE_OPTIONS.find(([x]) => x === a)?.[1] ?? a, remove: () => set({ ...f, age: f.age.filter((x) => x !== a) }) });
  for (const r of f.relevance ?? [])
    chips.push({ key: `m:${r}`, label: r === "strong" ? "Great matches" : "Good matches", remove: () => set({ ...f, relevance: (f.relevance ?? []).filter((x) => x !== r) }) });
  if (f.hiringOnly) chips.push({ key: "hiring", label: "Verified openings", remove: () => set({ ...f, hiringOnly: false }) });
  if (f.matchingOnly) chips.push({ key: "fits", label: "Has a job that fits me", remove: () => set({ ...f, matchingOnly: false }) });
  if (f.emailOnly) chips.push({ key: "email", label: "Public contact email", remove: () => set({ ...f, emailOnly: false }) });
  if (f.search) chips.push({ key: "q", label: `“${f.search}”`, remove: () => set({ ...f, search: "" }) });
  return chips;
}

export function Filters({ f, set, defaults = DEFAULT_FILTERS }: { f: FilterState; set: (f: FilterState) => void; defaults?: FilterState }) {
  const roles = f.roles ?? [];
  const levels = f.levels ?? [];
  const types = f.types ?? [];
  const arrangements = f.arrangements ?? [];
  const stages = f.stages ?? [];
  const amounts = f.amounts ?? [];
  const country = f.country ?? "any";
  const days = fundingWindow(f);
  return (
    <div className="text-sm">
      <Group title="Country" hint="Where the startup is headquartered (not where its investors are)" active={country === "any" ? 0 : 1}>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_OPTIONS.map(([k, l]) => (
            <Pill key={k} label={l} on={country === k} onClick={() => set({ ...f, country: k })} />
          ))}
        </div>
      </Group>

      <Group
        title="Role type"
        hint={levels.length ? "Only jobs at these levels are shown" : "Pick Internship or Fresher to see entry-level jobs only"}
        active={levels.length}
      >
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map(([k, l, hint]) => (
            <Pill key={k} label={l} title={hint} on={levels.includes(k)} onClick={() => set({ ...f, levels: toggle(levels, k) })} />
          ))}
        </div>
      </Group>

      <Group title="Job role" hint={roles.length ? "Only jobs in these roles are shown" : "Leave empty to see every role"} active={roles.length}>
        <div className="flex flex-wrap gap-2">
          {ROLE_CATEGORIES.map((r) => (
            <Pill key={r} label={r} on={roles.includes(r)} onClick={() => set({ ...f, roles: toggle(roles, r) })} />
          ))}
        </div>
      </Group>

      <Group
        title="Recently funded"
        active={(days != null ? 1 : 0) + (f.confirmedOnly ? 1 : 0)}
        hint={days != null ? "By the date the round was announced" : "Any funding date"}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {FUNDING_DAY_OPTIONS.map((d) => (
              // One period at a time ("30 days" already includes "7 days").
              // Funding spans months, so picking a period looks at all startups, not just today's changes.
              // News-found startups usually have no jobs listed yet, so "Verified openings" is turned off too.
              <Pill
                key={d}
                label={`${d} days`}
                on={days === d}
                onClick={() => set(days === d ? { ...f, fundingDays: null, funding: [] } : { ...f, fundingDays: d, funding: [], view: "all", hiringOnly: false })}
              />
            ))}
            {days === 180 && <Pill label="6 months" on onClick={() => set({ ...f, fundingDays: null, funding: [] })} />}
            <Pill label="Any time" on={days == null} onClick={() => set({ ...f, fundingDays: null, funding: [] })} />
          </div>
          <Switch
            label="Confirmed announcements only"
            hint="Hide planned rounds and unconfirmed reports"
            on={!!f.confirmedOnly}
            onChange={(v) => set({ ...f, confirmedOnly: v })}
          />
        </div>
      </Group>

      <Group title="Funding stage" active={stages.length} defaultOpen={stages.length > 0}>
        <div className="flex flex-wrap gap-2">
          {STAGE_OPTIONS.map((k) => (
            <Pill key={k} label={STAGE_LABELS[k]} on={stages.includes(k)} onClick={() => set({ ...f, stages: toggle(stages, k), view: "all" })} />
          ))}
        </div>
      </Group>

      <Group title="Funding amount" active={amounts.length} defaultOpen={amounts.length > 0} hint="In US dollars. Amounts we couldn't read are hidden when this is on">
        <div className="flex flex-wrap gap-2">
          {AMOUNT_BUCKETS.map(([k, l]) => (
            <Pill key={k} label={l} on={amounts.includes(k)} onClick={() => set({ ...f, amounts: toggle(amounts, k), view: "all" })} />
          ))}
        </div>
      </Group>

      <Group title="Work arrangement" active={arrangements.length} defaultOpen={arrangements.length > 0} hint="Only what the job posting itself says">
        <div className="flex flex-wrap gap-2">
          {ARRANGEMENT_OPTIONS.map(([k, l]) => (
            <Pill key={k} label={l} on={arrangements.includes(k)} onClick={() => set({ ...f, arrangements: toggle(arrangements, k) })} />
          ))}
        </div>
      </Group>

      <Group title="Location" active={f.locations.length}>
        <div className="flex flex-wrap gap-2">
          <Pill label="Anywhere" on={f.locations.length === 0} onClick={() => set({ ...f, locations: [] })} />
          {LOCATION_OPTIONS.map((l) => (
            <Pill
              key={l}
              label={l}
              on={f.locations.includes(l)}
              onClick={() => set({ ...f, locations: toggle(f.locations, l) })}
              title={l === "Remote" ? "Remote jobs not restricted to another country" : l === "Remote - India" ? "Remote jobs explicitly open to India" : undefined}
            />
          ))}
        </div>
      </Group>

      <Group title="Show only" active={[f.hiringOnly, f.matchingOnly, f.emailOnly].filter(Boolean).length + (f.relevance ?? []).length}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["strong", "Great matches"],
              ["potential", "Good matches"],
            ].map(([k, l]) => (
              <Pill key={k} label={l} on={(f.relevance ?? []).includes(k)} onClick={() => set({ ...f, relevance: toggle(f.relevance ?? [], k) })} />
            ))}
          </div>
          <Switch
            label="Has verified job openings"
            hint="An open job read from a job board or their own careers page"
            on={f.hiringOnly}
            onChange={(v) => set({ ...f, hiringOnly: v })}
          />
          <Switch label="Has a job that fits me" hint="A great or good match" on={f.matchingOnly} onChange={(v) => set({ ...f, matchingOnly: v })} />
          <Switch label="Has public contact email" hint="Published on their own website" on={!!f.emailOnly} onChange={(v) => set({ ...f, emailOnly: v })} />
        </div>
      </Group>

      <Group title="Industry" active={types.length} defaultOpen={types.length > 0}>
        <div className="flex flex-wrap gap-2">
          <Pill label="Any" on={!types.length} onClick={() => set({ ...f, types: [] })} />
          {INDUSTRY_CATEGORIES.map((t) => (
            <Pill key={t} label={t} on={types.includes(t)} onClick={() => set({ ...f, types: toggle(types, t) })} />
          ))}
          {/* Profile preferences from onboarding that aren't one of the categories above stay removable. */}
          {types
            .filter((t) => !(INDUSTRY_CATEGORIES as readonly string[]).includes(t))
            .map((t) => (
              <Pill key={t} label={t === "AI" ? "AI (from your profile)" : t} on onClick={() => set({ ...f, types: toggle(types, t) })} />
            ))}
        </div>
      </Group>

      <Group title="Startup age" active={f.age.length} defaultOpen={f.age.length > 0}>
        <div className="flex flex-wrap gap-2">
          {AGE_OPTIONS.map(([k, l]) => (
            <Pill key={k} label={l} on={f.age.includes(k)} onClick={() => set({ ...f, age: toggle(f.age, k) })} />
          ))}
        </div>
      </Group>

      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        onClick={() => set({ ...defaults, view: f.view, sort: f.sort })}
      >
        <Icon name="refresh" className="h-3.5 w-3.5" />
        Reset to my defaults
      </button>
    </div>
  );
}
