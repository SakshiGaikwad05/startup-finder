// Company identity helpers used for aggressive deduplication.
// Match order: domain → LinkedIn URL → normalized name.

const LEGAL_SUFFIXES = [
  "private limited",
  "pvt ltd",
  "pvt",
  "ltd",
  "limited",
  "inc",
  "llc",
  "llp",
  "corp",
  "corporation",
  "co",
  "gmbh",
  "technologies",
  "technology",
  "tech",
  "software",
  "solutions",
  "labs",
  "hq",
  "india",
];

export function normalizeName(name: string): string {
  let n = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\.(ai|io|com|co|in|app|dev|so|xyz)\b/g, " $1")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Strip trailing legal/generic suffixes repeatedly ("Foo Technologies Pvt Ltd" → "foo").
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of [...LEGAL_SUFFIXES, "ai", "io", "com", "app", "in"]) {
      if (n.endsWith(" " + s) && n.length > s.length + 2) {
        n = n.slice(0, -(s.length + 1)).trim();
        changed = true;
      }
    }
  }
  return n.replace(/ /g, "");
}

const IGNORED_DOMAINS = new Set([
  "linkedin.com",
  "ycombinator.com",
  "workatastartup.com",
  "wellfound.com",
  "angel.co",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "github.com",
  "medium.com",
  "notion.site",
  "google.com",
  "remotive.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
]);

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return null;
    for (const d of IGNORED_DOMAINS) if (host === d || host.endsWith("." + d)) return null;
    return host;
  } catch {
    return null;
  }
}

export function normalizeLinkedin(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return m ? `https://www.linkedin.com/company/${m[1].toLowerCase()}` : null;
}
