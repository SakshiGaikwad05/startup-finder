// Contact emails, taken only from a startup's own web pages and only on the startup's own domain.
// Nothing is guessed (no "firstname@domain" patterns). "Valid" = the domain has MX records, i.e.
// it can receive email. We never probe mailboxes over SMTP.
import { promises as dns } from "node:dns";

export type EmailType = "careers" | "general" | "person";

export interface FoundEmail {
  email: string;
  type: EmailType;
  source_url: string;
  domain_accepts_mail: boolean | null; // null = DNS check failed (unknown)
}

const CAREERS = /^(careers?|jobs?|hiring|hire|hr|talent|recruit(ing|ment)?|people|join|apply|work)\b/i;
const GENERAL = /^(hello|hi|hey|info|contact|team|founders?|support|help|admin|office|sales|partnerships?|business|enquir(y|ies)|inquir(y|ies)|press|media|connect|reach)\b/i;
const IGNORE_LOCAL = /^(no-?reply|donotreply|do-not-reply|privacy|legal|abuse|postmaster|webmaster|security|dpo|gdpr|unsubscribe|bounce|mailer-daemon|example|test|user|name|email|your)/i;
const FILE_LIKE = /\.(png|jpe?g|gif|svg|webp|ico|css|js)$/i;

function decodeEntities(s: string) {
  return s
    // JSON/JS escapes inside inline scripts: ">" (>), "<" (<), "@" (@)
    .replace(/\\u0040/gi, "@")
    .replace(/\\u00[0-9a-f]{2}|\\[nrt"']/gi, " ")
    .replace(/&#64;|&#x40;|&commat;/gi, "@")
    .replace(/&#46;|&#x2e;|&period;/gi, ".")
    .replace(/&amp;/g, "&");
}

export function classifyEmail(email: string): EmailType {
  const local = email.split("@")[0];
  if (CAREERS.test(local)) return "careers";
  // first.last / first_last looks like an individual; other words (compliance@, enterprise@) are team inboxes.
  if (!GENERAL.test(local) && /^[a-z]{2,}[._][a-z]{2,}$/.test(local)) return "person";
  return "general";
}

/** Emails on `domain` (or its subdomains) that appear in the page's HTML/mailto links. */
export function extractEmails(html: string, domain: string, sourceUrl: string): Omit<FoundEmail, "domain_accepts_mail">[] {
  const text = decodeEntities(html);
  const found = new Map<string, Omit<FoundEmail, "domain_accepts_mail">>();
  const base = domain.toLowerCase().replace(/^www\./, "");
  // The local part must start at a word boundary (not glued onto other text).
  for (const m of text.matchAll(/(?<![a-z0-9._%+-])([a-z0-9][a-z0-9._%+-]{0,63})@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
    const local = m[1].toLowerCase();
    const host = m[2].toLowerCase().replace(/\.$/, "");
    const email = `${local}@${host}`;
    if (FILE_LIKE.test(email) || IGNORE_LOCAL.test(local)) continue;
    if (!(host === base || host.endsWith("." + base))) continue; // only the startup's own domain
    if (!found.has(email)) found.set(email, { email, type: classifyEmail(email), source_url: sourceUrl });
  }
  return [...found.values()];
}

const mxCache = new Map<string, Promise<boolean | null>>();

/** MX lookup over DNS-over-HTTPS (Google public resolver). Used when the system resolver is unreachable. */
async function mxViaDoh(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { Status: number; Answer?: { type: number }[] };
    if (data.Status === 3) return false; // NXDOMAIN
    if (data.Status !== 0) return null;
    return (data.Answer ?? []).some((a) => a.type === 15); // 15 = MX
  } catch {
    return null;
  }
}

export function domainAcceptsMail(domain: string): Promise<boolean | null> {
  if (!mxCache.has(domain)) {
    mxCache.set(
      domain,
      dns
        .resolveMx(domain)
        .then((r) => r.length > 0)
        .catch((e: NodeJS.ErrnoException) => (e.code === "ENOTFOUND" || e.code === "ENODATA" ? false : mxViaDoh(domain)))
    );
  }
  return mxCache.get(domain)!;
}

export async function withMxCheck(list: Omit<FoundEmail, "domain_accepts_mail">[]): Promise<FoundEmail[]> {
  return Promise.all(
    list.map(async (e) => ({ ...e, domain_accepts_mail: await domainAcceptsMail(e.email.split("@")[1]) }))
  );
}

/** Link to a contact page on the homepage, if any. */
export function contactLink(html: string, base: string): string | null {
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, " ").trim();
    if (/^(contact( us)?|get in touch|talk to us)$/i.test(text) || /\/contact(-us)?\/?$/i.test(m[1])) {
      try {
        const u = new URL(m[1], base);
        if (u.protocol.startsWith("http")) return u.toString();
      } catch {}
    }
  }
  return null;
}
