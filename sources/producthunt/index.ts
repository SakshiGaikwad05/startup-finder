// Product Hunt launches via the official GraphQL API (https://api.producthunt.com/v2/docs).
// Needs a free developer token in PRODUCT_HUNT_TOKEN. Reads the most-upvoted launches of the last
// settings.addFundedWithinDays days. A launch with at least settings.phMinVotes upvotes counts as a
// recent signal (like funding), so the startup is added; the careers-page enricher then looks for jobs.
// The API's `website` is a Product Hunt redirect (/r/p/…, allowed by robots.txt); following it once
// gives the company's real website, needed for dedup and for finding the careers page.
import type { DiscoveryContext, StartupResult, StartupSource } from "@/lib/types";
import { robotsAllowed } from "@/lib/http";
import { query } from "@/lib/database";
import { normalizeName } from "@/lib/deduplication";
import { settings } from "@/config/settings";

const API = "https://api.producthunt.com/v2/api/graphql";

const POSTS = `query Launches($after: DateTime!, $cursor: String) {
  posts(order: VOTES, postedAfter: $after, first: 20, after: $cursor) {
    pageInfo { endCursor hasNextPage }
    edges { node { id name tagline description url website votesCount createdAt topics(first: 6) { edges { node { name } } } } }
  }
}`;

export interface PhPost {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  url: string; // the Product Hunt post
  website: string | null; // Product Hunt redirect to the product's site
  votesCount: number;
  createdAt: string;
  topics?: { edges: { node: { name: string } }[] };
}

interface PostsPage {
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  edges: { node: PhPost }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Real website from a redirect target: tracking parameters dropped, homepage as origin only. */
export function cleanWebsite(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || /(^|\.)producthunt\.com$/i.test(u.hostname)) return null;
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref$|ref_|via$|source$)/i.test(k)) u.searchParams.delete(k);
    const rest = (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")) + (u.searchParams.toString() ? `?${u.searchParams}` : "");
    return u.origin + rest;
  } catch {
    return null;
  }
}

/** A Product Hunt post → a startup result (website filled in later). */
export function phStartup(p: PhPost, website: string | null): StartupResult {
  const topics = (p.topics?.edges ?? []).map((e) => e.node.name);
  return {
    name: p.name.trim(),
    website,
    description: [p.tagline, p.description].filter(Boolean).join(". ").slice(0, 1200) || null,
    tags: topics,
    source: "producthunt",
    sourceUrl: p.url,
    launch: { date: p.createdAt.slice(0, 10), votes: p.votesCount, url: p.url },
  };
}

/** Follows the Product Hunt redirect once (no further), if robots.txt allows it. */
async function resolveWebsite(redirect: string): Promise<string | null> {
  if (!/producthunt\.com/i.test(redirect)) return cleanWebsite(redirect);
  if (!(await robotsAllowed(redirect))) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), settings.requestTimeoutMs);
  try {
    const res = await fetch(redirect, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": settings.userAgent } });
    const loc = res.headers.get("location");
    return loc ? cleanWebsite(new URL(loc, redirect).toString()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const productHuntSource: StartupSource = {
  id: "producthunt",
  name: "Product Hunt launches",
  disabledReason: () => (process.env.PRODUCT_HUNT_TOKEN ? null : "PRODUCT_HUNT_TOKEN not set"),

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    const after = new Date(Date.now() - settings.addFundedWithinDays * 86_400_000).toISOString();
    const posts: PhPost[] = [];
    let cursor: string | null = null;
    while (posts.length < settings.phMaxPosts) {
      const res: Response = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.PRODUCT_HUNT_TOKEN}`,
          "User-Agent": settings.userAgent,
        },
        body: JSON.stringify({ query: POSTS, variables: { after, cursor } }),
      });
      const body: { data?: { posts?: PostsPage }; errors?: { error?: string; message?: string }[] } = await res.json().catch(() => ({}));
      if (!res.ok || body.errors) {
        ctx.log(`Product Hunt: API error (HTTP ${res.status}${body.errors ? `: ${body.errors[0]?.error ?? body.errors[0]?.message}` : ""})`);
        break;
      }
      const page: PostsPage | undefined = body.data?.posts;
      posts.push(...(page?.edges ?? []).map((e) => e.node));
      if (!page?.pageInfo?.hasNextPage) break;
      cursor = page.pageInfo.endCursor;
      await sleep(settings.perHostDelayMs);
    }
    // Only launches strong enough to count; most-upvoted first (the API already sorts by votes).
    const strong = posts.filter((p) => p.votesCount >= settings.phMinVotes);

    // Real websites: skip ones we already know (by name), look up the rest within the budget.
    const knownRows = await query<{ normalized_name: string; website: string | null }>(
      "SELECT normalized_name, website FROM startups WHERE normalized_name = ANY($1)",
      [strong.map((p) => normalizeName(p.name))]
    );
    const known = new Map(knownRows.map((r) => [r.normalized_name, r.website]));
    let lookups = 0;
    const results: StartupResult[] = [];
    for (const p of strong) {
      let website = known.get(normalizeName(p.name)) ?? null;
      if (!website && p.website && lookups < settings.phMaxResolves) {
        lookups++;
        website = await resolveWebsite(p.website);
        await sleep(settings.perHostDelayMs);
      }
      results.push(phStartup(p, website));
    }
    ctx.log(
      `Product Hunt: ${posts.length} launches from the last ${settings.addFundedWithinDays} days read, ${strong.length} with ${settings.phMinVotes}+ upvotes; ${lookups} websites looked up.`
    );
    return results;
  },
};
