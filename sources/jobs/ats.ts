// Public, unauthenticated job-board APIs offered by common ATS vendors.
import type { JobResult } from "@/lib/types";
import { cachedJson } from "@/lib/http";
import { parseRemote } from "@/lib/jobs/location";
import { stripHtml } from "./remotive";

export type AtsRef = { vendor: "greenhouse" | "lever" | "ashby"; slug: string };

/** Finds an ATS board reference inside a URL or a page's HTML. */
export function findAtsRef(text: string): AtsRef | null {
  const gh = text.match(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i);
  if (gh && !["embed", "v1"].includes(gh[1].toLowerCase())) return { vendor: "greenhouse", slug: gh[1] };
  const lv = text.match(/jobs\.lever\.co\/([a-z0-9_.-]+)/i);
  if (lv) return { vendor: "lever", slug: lv[1] };
  const ash = text.match(/jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i);
  if (ash) return { vendor: "ashby", slug: decodeURIComponent(ash[1]) };
  return null;
}

export function atsBoardUrl(ref: AtsRef): string {
  return {
    greenhouse: `https://boards.greenhouse.io/${ref.slug}`,
    lever: `https://jobs.lever.co/${ref.slug}`,
    ashby: `https://jobs.ashbyhq.com/${ref.slug}`,
  }[ref.vendor];
}

function job(partial: Omit<JobResult, "remote" | "remoteScope"> & { remoteHint?: boolean }): JobResult {
  let { remote, scope } = parseRemote(partial.location);
  if (partial.remoteHint === true && remote !== "yes") {
    remote = "yes"; // the ATS itself flags the posting as remote
  }
  const { remoteHint, ...rest } = partial;
  return { ...rest, remote, remoteScope: scope };
}

export async function fetchAtsJobs(ref: AtsRef, source: string): Promise<{ companyName: string | null; jobs: JobResult[] }> {
  if (ref.vendor === "greenhouse") {
    const api = `https://boards-api.greenhouse.io/v1/boards/${ref.slug}/jobs?content=true`;
    const data = await cachedJson<any>(api, 12);
    return {
      companyName: null,
      jobs: (data.jobs ?? []).map((j: any) =>
        job({
          title: j.title,
          url: j.absolute_url,
          applyUrl: j.absolute_url,
          location: j.location?.name ?? null,
          employmentType: null,
          postedDate: j.updated_at?.slice(0, 10) ?? null,
          skills: [],
          description: stripHtml(String(j.content ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")).slice(0, 2500),
          source,
          sourceUrl: api,
        })
      ),
    };
  }
  if (ref.vendor === "lever") {
    const api = `https://api.lever.co/v0/postings/${ref.slug}?mode=json`;
    const data = await cachedJson<any[]>(api, 12);
    return {
      companyName: null,
      jobs: (data ?? []).map((j: any) =>
        job({
          title: j.text,
          url: j.hostedUrl,
          applyUrl: j.applyUrl ?? j.hostedUrl,
          location: [j.categories?.location, ...(j.categories?.allLocations ?? [])].filter(Boolean).join(" / ") || null,
          remoteHint: j.workplaceType === "remote",
          employmentType: j.categories?.commitment ?? null,
          postedDate: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : null,
          skills: [],
          description: String(j.descriptionPlain ?? "").slice(0, 2500),
          source,
          sourceUrl: api,
        })
      ),
    };
  }
  const api = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(ref.slug)}`;
  const data = await cachedJson<any>(api, 12);
  return {
    companyName: null,
    jobs: (data.jobs ?? []).map((j: any) =>
      job({
        title: j.title,
        url: j.jobUrl,
        applyUrl: j.applyUrl ?? j.jobUrl,
        location: [j.location, ...(j.secondaryLocations ?? []).map((s: any) => s.location)].filter(Boolean).join(" / ") || null,
        remoteHint: j.isRemote === true,
        employmentType: j.employmentType ?? null,
        postedDate: j.publishedAt?.slice(0, 10) ?? null,
        skills: [],
        description: String(j.descriptionPlain ?? "").slice(0, 2500),
        source,
        sourceUrl: api,
      })
    ),
  };
}
