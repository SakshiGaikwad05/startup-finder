// Funding news from public RSS feeds. Only headlines that explicitly announce a raise (or clearly say
// one is planned / reported) are used, and the article link is stored as the funding source URL.
// Every feed below was checked: free, no key, and allowed by the site's robots.txt.
import type { DiscoveryContext, Headquarters, StartupResult, StartupSource } from "@/lib/types";
import { cachedText } from "@/lib/http";
import { parseAmount, parseFundingHeadline } from "@/lib/funding";
import { countryFromLocation } from "@/lib/country";
import { normalizeName } from "@/lib/deduplication";
import { stripHtml } from "@/sources/jobs/remotive";
import { settings } from "@/config/settings";

/** India-focused outlets first; the outlet's country is never used as the startup's country. */
export const FEEDS = [
  { name: "Inc42", url: "https://inc42.com/feed/" },
  { name: "Economic Times (Tech funding)", url: "https://economictimes.indiatimes.com/tech/funding/rssfeeds/78570550.cms" },
  { name: "Economic Times (Startups)", url: "https://economictimes.indiatimes.com/tech/startups/rssfeeds/78570540.cms" },
  { name: "Entrackr", url: "https://entrackr.com/rss" },
  { name: "YourStory", url: "https://yourstory.com/feed" },
  { name: "TechCrunch (Fundraising)", url: "https://techcrunch.com/category/fundraising/feed/" },
  { name: "TechCrunch (Startups)", url: "https://techcrunch.com/category/startups/feed/" },
  { name: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
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
  // Some feeds (ET) put whitespace around the CDATA block, so strip the markers anywhere.
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
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

// Share sales, results, acquisitions, and VC funds raising money (not startups) are skipped.
const NOT_A_RAISE =
  /\bshares?\b|\bstake\b|bulk deal|\bipo\b|market debut|\bacquires?\b|revenue|net loss|profit|fy\d\d|\bcorpus\b|\b(maiden|debut|new|first|second|third|venture|vc|deeptech|growth)\s+fund\b|\bfund\s+(i{1,3}|iv|v|vi|\d)\b|\bfor (its |a |an |the )?[\w ,-]{0,30}\bfund\b/i;

/** Headquarters evidence from the article: "Bengaluru-based Foo" (medium), else an amount in ₹ (low). */
export function hqFromArticle(locationHint: string | null, amount: string | null, outlet: string, url: string): Headquarters | null {
  const country = countryFromLocation(locationHint);
  if (country) {
    const phrase = /^(India|United States)$/.test(locationHint ?? "")
      ? `described as ${locationHint === "India" ? "an Indian" : "a US"} company`
      : `“${locationHint}-based”`;
    return { country, confidence: "medium", evidence: `${phrase} in ${outlet} headline`, sourceUrl: url };
  }
  if (parseAmount(amount)?.currency === "INR") {
    return { country: "India", confidence: "low", evidence: `Round announced in ₹ (${outlet})`, sourceUrl: url };
  }
  return null;
}

export const fundingSource: StartupSource = {
  id: "funding_rss",
  name: "Funding news (Inc42, ET, Entrackr, YourStory, TechCrunch, Crunchbase News)",
  disabledReason: () => null,

  async discover(ctx: DiscoveryContext): Promise<StartupResult[]> {
    const out: StartupResult[] = [];
    const seenLinks = new Set<string>(); // the two TechCrunch feeds overlap
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
      let unconfirmed = 0;
      for (const item of items) {
        if (seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);
        const title = item.title.replace(/^\[[^\]]+\]\s*/, "");
        if (NOT_A_RAISE.test(title)) continue;
        const parsed = parseFundingHeadline(title, item.description);
        if (!parsed) continue;
        found++;
        if (parsed.kind !== "confirmed") unconfirmed++;
        // The article's publish date: the closest free signal for when the round was announced.
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
            kind: parsed.kind,
          },
          hq: hqFromArticle(parsed.locationHint, parsed.amount, feed.name, item.link),
          jobs: [],
        });
      }
      ctx.log(
        `Funding: ${feed.name} — ${items.length} articles, ${found} funding announcements${unconfirmed ? ` (${unconfirmed} planned/unconfirmed)` : ""}, ${websites} company websites found in articles.`
      );
    }
    return out;
  },
};
