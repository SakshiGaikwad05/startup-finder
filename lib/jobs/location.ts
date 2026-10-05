// Location parsing. Remote is ONLY inferred from explicit text in the job's own location,
// never from a company being "remote-friendly".
import type { RemoteFlag } from "@/lib/types";

const CITY_PATTERNS: [string, RegExp][] = [
  ["Pune", /\bpune\b|\bpimpri\b|\bhinjewadi\b|\bkharadi\b|\bhadapsar\b/i],
  ["Mumbai", /\bmumbai\b|\bbombay\b|\bnavi mumbai\b|\bthane\b/i],
  ["Bangalore", /\bbengaluru\b|\bbangalore\b|\bbengalore\b|,\s*KA\b/i],
  ["Hyderabad", /\bhyderabad\b|\btelangana\b|,\s*TS\b/i],
  ["Delhi NCR", /\bdelhi\b|\bgurugram\b|\bgurgaon\b|\bnoida\b|\bghaziabad\b|\bfaridabad\b|,\s*DL\b/i],
];

const INDIA = /\bindia\b|,\s*IN\b|\(IN\)|\bIN\s*$|,\s*(MH|KA|TS|DL|HR|UP|TN|GJ|WB|KL|RJ)\b/i;

export function parseRemote(location: string | null | undefined): { remote: RemoteFlag; scope: string | null } {
  if (!location) return { remote: "unknown", scope: null };
  if (!/\bremote\b|work from home|\bwfh\b|anywhere/i.test(location)) {
    return { remote: "no", scope: null };
  }
  // Look at the text around "remote" for an explicit region.
  // "Remote (PT; GB)" / "Remote (Bengaluru, KA, IN)" / "Remote (SC, US; IN, US)" ← IN, US is Indiana.
  const paren = [...location.matchAll(/remote\s*\(([^)]+)\)/gi)].map((m) => m[1]);
  if (paren.length) {
    const items = paren.flatMap((p) => p.split(/\s*;\s*/));
    const isIndia = (i: string) => /india/i.test(i) || /^IN$/i.test(i.trim()) || /,\s*IN$/.test(i.trim());
    if (items.some(isIndia)) return { remote: "yes", scope: "India" };
    if (items.some((i) => /worldwide|anywhere|global/i.test(i))) return { remote: "yes", scope: "Worldwide" };
    if (items.some((i) => /\bAPAC\b|\basia\b/i.test(i))) return { remote: "yes", scope: "APAC" };
    // "SC, US" → "US"; "Europe" stays "Europe".
    const short = items
      .map((i) => (/,\s*[A-Z]{2}$/.test(i.trim()) ? i.split(",").pop()!.trim() : i.trim()))
      .filter((v, k, a) => a.indexOf(v) === k);
    return { remote: "yes", scope: short.length > 4 ? `${short.slice(0, 4).join(", ")}…` : short.join(", ") };
  }
  const parts = location.split(/\s*[\/;|]\s*/).filter((p) => /remote|anywhere|work from home|wfh/i.test(p));
  const text = parts.join(" ") || location;
  let scope: string | null = null;
  if (/india|\(IN\)/i.test(text)) scope = "India";
  else if (/worldwide|anywhere|global/i.test(text)) scope = "Worldwide";
  else if (/\bAPAC\b|asia/i.test(text)) scope = "APAC";
  else if (/\(US\)|\bUSA?\b|united states|north america|americas/i.test(text)) scope = "US";
  else if (/europe|\bEU\b|\bUK\b|emea/i.test(text)) scope = "Europe";
  return { remote: "yes", scope };
}

/** Tags used by the location filter: Pune / Remote / Remote - India / Mumbai / ... / India / Other */
export function locationTags(location: string | null | undefined, remote: RemoteFlag, scope: string | null): string[] {
  const tags = new Set<string>();
  if (remote === "yes") {
    const indiaOk = scope === "India" || scope === "Worldwide" || scope === "APAC";
    // "Remote" = remote and not explicitly restricted to another country/region.
    if (indiaOk || scope === null) tags.add("Remote");
    else tags.add("Other");
    if (indiaOk) tags.add("Remote - India");
  }
  if (location) {
    // Ignore the remote part when deriving cities.
    const onsite = location
      .split(/\s*[\/;|]\s*/)
      .filter((p) => !/^\s*remote\b/i.test(p))
      .join(" / ");
    let city = false;
    for (const [name, re] of CITY_PATTERNS) {
      if (re.test(onsite)) {
        tags.add(name);
        city = true;
      }
    }
    if (city || INDIA.test(onsite)) tags.add("India");
    if (!city && onsite.trim() && !INDIA.test(onsite)) tags.add("Other");
  }
  if (tags.size === 0) tags.add("Other");
  return [...tags];
}

export function companyLocationTags(location: string | null | undefined): string[] {
  // Company HQ never implies remote.
  return location ? locationTags(location, "no", null) : [];
}
