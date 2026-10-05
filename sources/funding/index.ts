// Funding news from public RSS feeds. Only headlines that explicitly announce a raise are used,
// and the article link is stored as the funding source URL.
import type { DiscoveryContext, StartupResult, StartupSource } from "@/lib/types";
import { cachedText } from "@/lib/http";
import { parseFundingHeadline } from "@/lib/funding";
import { normalizeName } from "@/lib/deduplication";
import { stripHtml } from "@/sources/jobs/remotive";
import { settings } from "@/config/settings";

const FEEDS = [
  { name: "Inc42", url: "https://inc42.com/feed/" },
  { name: "YourStory", url: "https://yourstory.com/feed" },
  { name: "TechCrunch", url: "https://techcrunch.com/category/startups/feed/" },
];

export interface RssItem {
  title: string;
  link: string;
  pubDate: string | null;
  description: string;
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim();
}

function decode(s: string) {
  return s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8377;/g, "₹")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const it = m[0];
    const title = decode(tag(it, "title") ?? "");
    const link = (tag(it, "link") ?? "").trim();
    if (!title || !link) continue;
    items.push({
      title,
      link,
      pubDate: tag(it, "pubDate"),
      description: stripHtml(decode(tag(it, "description") ?? "")).slice(0, 600),
    });
  }
  return items;
}

const NOT_COMPANY_SITES =
  /(^|\.)(twitter|x|linkedin|facebook|instagram|youtube|threads|mstdn|t|wa|whatsapp|telegram|reddit|medium|substack|google|apple|bit|crunchbase|tracxn|strictlyvc|techcrunch|yourstory|inc42|economictimes|indiatimes|livemint|moneycontrol|wikipedia|github|ycombinator|wellfound|amazonaws|cloudfront|wp|wordpress|gravatar|doubleclick|disqus)\.[a-z.]+$/i;

/**
 * The startup's website, but only if the article itself links to a domain whose name matches the
 * company (e.g. "Restate" → restate.dev). Never guessed.
 */
export async function websiteFromArticle(articleUrl: string, company: string): Promise<string | null> {
  const want = normalizeName(company);
  if (want.length < 4) return null;
  let html: string;
  try {
    html = await cachedText(articleUrl, 24 * 7);
  } catch {
    return null; // blocked by robots / 403 / network — leave unknown
  }
  const articleHost = new URL(articleUrl).hostname.replace(/^www\./, "");
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"'#\s]+)["']/gi)) {
    let host: string;
    try {
      host = new URL(m[1]).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (host.endsWith(articleHost) || NOT_COMPANY_SITES.test(host)) continue;
    const label = host.split(".").slice(-2, -1)[0]?.replace(/[^a-z0-9]/g, "") ?? "";
    if (label.length >= 4 && (label === want || label.startsWith(want) || want.startsWith(label))) {
      return `https://${host}`;
    }
  }
  return null;
}

const NOT_A_RAISE = /\bshares?\b|\bstake\b|bulk deal|\bipo\b|market debut|\bacquires?\b|revenue|net loss|profit|fy\d\d/i;

export const fundingSource: StartupSource = {
  id: "funding_rss",
  name: "Funding news (Inc42, YourStory, TechCrunch)",
  disabledReason: () => null,

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    const out: StartupResult[] = [];
    for (const feed of FEEDS) {
      let items: RssItem[];
      try {
        items = parseRss(await cachedText(feed.url, settings.cacheHours.rss));
      } catch (e) {
        ctx.log(`Funding: ${feed.name} failed (${(e as Error).message})`);
        continue;
      }
      let found = 0;
      let websites = 0;
      for (const item of items) {
        const title = item.title.replace(/^\[[^\]]+\]\s*/, "");
        if (NOT_A_RAISE.test(title)) continue;
        const parsed = parseFundingHeadline(title, item.description);
        if (!parsed) continue;
        found++;
        const date = item.pubDate && !isNaN(Date.parse(item.pubDate)) ? new Date(item.pubDate).toISOString().slice(0, 10) : null;
        const website = await websiteFromArticle(item.link, parsed.company);
        if (website) websites++;
        out.push({
          name: parsed.company,
          website,
          description: item.description || null,
          location: parsed.locationHint,
          source: "funding_rss",
          sourceUrl: item.link,
          funding: {
            date,
            amount: parsed.amount,
            round: parsed.round,
            investors: parsed.investors,
            source: feed.name,
            sourceUrl: item.link,
          },
          jobs: [],
        });
      }
      ctx.log(`Funding: ${feed.name} — ${items.length} articles, ${found} funding announcements, ${websites} company websites found in articles.`);
    }
    return out;
  },
};
