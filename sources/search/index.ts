// Web search via the Brave Search API (optional; needs SEARCH_API_KEY).
// Profile-based queries are restricted to public ATS job boards so every result maps to a real,
// machine-readable job board — no guessing company names from search snippets.
import type { DiscoveryContext, StartupResult, StartupSource } from "@/lib/types";
import { politeFetch } from "@/lib/http";
import { atsBoardUrl, fetchAtsJobs, findAtsRef, type AtsRef } from "@/sources/jobs/ats";

const ATS_SITES = "(site:jobs.lever.co OR site:boards.greenhouse.io OR site:job-boards.greenhouse.io OR site:jobs.ashbyhq.com)";
const MAX_QUERIES = 8;

export const searchSource: StartupSource = {
  id: "search",
  name: "Web search (Brave Search API)",
  disabledReason: () => (process.env.SEARCH_API_KEY ? null : "SEARCH_API_KEY not set"),

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    const key = process.env.SEARCH_API_KEY!;
    const boards = new Map<string, AtsRef>();
    // Only the job-oriented queries make sense against ATS sites.
    const qs = ctx.queries.filter((q) => /hiring|jobs|developer|engineer/i.test(q)).slice(0, MAX_QUERIES);
    for (const q of qs) {
      const query = `${q.replace(/\bstartup\b/gi, "").trim()} ${ATS_SITES}`;
      try {
        const res = await politeFetch(
          `https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(query)}`,
          { skipRobots: true, headers: { "X-Subscription-Token": key, Accept: "application/json" } }
        );
        const data = await res.json();
        for (const r of data.web?.results ?? []) {
          const ref = findAtsRef(r.url ?? "");
          if (ref) boards.set(`${ref.vendor}:${ref.slug.toLowerCase()}`, ref);
        }
      } catch (e) {
        ctx.log(`Search: "${q}" failed (${(e as Error).message})`);
      }
    }
    ctx.log(`Search: ${qs.length} queries → ${boards.size} job boards.`);
    const out: StartupResult[] = [];
    for (const ref of boards.values()) {
      try {
        const { jobs } = await fetchAtsJobs(ref, "search");
        // The board slug is the only verified company identifier we have here.
        const name = ref.slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        out.push({ name, careersUrl: atsBoardUrl(ref), source: "search", sourceUrl: atsBoardUrl(ref), jobs });
      } catch (e) {
        ctx.log(`Search: board ${ref.vendor}/${ref.slug} failed (${(e as Error).message})`);
      }
    }
    return out;
  },
};
