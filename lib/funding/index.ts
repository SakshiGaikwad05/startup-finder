// Funding + startup-age helpers.
import { settings } from "@/config/settings";
import type { FundingStatus } from "@/lib/types";

export function fundingStatus(lastFundingDate: string | Date | null, fundingRound: string | null, now = new Date()): FundingStatus {
  if (!lastFundingDate) {
    // No exact date: only call it "older" when the round itself names an earlier year (e.g. "YC Winter 2021").
    const y = fundingRound?.match(/\b(20\d{2})\b/);
    return y && parseInt(y[1], 10) < now.getFullYear() ? "older" : "unknown";
  }
  const d = new Date(lastFundingDate);
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  const [a, b, c] = settings.fundingBuckets;
  if (days <= a) return "funded_30";
  if (days <= b) return "funded_90";
  if (days <= c) return "funded_180";
  return "older";
}

export const FUNDING_LABELS: Record<FundingStatus, string> = {
  funded_30: "Funded <30 days",
  funded_90: "Funded <90 days",
  funded_180: "Funded <180 days",
  older: "Older funding",
  unknown: "Unknown",
};

export function isNewStartup(foundedYear: number | null): boolean | null {
  return foundedYear == null ? null : foundedYear >= settings.newStartupFoundedYear;
}

export function ageBucket(foundedYear: number | null, now = new Date()): "new" | "early" | "growing" | "established" | "unknown" {
  if (foundedYear == null) return "unknown";
  if (foundedYear >= settings.newStartupFoundedYear) return "new";
  if (foundedYear >= settings.newStartupFoundedYear - settings.earlyStageYears) return "early";
  if (foundedYear >= now.getFullYear() - settings.growingYears) return "growing";
  return "established";
}

/** YC batch ("Winter 2021", "Fall 2025") → year. YC invests at the batch, so the year is a verified funding fact. */
export function ycBatchYear(batch: string | null | undefined): number | null {
  const m = batch?.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------- funding headline parsing (deterministic) ----------

const VERB = /\b(raises?|raised|secures?|secured|bags?|bagged|nets?|netted|gets?|lands?|closes?|closed|picks up|mops up|receives?|scoops? up|garners?)\b/i;
const AMOUNT =
  /((?:₹|rs\.?|inr|\$|usd|us\$|€|£)\s?[\d.,]+\s?(?:cr(?:ore)?s?|lakh|lakhs|mn|million|m|bn|billion|k)?|[\d.,]+\s?(?:cr(?:ore)?s?|lakh|mn|million|bn|billion)\b(?:\s?(?:usd|inr|dollars|rupees))?)/i;
const ROUND = /\b(pre-?seed|seed|pre-?series [a-f]|series [a-f]\d?|angel|bridge|growth|debt|venture debt|ipo)\b/i;

export interface ParsedFunding {
  company: string;
  amount: string | null;
  round: string | null;
  investors: string[];
  locationHint: string | null;
}

/** Returns null unless the headline explicitly says a company raised money. */
export function parseFundingHeadline(title: string, summary = ""): ParsedFunding | null {
  const t = title.replace(/\s+/g, " ").trim();
  const v = t.match(VERB);
  if (!v || v.index === undefined) return null;
  const after = t.slice(v.index + v[0].length);
  const amount = after.match(AMOUNT)?.[1]?.trim() ?? null;
  const roundIn = (after + " " + summary).match(ROUND)?.[1] ?? null;
  if (!amount && !roundIn) return null; // "X raises the bar" etc.
  if (!/fund|round|series|seed|investment|capital|cr\b|crore|mn|million|\$|₹/i.test(after)) return null;

  let company = t.slice(0, v.index).trim();
  // Strip descriptors: "Pune-based AI startup Foo" → "Foo"; "Funding: Foo" → "Foo"
  company = company.replace(/^.*?:\s*/, "");
  const locMatch = company.match(/\b([A-Z][a-zA-Z]+(?:[- ][A-Z][a-zA-Z]+)?)-based\b/);
  const locationHint = locMatch ? locMatch[1] : (summary.match(/\b([A-Z][a-zA-Z]+)-based\b/)?.[1] ?? null);
  company = company
    .replace(/^.*\b(startup|platform|company|firm|maker|provider|unicorn|player|brand|app|marketplace|fintech|edtech|healthtech|saas|venture)\s+/i, "")
    .replace(/^[\w\s-]*-based\s+/i, "")
    .replace(/^[\w.&]+-backed\s+/i, "") // "a16z-backed EliseAI" → "EliseAI"
    .replace(/['’]s$/, "")
    .trim();
  if (
    !company ||
    company.split(" ").length > 4 ||
    /^(how|why|what|this|these|startups?|indian|top|weekly|two|three|four|five|ex-|former)\b/i.test(company) ||
    /\b(alumni|team|founders?|engineers|execs?|veterans?|researchers)\b/i.test(company) ||
    !/^[A-Z0-9]/.test(company)
  )
    return null; // a description of people, not a verifiable company name

  const investors: string[] = [];
  const led = (after + " " + summary).match(/\b(?:led by|from|backed by|participation (?:of|from))\s+([^.;]+)/i);
  if (led) {
    for (const part of led[1].split(/,|\band\b|\bothers\b/)) {
      const name = part.replace(/\b(existing investors?|others?|among|with|participation.*)$/i, "").trim();
      if (name && name.length < 60 && /[A-Z]/.test(name[0]) && !/^(Series|Seed|its|the round)/i.test(name)) investors.push(name);
    }
  }
  return {
    company,
    amount,
    round: roundIn ? roundIn.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    investors: investors.slice(0, 6),
    locationHint,
  };
}
