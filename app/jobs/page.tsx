"use client";
import { useEffect, useMemo, useState } from "react";
import type { CandidateProfile, StartupView } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";
import { JobCard } from "@/components/JobCard";
import { EXPERIENCE_LEVELS, filtersForProfile } from "@/components/Filters";
import { Icon } from "@/components/Icon";
import { Banner, btnPrimary, btnSecondary, CardSkeleton, EmptyState, PageHeader } from "@/components/ui";
import { ROLE_CATEGORIES } from "@/lib/jobs/roles";

const PAGE = 40;

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-2 pl-3 pr-8 text-[13px] font-medium text-gray-900 focus:border-brand-500 focus:outline-none sm:w-auto"
      >
        {children}
      </select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
    </label>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [startups, setStartups] = useState<StartupView[] | null>(null);
  const [myLocations, setMyLocations] = useState<string[]>([]);
  const [onlyRelevant, setOnlyRelevant] = useState(true);
  const [loc, setLoc] = useState<"mine" | "any">("mine");
  const [role, setRole] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const load = async () => {
    const { ok, status, data: d, error } = await api("/api/startups");
    if (status === 401) return router.replace("/onboarding");
    if (!ok) return setError(error);
    setError(null);
    setStartups(d.startups ?? []);
    const locs = filtersForProfile(d.profile as CandidateProfile | null).locations;
    setMyLocations(locs);
    if (!locs.length) setLoc("any");
  };
  useEffect(() => {
    load();
  }, []);

  const jobs = useMemo(() => {
    const rows = (startups ?? []).flatMap((s) => s.jobs.map((j) => ({ j, s })));
    const query = q.trim().toLowerCase();
    return rows
      .filter(({ j }) => !onlyRelevant || j.match.relevance === "strong" || j.match.relevance === "potential")
      .filter(({ j }) => loc === "any" || j.location_tags.some((t) => myLocations.includes(t)))
      .filter(({ j }) => role === "all" || j.role_categories.includes(role))
      .filter(({ j }) => level === "all" || j.experience_level === level)
      .filter(({ j, s }) => !query || `${j.job_title} ${s.name}`.toLowerCase().includes(query))
      .sort((a, b) => b.j.match.match_score - a.j.match.match_score);
  }, [startups, onlyRelevant, loc, myLocations, role, level, q]);

  useEffect(() => setLimit(PAGE), [onlyRelevant, loc, role, level, q]);

  const narrowed = loc !== "any" || role !== "all" || level !== "all" || onlyRelevant || !!q;

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs for you" subtitle="Every open job we found, best match first, with when it was posted and where we found it." />

      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Search jobs</span>
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a job title or startup"
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select label="Experience needed" value={level} onChange={setLevel}>
            <option value="all">Any experience</option>
            {EXPERIENCE_LEVELS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
          <Select label="Job role" value={role} onChange={setRole}>
            <option value="all">All roles</option>
            {ROLE_CATEGORIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select label="Location" value={loc} onChange={(v) => setLoc(v as "mine" | "any")}>
            {myLocations.length > 0 && <option value="mine">My locations</option>}
            <option value="any">Anywhere</option>
          </Select>
          <label className="col-span-2 flex items-center gap-2 px-1 text-[13px] font-medium text-gray-700 sm:col-span-1 sm:ml-1">
            <input type="checkbox" checked={onlyRelevant} onChange={(e) => setOnlyRelevant(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Only jobs that fit me
          </label>
        </div>
        {loc === "mine" && myLocations.length > 0 && <p className="text-xs text-gray-500">My locations: {myLocations.join(", ")}</p>}
      </div>

      {error && (
        <Banner
          tone="error"
          action={
            <button onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm hover:bg-gray-50">
              Try again
            </button>
          }
        >
          {error}
        </Banner>
      )}

      {!startups && !error && <CardSkeleton count={2} />}

      {startups && (
        <>
          <p className="text-sm text-gray-600" aria-live="polite">
            <b className="font-semibold text-gray-900">{jobs.length}</b> job{jobs.length === 1 ? "" : "s"}
          </p>
          {jobs.length === 0 ? (
            startups.length === 0 ? (
              <EmptyState
                icon="briefcase"
                title="No jobs yet"
                actions={
                  <Link href="/dashboard" className={btnPrimary}>
                    Go to Startups
                  </Link>
                }
              >
                Check for startups first. Their open jobs show up here, ranked for you.
              </EmptyState>
            ) : (
              <EmptyState
                icon="search"
                title="No jobs match these filters"
                actions={
                  narrowed && (
                    <>
                      {onlyRelevant && (
                        <button onClick={() => setOnlyRelevant(false)} className={btnSecondary}>
                          Include weaker matches
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setLoc("any");
                          setRole("all");
                          setLevel("all");
                          setQ("");
                        }}
                        className={btnSecondary}
                      >
                        Clear filters
                      </button>
                    </>
                  )
                }
              >
                Try a different role or experience level, or look anywhere.
              </EmptyState>
            )
          ) : (
            <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-4 sm:px-5">
              {jobs.slice(0, limit).map(({ j, s }) => (
                <JobCard key={j.id} job={j} showCompany={s.name} funding={s} application={s.applications.find((a) => a.job_id === j.id)} onChanged={load} />
              ))}
            </div>
          )}
          {jobs.length > limit && (
            <div className="text-center">
              <button onClick={() => setLimit(limit + PAGE)} className={btnSecondary}>
                Show more jobs ({jobs.length - limit} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
