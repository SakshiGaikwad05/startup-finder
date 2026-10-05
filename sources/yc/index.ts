// Y Combinator source.
// 1) Hiring-company list from the open yc-oss dataset (a daily mirror of YC's public directory).
// 2) Each company's public YC page (robots.txt allows /companies/<slug>) for founded year,
//    LinkedIn URL and the job postings embedded in the page.
import type { DiscoveryContext, JobResult, StartupResult, StartupSource } from "@/lib/types";
import { cacheAgeHours, cachedJson, cachedText } from "@/lib/http";
import { parseRemote } from "@/lib/jobs/location";
import { settings } from "@/config/settings";

const HIRING_URL = "https://yc-oss.github.io/api/companies/hiring.json";
const YC = "https://www.ycombinator.com";

interface YcOssCompany {
  name: string;
  slug: string;
  website: string;
  all_locations: string;
  long_description: string;
  one_liner: string;
  team_size: number;
  industry: string;
  subindustry: string;
  tags: string[];
  industries: string[];
  regions: string[];
  batch: string;
  status: string;
  isHiring: boolean;
  launched_at: number;
  url: string;
}

interface YcJob {
  title: string;
  url: string;
  location: string;
  type: string;
  roleSpecificType?: string;
  prettyRole?: string;
  salaryRange?: string;
  minExperience?: string;
  skills?: string[];
  createdAt?: string;
}

function unescapeHtml(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function parseYcPage(html: string): { company: any; jobs: YcJob[] } | null {
  const m = html.match(/data-page="([^"]+)"/);
  if (!m) return null;
  try {
    const page = JSON.parse(unescapeHtml(m[1]));
    return { company: page.props?.company ?? null, jobs: page.props?.jobPostings ?? [] };
  } catch {
    return null;
  }
}

function isIndia(c: YcOssCompany) {
  return c.regions?.includes("India") || /india/i.test(c.all_locations ?? "");
}

export const ycSource: StartupSource = {
  id: "yc",
  name: "Y Combinator directory",
  disabledReason: () => null,

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    ctx.log("YC: loading hiring-company list (yc-oss mirror)…");
    const all = await cachedJson<YcOssCompany[]>(HIRING_URL, settings.cacheHours.ycDirectory);
    const active = all.filter((c) => c.status === "Active" && c.isHiring);
    // India-based companies first, then companies that list themselves as fully remote (newest first).
    const india = active.filter(isIndia);
    const remote = active
      .filter((c) => !isIndia(c) && c.regions?.includes("Fully Remote"))
      .sort((a, b) => (b.launched_at ?? 0) - (a.launched_at ?? 0));
    const candidates = [...india, ...remote];
    ctx.log(`YC: ${active.length} hiring companies; ${india.length} India-based, ${remote.length} fully-remote candidates.`);

    // Page budget per run: ~2/3 for companies never read before (new discoveries), the rest to
    // refresh the pages read longest ago (new jobs). Unused budget flows to the other group.
    const ttl = settings.cacheHours.ycCompanyPage;
    const urlOf = (c: YcOssCompany) => `${YC}/companies/${c.slug}`;
    const fresh: YcOssCompany[] = [];
    const never: YcOssCompany[] = [];
    const stale: { c: YcOssCompany; age: number }[] = [];
    for (const c of candidates) {
      const age = cacheAgeHours(urlOf(c));
      if (age === null) never.push(c);
      else if (age < ttl) fresh.push(c);
      else stale.push({ c, age });
    }
    stale.sort((a, b) => b.age - a.age);
    const budget = settings.ycMaxCompanyPages;
    const newTake = Math.min(never.length, Math.max(budget - stale.length, Math.ceil((budget * 2) / 3)));
    const refreshTake = Math.min(stale.length, budget - newTake);
    const selected = [...fresh, ...never.slice(0, newTake), ...stale.slice(0, refreshTake).map((s) => s.c)];
    ctx.log(`YC: reading ${fresh.length} cached pages + ${newTake} new companies + ${refreshTake} refreshes (${never.length - newTake} new left for later runs).`);

    const results: StartupResult[] = [];
    let networkFetches = newTake + refreshTake;
    for (const c of selected) {
      const pageUrl = urlOf(c);
      let parsed: ReturnType<typeof parseYcPage> = null;
      try {
        parsed = parseYcPage(await cachedText(pageUrl, settings.cacheHours.ycCompanyPage));
      } catch (e) {
        ctx.log(`YC: skipped ${c.name} (${(e as Error).message})`);
        continue;
      }
      const company = parsed?.company ?? {};
      // "[PAUSED] …" postings are still listed by YC but not accepting applications.
      const open = (parsed?.jobs ?? []).filter((j) => !/^\s*\[paused\]/i.test(j.title));
      const jobs: JobResult[] = open.map((j) => {
        const { remote, scope } = parseRemote(j.location);
        const jobUrl = j.url.startsWith("http") ? j.url : `${YC}${j.url}`;
        return {
          title: j.title,
          url: jobUrl,
          applyUrl: jobUrl, // public job page with the Apply button
          location: j.location || null,
          remote,
          remoteScope: scope,
          employmentType: j.type || null,
          postedDate: j.createdAt ? `${j.createdAt} ago` : null,
          minExperience: j.minExperience || null,
          salary: j.salaryRange || null,
          skills: [...(j.skills ?? []), ...(j.roleSpecificType ? [j.roleSpecificType] : [])],
          description: [j.prettyRole, j.roleSpecificType].filter(Boolean).join(" · ") || null,
          source: "yc",
          sourceUrl: jobUrl,
        };
      });
      results.push({
        name: c.name,
        website: c.website || company.website || null,
        linkedinUrl: company.linkedin_url || null,
        description: c.long_description || c.one_liner || null,
        location: company.location || c.all_locations || null,
        tags: [...(c.tags ?? []), ...(c.industries ?? [])],
        industryHint: [c.industry, c.subindustry].filter(Boolean).join(" -> "),
        foundedYear: typeof company.year_founded === "number" ? company.year_founded : null,
        funding: c.batch
          ? {
              date: null,
              amount: null,
              round: `Y Combinator ${c.batch}`,
              investors: ["Y Combinator"],
              source: "YC directory",
              sourceUrl: pageUrl,
            }
          : null,
        source: "yc",
        sourceUrl: pageUrl,
        jobs,
      });
    }
    ctx.log(`YC: ${results.length} companies read (${networkFetches} pages fetched, rest from today's cache).`);
    return results;
  },
};
