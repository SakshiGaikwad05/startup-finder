// Remotive public API (https://remotive.com/api/remote-jobs). Every job here is explicitly remote;
// we keep only jobs whose candidate_required_location lets someone in India apply.
// Remotive asks API users to link back to the job on Remotive and to keep calls to a few per day — we cache.
import type { DiscoveryContext, StartupResult, StartupSource } from "@/lib/types";
import { cachedJson } from "@/lib/http";
import { settings } from "@/config/settings";

const CATEGORIES = ["software-dev", "customer-support"];

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

export function stripHtml(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function indiaEligible(loc: string): { ok: boolean; scope: string | null } {
  if (/india/i.test(loc)) return { ok: true, scope: "India" };
  if (/worldwide|anywhere|global/i.test(loc)) return { ok: true, scope: "Worldwide" };
  if (/\bAPAC\b|asia/i.test(loc)) return { ok: true, scope: "APAC" };
  return { ok: false, scope: null };
}

export const remotiveSource: StartupSource = {
  id: "remotive",
  name: "Remotive remote jobs",
  disabledReason: () => null,

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    const byCompany = new Map<string, StartupResult>();
    for (const cat of CATEGORIES) {
      const url = `https://remotive.com/api/remote-jobs?category=${cat}`;
      let data: { jobs: RemotiveJob[] };
      try {
        data = await cachedJson(url, settings.cacheHours.remotive);
      } catch (e) {
        ctx.log(`Remotive: ${cat} failed (${(e as Error).message})`);
        continue;
      }
      let kept = 0;
      for (const j of data.jobs ?? []) {
        const elig = indiaEligible(j.candidate_required_location ?? "");
        if (!elig.ok) continue;
        kept++;
        const key = j.company_name.trim().toLowerCase();
        if (!byCompany.has(key)) {
          byCompany.set(key, {
            name: j.company_name.trim(),
            source: "remotive",
            sourceUrl: j.url,
            jobs: [],
          });
        }
        byCompany.get(key)!.jobs!.push({
          title: j.title,
          url: j.url,
          applyUrl: j.url,
          location: `Remote (${j.candidate_required_location})`,
          remote: "yes",
          remoteScope: elig.scope,
          employmentType: j.job_type ? j.job_type.replace(/_/g, "-") : null,
          postedDate: j.publication_date ? j.publication_date.slice(0, 10) : null,
          minExperience: null,
          salary: j.salary || null,
          skills: j.tags ?? [],
          description: stripHtml(j.description ?? "").slice(0, 2500),
          source: "remotive",
          sourceUrl: j.url,
        });
      }
      ctx.log(`Remotive: ${cat} — ${data.jobs?.length ?? 0} jobs, ${kept} open to India.`);
    }
    return [...byCompany.values()];
  },
};
