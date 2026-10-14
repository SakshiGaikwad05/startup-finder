// Formatting helpers shared by client cards and server pages (no hooks, no "use client").
import type { StartupView } from "@/lib/types";

export function daysAgo(date: string) {
  const d = Math.round((Date.now() - new Date(date).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

export function formatUsd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

export const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "₹25 Cr (≈ $2.6M)": the original amount always, USD only when we could convert it. */
export function fundingAmountText(s: Pick<StartupView, "last_funding_amount" | "funding_amount_usd" | "funding_currency">): string | null {
  if (!s.last_funding_amount) return null;
  if (s.funding_amount_usd && s.funding_currency && s.funding_currency !== "USD") return `${s.last_funding_amount} (≈ ${formatUsd(s.funding_amount_usd)})`;
  return s.last_funding_amount;
}

/** "Announced 13 Oct 2026 (yesterday)", or for YC rounds an explicit estimate, never presented as an announcement. */
export function fundingDateText(s: Pick<StartupView, "last_funding_date" | "funding_date_approximate">): string {
  if (!s.last_funding_date) return "Announcement date not publicly available";
  const month = new Date(s.last_funding_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  if (s.funding_date_approximate) return `No announcement date; YC batch, Demo Day ≈ ${month}`;
  return `Announced ${fmtDate(s.last_funding_date)} (${daysAgo(s.last_funding_date)})`;
}

/** Badge for anything that isn't a confirmed announcement, so it never reads as fact. */
export function FundingKindBadge({ kind }: { kind: StartupView["funding_kind"] }) {
  if (!kind || kind === "confirmed") return null;
  return (
    <span
      className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800"
      title={kind === "planned" ? "The article says this round is planned or in progress, not closed" : "Reported by the press but not confirmed by the company"}
    >
      {kind === "planned" ? "Planned round" : "Unconfirmed report"}
    </span>
  );
}
