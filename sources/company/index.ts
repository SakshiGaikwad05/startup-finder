// Company websites: for known startups with a website, find the careers page on the homepage and read
// jobs from (1) public Greenhouse / Lever / Ashby boards, or (2) schema.org JobPosting data embedded
// in the careers page (the structured format Google for Jobs uses). Nothing is inferred from prose.
import type { DiscoveryContext, JobResult, StartupResult, StartupSource } from "@/lib/types";
import { cachedText } from "@/lib/http";
import { parseRemote } from "@/lib/jobs/location";
import { settings } from "@/config/settings";
import { atsBoardUrl, fetchAtsJobs, findAtsRef } from "@/sources/jobs/ats";
import { stripHtml } from "@/sources/jobs/remotive";

export function careersLink(html: string, base: string): string | null {
  let fallback: string | null = null;
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").trim();
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      continue;
    }
    // Strong signal: the link text or path says careers.
    if (/\bcareers?\b|join (us|the team|our team)|we'?re hiring|work with us|open (roles|positions)/i.test(text) || /\/careers?\b/i.test(href)) {
      return abs;
    }
    if (!fallback && /\/jobs\/?$|^jobs$/i.test(href + " " + text)) fallback = abs;
  }
  return fallback;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

/** Reads schema.org JobPosting objects from <script type="application/ld+json"> blocks. */
export function jobPostingsFromJsonLd(html: string, pageUrl: string, source: string): JobResult[] {
  const out: JobResult[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: any;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes = asArray(data).flatMap((d: any) => [d, ...asArray(d?.["@graph"]), ...asArray(d?.itemListElement).map((i: any) => i?.item ?? i)]);
    for (const n of nodes) {
      const types = asArray(n?.["@type"]).map(String);
      if (!types.includes("JobPosting") || !n.title) continue;
      const places = asArray(n.jobLocation)
        .map((l: any) => {
          const a = l?.address ?? {};
          return [a.addressLocality, a.addressRegion, a.addressCountry?.name ?? a.addressCountry].filter(Boolean).join(", ");
        })
        .filter(Boolean);
      const telecommute = asArray(n.jobLocationType).some((t: any) => /telecommute/i.test(String(t)));
      const remoteCountries = asArray(n.applicantLocationRequirements)
        .map((r: any) => r?.name ?? r)
        .filter((x: any) => typeof x === "string");
      const location =
        [...places, ...(telecommute ? [`Remote${remoteCountries.length ? ` (${remoteCountries.join("; ")})` : ""}`] : [])].join(" / ") || null;
      const { remote, scope } = parseRemote(location);
      const url = typeof n.url === "string" ? new URL(n.url, pageUrl).toString() : `${pageUrl}#${encodeURIComponent(n.title)}`;
      out.push({
        title: String(n.title).trim(),
        url,
        applyUrl: typeof n.url === "string" ? url : pageUrl,
        location,
        remote,
        remoteScope: scope,
        employmentType: asArray(n.employmentType).join(", ") || null,
        postedDate: typeof n.datePosted === "string" ? n.datePosted.slice(0, 10) : null,
        minExperience: null,
        salary: null,
        skills: [],
        description: n.description ? stripHtml(String(n.description)).slice(0, 2500) : null,
        source,
        sourceUrl: pageUrl,
      });
    }
  }
  return out;
}

export const companyCareersSource: StartupSource = {
  id: "company_careers",
  name: "Company websites / careers pages",
  disabledReason: () => null,

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    const out: StartupResult[] = [];
    const list = ctx.careersCandidates.slice(0, settings.maxCareersChecks);
    let withJobs = 0;
    for (const s of list) {
      try {
        const home = s.website.startsWith("http") ? s.website : `https://${s.website}`;
        const html = await cachedText(home, 24);
        let ref = findAtsRef(html);
        let careersUrl = careersLink(html, home);
        let careersHtml = "";
        if (careersUrl && careersUrl !== home) {
          careersHtml = await cachedText(careersUrl, 24).catch(() => "");
          ref = ref ?? findAtsRef(careersUrl) ?? findAtsRef(careersHtml);
        }
        if (!careersUrl && ref) careersUrl = atsBoardUrl(ref);
        if (!careersUrl) continue;

        let jobs: JobResult[] = [];
        if (ref) jobs = (await fetchAtsJobs(ref, "company_careers").catch(() => ({ jobs: [] as JobResult[] }))).jobs;
        if (!jobs.length && careersHtml) jobs = jobPostingsFromJsonLd(careersHtml, careersUrl, "company_careers");
        if (jobs.length) withJobs++;
        // Only send jobs when we actually read a job list, so existing jobs aren't marked inactive by mistake.
        out.push({
          name: s.name,
          website: s.website,
          careersUrl,
          source: "company_careers",
          sourceUrl: careersUrl,
          ...(jobs.length ? { jobs } : {}),
        });
      } catch (e) {
        ctx.log(`Careers: ${s.name} skipped (${(e as Error).message})`);
      }
    }
    ctx.log(`Careers: checked ${list.length} websites → ${out.length} careers pages, ${withJobs} with readable job lists.`);
    return out;
  },
};
