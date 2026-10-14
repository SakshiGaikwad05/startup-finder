"use client";
// Open source: GitHub repos of YC open-source companies, each with one suggested beginner issue.
// Data comes from YC (company list + GitHub account) and GitHub's public search. Nothing is invented.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/components/api";
import { Pill } from "@/components/Filters";
import { Icon } from "@/components/Icon";
import { daysAgo } from "@/components/format";
import { Banner, btnPrimary, btnSecondary, CardSkeleton, EmptyState, PageHeader, Select } from "@/components/ui";

interface Project {
  repo: string;
  /** 'yc' = a YC open-source company's repo; 'popular' = an active, well-starred GitHub project. */
  origin: "yc" | "popular";
  stars: number | null;
  language: string | null;
  repo_description: string | null;
  github_org: string;
  company_name: string;
  company_yc_url: string | null;
  company_website: string | null;
  one_liner: string | null;
  yc_batch: string | null;
  hiring: boolean;
  beginner_issues: number;
  issue_title: string;
  issue_url: string;
  issue_labels: string[];
  issue_comments: number;
  issue_updated_at: string | null;
}
interface Stats {
  companies: number;
  with_github: number;
  last_search: string | null;
}

/** GitHub's issue list for this repo, filtered to beginner labels. */
const beginnerIssuesUrl = (repo: string) =>
  `https://github.com/${repo}/issues?q=${encodeURIComponent('is:issue is:open no:assignee label:"good first issue"')}`;

const recentBatch = (b: string | null) => !!b && /(2025|2026)/.test(b);

/** 96235 → "96.2k". */
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));

type Origin = "all" | "yc" | "popular";

function ProjectCard({ p }: { p: Project }) {
  const [owner, name] = p.repo.split("/");
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`https://github.com/${p.repo}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-display text-lg font-semibold text-gray-900 hover:text-brand-700"
          >
            <Icon name="github" className="h-5 w-5" />
            <span className="break-all">
              <span className="font-normal text-gray-500">{owner}/</span>
              {name}
            </span>
          </a>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-gray-600">
            {p.origin === "yc" ? (
              p.company_yc_url ? (
                <a href={p.company_yc_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {p.company_name}
                </a>
              ) : (
                <span className="font-medium">{p.company_name}</span>
              )
            ) : (
              <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">Popular on GitHub</span>
            )}
            {p.yc_batch && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">YC {p.yc_batch}</span>}
            {p.hiring && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">Hiring</span>}
            {p.stars != null && (
              <span className="inline-flex items-center gap-1" title={`${p.stars.toLocaleString("en-IN")} stars`}>
                <Icon name="star" className="h-3.5 w-3.5 text-amber-500" />
                {compact(p.stars)}
              </span>
            )}
            {p.language && <span>{p.language}</span>}
          </p>
          {(p.one_liner || p.repo_description) && <p className="mt-1 text-sm text-gray-600">{p.one_liner || p.repo_description}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          {p.beginner_issues} beginner issue{p.beginner_issues === 1 ? "" : "s"}
        </span>
      </div>

      {/* The one issue we suggest starting with. */}
      <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Suggested issue</p>
        <a href={p.issue_url} target="_blank" rel="noreferrer" className="mt-1 block font-medium text-gray-900 hover:text-brand-700 hover:underline">
          {p.issue_title}
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
          {p.issue_labels.slice(0, 4).map((l) => (
            <span key={l} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-gray-200">
              {l}
            </span>
          ))}
          <span className="ml-1">
            {p.issue_comments} comment{p.issue_comments === 1 ? "" : "s"}
            {p.issue_updated_at && ` · updated ${daysAgo(p.issue_updated_at)}`}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={p.issue_url} target="_blank" rel="noreferrer" className={`${btnPrimary} px-3 py-2 text-[13px]`}>
          Open issue <Icon name="external" className="h-3.5 w-3.5" />
        </a>
        <a href={`https://github.com/${p.repo}`} target="_blank" rel="noreferrer" className={`${btnSecondary} px-3 py-2 text-[13px]`}>
          <Icon name="github" className="h-3.5 w-3.5" /> View repo
        </a>
        {p.beginner_issues > 1 && (
          <a href={beginnerIssuesUrl(p.repo)} target="_blank" rel="noreferrer" className={`${btnSecondary} px-3 py-2 text-[13px]`}>
            All beginner issues
          </a>
        )}
        {p.company_website && (
          <a href={p.company_website} target="_blank" rel="noreferrer" className={`${btnSecondary} px-3 py-2 text-[13px]`}>
            <Icon name="globe" className="h-3.5 w-3.5" /> Website
          </a>
        )}
      </div>
    </article>
  );
}

export default function OpenSourcePage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [hiring, setHiring] = useState(false);
  const [recent, setRecent] = useState(false);
  const [origin, setOrigin] = useState<Origin>("all");
  const [language, setLanguage] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data, error } = await api<{ projects: Project[]; stats: Stats }>("/api/open-source");
    setLoading(false);
    if (!ok) return setError(error);
    setError(null);
    setProjects(data.projects ?? []);
    setStats(data.stats ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (projects ?? []).filter(
      (p) =>
        (origin === "all" || p.origin === origin) &&
        (language === "all" || p.language === language) &&
        (!hiring || p.hiring) &&
        (!recent || recentBatch(p.yc_batch)) &&
        (!query || `${p.repo} ${p.company_name} ${p.one_liner ?? ""} ${p.repo_description ?? ""} ${p.issue_title}`.toLowerCase().includes(query))
    );
  }, [projects, q, hiring, recent, origin, language]);

  // Languages present, most common first (only popular projects report one).
  const languages = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of projects ?? []) if (p.language) count.set(p.language, (count.get(p.language) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  }, [projects]);
  const counts = { yc: (projects ?? []).filter((p) => p.origin === "yc").length, popular: (projects ?? []).filter((p) => p.origin === "popular").length };

  const narrowed = !!q || hiring || recent || origin !== "all" || language !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Open source"
        subtitle="Open-source projects by YC companies and popular GitHub projects, each with a beginner-friendly issue to start on. Contributing is a great way to get noticed."
        actions={
          <button onClick={load} disabled={loading} className={btnSecondary}>
            <Icon name={loading ? "spinner" : "refresh"} className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Search projects</span>
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a repo, company or issue"
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3.5 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Pill label="All" on={origin === "all"} onClick={() => setOrigin("all")} />
          <Pill label={`YC companies (${counts.yc})`} on={origin === "yc"} onClick={() => setOrigin("yc")} title="Repos of YC companies tagged Open Source" />
          <Pill
            label={`Popular projects (${counts.popular})`}
            on={origin === "popular"}
            onClick={() => setOrigin("popular")}
            title="Active GitHub projects with 1,000+ stars that keep good first issues open"
          />
          {languages.length > 0 && (
            <Select label="Language" value={language} onChange={setLanguage}>
              <option value="all">Any language</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill label="Company is hiring" on={hiring} onClick={() => setHiring(!hiring)} title="The YC company has open jobs" />
          <Pill label="YC 2025–2026" on={recent} onClick={() => setRecent(!recent)} title="Companies from the 2025 and 2026 YC batches" />
        </div>
        <p className="text-xs text-gray-500">
          Issues are open, unassigned and labelled good first issue or help wanted. Read the issue and comment before starting, so the
          maintainers know you&apos;re on it.
        </p>
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

      {!projects && !error && <CardSkeleton count={3} />}

      {projects && (
        <>
          <p className="text-sm text-gray-600" aria-live="polite">
            <b className="font-semibold text-gray-900">{shown.length}</b> project{shown.length === 1 ? "" : "s"}
            {stats?.last_search && <span className="text-gray-500"> · GitHub checked {daysAgo(stats.last_search)}</span>}
          </p>

          {shown.length === 0 &&
            (projects.length === 0 ? (
              <EmptyState
                icon="github"
                title="No open-source projects yet"
                actions={
                  <Link href="/dashboard" className={btnPrimary}>
                    Go to Startups
                  </Link>
                }
              >
                Projects are found during a search. Click <b>Find Startups Today</b> on the Startups page, then come back in a few minutes.
              </EmptyState>
            ) : (
              <EmptyState
                icon="search"
                title="No projects match"
                actions={
                  narrowed && (
                    <button
                      onClick={() => {
                        setQ("");
                        setHiring(false);
                        setRecent(false);
                        setOrigin("all");
                        setLanguage("all");
                      }}
                      className={btnSecondary}
                    >
                      Clear filters
                    </button>
                  )
                }
              >
                Try a different search or turn off a filter.
              </EmptyState>
            ))}

          <div className="space-y-4">
            {shown.map((p) => (
              <ProjectCard key={p.repo} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
