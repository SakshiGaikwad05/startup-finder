// Polite HTTP: robots.txt check, per-host rate limit, timeout, and a small disk cache.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { settings } from "@/config/settings";

const CACHE_DIR = path.join(process.cwd(), ".cache", "http");
const lastHit = new Map<string, number>();
const robotsCache = new Map<string, { disallow: string[]; allow: string[] } | null>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle(host: string) {
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + settings.perHostDelayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

function parseRobots(txt: string) {
  // Only the `User-agent: *` group is honoured (we don't claim a named agent).
  const out = { disallow: [] as string[], allow: [] as string[] };
  let inStar = false;
  let sawRuleInGroup = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (sawRuleInGroup) {
        inStar = false;
        sawRuleInGroup = false;
      }
      if (val === "*") inStar = true;
    } else if (key === "disallow" || key === "allow") {
      sawRuleInGroup = true;
      if (inStar && val) (key === "allow" ? out.allow : out.disallow).push(val);
    }
  }
  return out;
}

function ruleMatches(rule: string, p: string) {
  const re = new RegExp(
    "^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")
  );
  return re.test(p);
}

export async function robotsAllowed(url: string): Promise<boolean> {
  const u = new URL(url);
  const key = u.origin;
  if (!robotsCache.has(key)) {
    try {
      const txt = await cachedText(`${u.origin}/robots.txt`, settings.cacheHours.robots, { skipRobots: true });
      robotsCache.set(key, parseRobots(txt));
    } catch {
      robotsCache.set(key, null); // no robots.txt → allowed
    }
  }
  const rules = robotsCache.get(key);
  if (!rules) return true;
  const p = u.pathname + u.search;
  const longest = (list: string[]) =>
    list.filter((r) => ruleMatches(r, p)).reduce((a, r) => Math.max(a, r.length), -1);
  return longest(rules.allow) >= longest(rules.disallow);
}

export class FetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function politeFetch(url: string, opts: { skipRobots?: boolean; headers?: Record<string, string> } = {}) {
  if (!opts.skipRobots && !(await robotsAllowed(url))) {
    throw new FetchError(`Blocked by robots.txt: ${url}`);
  }
  const host = new URL(url).host;
  await throttle(host);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), settings.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": settings.userAgent, Accept: "*/*", ...opts.headers },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
    return res;
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw new FetchError(`Fetch failed for ${url}: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

function cachePath(url: string) {
  return path.join(CACHE_DIR, crypto.createHash("sha1").update(url).digest("hex"));
}

/** Hours since this URL was last fetched, or null if never. */
export function cacheAgeHours(url: string): number | null {
  try {
    return (Date.now() - fs.statSync(cachePath(url)).mtimeMs) / 3600_000;
  } catch {
    return null;
  }
}

export function isCached(url: string, maxAgeHours: number): boolean {
  try {
    return Date.now() - fs.statSync(cachePath(url)).mtimeMs < maxAgeHours * 3600_000;
  } catch {
    return false;
  }
}

/** GET text with a disk cache (maxAgeHours). Stale cache is used if the network fails. */
export async function cachedText(
  url: string,
  maxAgeHours: number,
  opts: { skipRobots?: boolean; headers?: Record<string, string> } = {}
): Promise<string> {
  const file = cachePath(url);
  let stale: string | null = null;
  try {
    const st = fs.statSync(file);
    const body = fs.readFileSync(file, "utf8");
    if (Date.now() - st.mtimeMs < maxAgeHours * 3600_000) return body;
    stale = body;
  } catch {}
  try {
    const res = await politeFetch(url, opts);
    const body = await res.text();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, body);
    return body;
  } catch (e) {
    if (stale !== null && !(e instanceof FetchError && /robots/.test(e.message))) return stale;
    throw e;
  }
}

export async function cachedJson<T = any>(url: string, maxAgeHours: number, opts: { headers?: Record<string, string> } = {}): Promise<T> {
  return JSON.parse(await cachedText(url, maxAgeHours, opts)) as T;
}
