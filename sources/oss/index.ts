// Open-source projects to contribute to, from two real sources:
// A) YC companies tagged "Open Source" (yc-oss dataset) → their GitHub account from the YC company
//    page (stored in oss_orgs, re-checked monthly) → beginner issues in that account's repos.
// B) Popular, active GitHub projects: GitHub's repository search for repos with several open
//    good-first-issues, many stars and recent pushes → beginner issues in those repos.
// Results go to oss_projects, one row per repo with one suggested issue. Nothing is guessed: a repo
// without an open, unassigned beginner issue simply isn't listed.
// Runs as an enricher; it stores its own table and returns no startups.
import type { DiscoveryContext, StartupSource } from "@/lib/types";
import { cachedJson, cachedText, isCached } from "@/lib/http";
import { query } from "@/lib/database";
import { settings } from "@/config/settings";
import { githubAccountUrl, parseYcPage } from "@/sources/yc";

const TAG_URL = "https://yc-oss.github.io/api/tags/open-source.json";
const YC = "https://www.ycombinator.com";
const API = "https://api.github.com";
/** GitHub ORs a comma-separated label list. */
const BEGINNER_LABELS = `label:"good first issue","good-first-issue","help wanted"`;

interface OssCompany {
  name: string;
  slug: string;
  website: string;
  one_liner: string;
  batch: string;
  status: string;
  isHiring: boolean;
  launched_at: number;
}

export interface GhIssue {
  title: string;
  html_url: string;
  repository_url: string; // https://api.github.com/repos/<owner>/<name>
  labels: { name: string }[];
  comments: number;
  updated_at: string;
  pull_request?: unknown;
}

interface GhRepo {
  full_name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  language: string | null;
  homepage: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const daysAgoDate = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** "owner/name" from an issue's repository_url. */
export const repoOf = (i: Pick<GhIssue, "repository_url">) => i.repository_url.split("/repos/")[1] ?? "";

/** The issue to suggest: labelled "good first issue" first, then fewest comments (least taken), then most recently updated. */
export function pickSuggestedIssue(issues: GhIssue[]): GhIssue {
  const gfi = (i: GhIssue) => i.labels.some((l) => /^good[\s-]first[\s-]issue$/i.test(l.name));
  return [...issues].sort(
    (a, b) => Number(gfi(b)) - Number(gfi(a)) || a.comments - b.comments || b.updated_at.localeCompare(a.updated_at)
  )[0];
}

/** Beginner-issue search scoped to accounts (`user:` works for organisations and personal accounts) or to repos. */
export function beginnerIssueQuery(scope: string[], since: string, kind: "user" | "repo" = "user"): string {
  return `is:issue is:open no:assignee archived:false ${BEGINNER_LABELS} updated:>=${since} ${scope.map((s) => `${kind}:${s}`).join(" ")}`;
}

/** Repository search for active, well-starred projects that maintain good-first-issues. */
export function popularRepoQuery(minStars: number, pushedSince: string): string {
  return `good-first-issues:>=3 stars:>=${minStars} archived:false is:public pushed:>=${pushedSince}`;
}

/** GitHub search with the rate limit respected: 10 requests/minute without a token, 30 with one. Cached. */
function githubSearcher(log: (m: string) => void) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const gap = token ? 2_100 : 6_500;
  let calls = 0;
  let stopped = false;
  return {
    get stopped() {
      return stopped;
    },
    async search<T>(path: string, q: string, extra: string): Promise<T[] | null> {
      if (stopped) return null;
      const url = `${API}${path}?q=${encodeURIComponent(q)}&${extra}`;
      const cached = isCached(url, settings.cacheHours.githubSearch);
      if (calls > 0 && !cached) await sleep(gap);
      if (!cached) calls++;
      try {
        return (await cachedJson<{ items: T[] }>(url, settings.cacheHours.githubSearch, { headers })).items ?? [];
      } catch (e) {
        log(`Open source: GitHub search failed (${(e as Error).message}); the rest waits for the next run.`);
        stopped = true; // most likely the rate limit
        return null;
      }
    },
  };
}

interface ProjectRow {
  repo: string;
  origin: "yc" | "popular";
  github_org: string;
  company_name: string;
  company_yc_url: string | null;
  company_website: string | null;
  one_liner: string | null;
  yc_batch: string | null;
  hiring: boolean;
  stars: number | null;
  language: string | null;
  repo_description: string | null;
}

async function saveProject(p: ProjectRow, issues: GhIssue[]) {
  const pick = pickSuggestedIssue(issues);
  await query(
    `INSERT INTO oss_projects (repo, origin, github_org, company_name, company_yc_url, company_website, one_liner, yc_batch, hiring,
       stars, language, repo_description, beginner_issues, issue_title, issue_url, issue_labels, issue_comments, issue_updated_at, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
     ON CONFLICT (repo) DO UPDATE SET origin = EXCLUDED.origin, github_org = EXCLUDED.github_org, company_name = EXCLUDED.company_name,
       company_yc_url = EXCLUDED.company_yc_url, company_website = EXCLUDED.company_website, one_liner = EXCLUDED.one_liner,
       yc_batch = EXCLUDED.yc_batch, hiring = EXCLUDED.hiring,
       stars = COALESCE(EXCLUDED.stars, oss_projects.stars), language = COALESCE(EXCLUDED.language, oss_projects.language),
       repo_description = COALESCE(EXCLUDED.repo_description, oss_projects.repo_description),
       beginner_issues = EXCLUDED.beginner_issues, issue_title = EXCLUDED.issue_title, issue_url = EXCLUDED.issue_url,
       issue_labels = EXCLUDED.issue_labels, issue_comments = EXCLUDED.issue_comments, issue_updated_at = EXCLUDED.issue_updated_at,
       fetched_at = now()`,
    [
      p.repo, p.origin, p.github_org, p.company_name, p.company_yc_url, p.company_website, p.one_liner, p.yc_batch, p.hiring,
      p.stars, p.language, p.repo_description, issues.length, pick.title, pick.html_url, pick.labels.map((l) => l.name), pick.comments, pick.updated_at,
    ]
  );
}

function groupByRepo(items: GhIssue[]): Map<string, GhIssue[]> {
  const byRepo = new Map<string, GhIssue[]>();
  for (const i of items) {
    const repo = repoOf(i);
    if (repo && !i.pull_request) byRepo.set(repo, [...(byRepo.get(repo) ?? []), i]);
  }
  return byRepo;
}

/** A) YC open-source companies. */
async function refreshYc(gh: ReturnType<typeof githubSearcher>, since: string, runStart: Date, log: (m: string) => void) {
  const all = await cachedJson<OssCompany[]>(TAG_URL, settings.cacheHours.ycDirectory);
  // Hiring companies first, then the newest.
  const active = all
    .filter((c) => c.status === "Active" && c.slug)
    .sort((a, b) => Number(b.isHiring) - Number(a.isHiring) || (b.launched_at ?? 0) - (a.launched_at ?? 0));
  const bySlug = new Map(active.map((c) => [c.slug, c]));

  // GitHub account per company, from its YC page.
  const rows = await query<{ slug: string; github_org: string | null; checked_at: Date }>("SELECT slug, github_org, checked_at FROM oss_orgs");
  const known = new Map(rows.map((r) => [r.slug, r]));
  const monthAgo = Date.now() - 30 * 86_400_000;
  const toCheck = active.filter((c) => !known.has(c.slug) || new Date(known.get(c.slug)!.checked_at).getTime() < monthAgo).slice(0, settings.ossMaxCompanyPages);
  for (const c of toCheck) {
    try {
      const company = parseYcPage(await cachedText(`${YC}/companies/${c.slug}`, settings.cacheHours.ycCompanyPage))?.company ?? {};
      const org = githubAccountUrl(company.github_url)?.replace("https://github.com/", "") ?? null;
      await query(
        `INSERT INTO oss_orgs (slug, company_name, github_org, checked_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (slug) DO UPDATE SET company_name = EXCLUDED.company_name, github_org = EXCLUDED.github_org, checked_at = now()`,
        [c.slug, c.name, org]
      );
      known.set(c.slug, { slug: c.slug, github_org: org, checked_at: new Date() });
    } catch (e) {
      log(`Open source: skipped ${c.name} (${(e as Error).message})`);
    }
  }

  // Beginner issues, accounts searched longest ago first.
  const order = await query<{ slug: string }>("SELECT slug FROM oss_orgs WHERE github_org IS NOT NULL ORDER BY searched_at NULLS FIRST");
  const targets = order
    .map((r) => ({ c: bySlug.get(r.slug), org: known.get(r.slug)?.github_org }))
    .filter((t): t is { c: OssCompany; org: string } => !!t.c && !!t.org);
  let searched = 0;
  let repos = 0;
  for (let i = 0, n = 0; i < targets.length && n < settings.ossMaxSearches; i += settings.ossOrgsPerSearch, n++) {
    const chunk = targets.slice(i, i + settings.ossOrgsPerSearch);
    const items = await gh.search<GhIssue>("/search/issues", beginnerIssueQuery(chunk.map((t) => t.org), since), "sort=updated&order=desc&per_page=100");
    if (!items) break;
    const byOwner = new Map(chunk.map((t) => [t.org.toLowerCase(), t]));
    for (const [repo, issues] of groupByRepo(items)) {
      const t = byOwner.get(repo.split("/")[0].toLowerCase());
      if (!t) continue;
      await saveProject(
        {
          repo, origin: "yc", github_org: t.org, company_name: t.c.name, company_yc_url: `${YC}/companies/${t.c.slug}`,
          company_website: t.c.website || null, one_liner: t.c.one_liner || null, yc_batch: t.c.batch || null, hiring: !!t.c.isHiring,
          stars: null, language: null, repo_description: null,
        },
        issues
      );
      repos++;
    }
    // Repos of these accounts that no longer have beginner issues drop out.
    await query("DELETE FROM oss_projects WHERE origin = 'yc' AND lower(github_org) = ANY($1) AND fetched_at < $2", [[...byOwner.keys()], runStart]);
    await query("UPDATE oss_orgs SET searched_at = now() WHERE slug = ANY($1)", [chunk.map((t) => t.c.slug)]);
    searched += chunk.length;
  }
  log(`Open source: ${active.length} YC open-source companies; read ${toCheck.length} YC pages, searched ${searched} GitHub accounts, ${repos} repos with beginner issues.`);
}

/** B) Popular, active GitHub projects. The page rotates every 6 hours so different projects come up over time. */
async function refreshPopular(gh: ReturnType<typeof githubSearcher>, since: string, runStart: Date, log: (m: string) => void) {
  const per = settings.ossPopularRepos;
  const page = (Math.floor(Date.now() / (6 * 3600_000)) % 5) + 1;
  const repos = await gh.search<GhRepo>(
    "/search/repositories",
    popularRepoQuery(settings.ossPopularMinStars, daysAgoDate(14)),
    `sort=updated&order=desc&per_page=${per}&page=${page}`
  );
  if (!repos?.length) return;
  const byName = new Map(repos.map((r) => [r.full_name.toLowerCase(), r]));
  let found = 0;
  for (let i = 0; i < repos.length; i += settings.ossReposPerSearch) {
    const chunk = repos.slice(i, i + settings.ossReposPerSearch);
    const items = await gh.search<GhIssue>("/search/issues", beginnerIssueQuery(chunk.map((r) => r.full_name), since, "repo"), "sort=updated&order=desc&per_page=100");
    if (!items) break;
    for (const [repo, issues] of groupByRepo(items)) {
      const r = byName.get(repo.toLowerCase());
      if (!r) continue;
      await saveProject(
        {
          repo: r.full_name, origin: "popular", github_org: r.owner.login, company_name: r.owner.login, company_yc_url: null,
          company_website: r.homepage || null, one_liner: null, yc_batch: null, hiring: false,
          stars: r.stargazers_count, language: r.language, repo_description: r.description ? r.description.slice(0, 300) : null,
        },
        issues
      );
      found++;
    }
    await query("DELETE FROM oss_projects WHERE origin = 'popular' AND lower(repo) = ANY($1) AND fetched_at < $2", [chunk.map((r) => r.full_name.toLowerCase()), runStart]);
  }
  log(`Open source: ${repos.length} popular GitHub projects checked (page ${page}), ${found} with open beginner issues.`);
}

async function refreshOpenSource(log: (m: string) => void) {
  const runStart = new Date();
  const since = daysAgoDate(settings.ossIssueMaxAgeDays);
  const gh = githubSearcher(log);
  // Says whether a token is configured (never the token itself), so a missing one is easy to spot.
  log(`Open source: GitHub token ${process.env.GITHUB_TOKEN ? "set (30 searches/min)" : "not set (10 searches/min)"}.`);
  await refreshYc(gh, since, runStart, log);
  await refreshPopular(gh, since, runStart, log);
  await query("DELETE FROM oss_projects WHERE fetched_at < now() - interval '21 days'");
}

export const ossSource: StartupSource = {
  id: "oss_github",
  name: "Open-source projects (YC + GitHub)",
  disabledReason: () => null,
  async discover(ctx: DiscoveryContext) {
    await refreshOpenSource(ctx.log);
    return [];
  },
};
