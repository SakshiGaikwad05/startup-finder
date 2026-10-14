// Exchange rates for showing funding in one currency. Uses Frankfurter (api.frankfurter.app):
// free, no API key, European Central Bank reference rates, updated on working days.
// If it can't be reached, amounts are simply shown in their original currency.
import { cachedJson } from "@/lib/http";
import type { Currency } from "@/lib/funding";

const URL = "https://api.frankfurter.app/latest?from=USD&to=INR,EUR,GBP";

export type UsdRates = Partial<Record<Currency, number>>;

const memo = globalThis as unknown as { __fx?: { at: number; value: Promise<{ rates: UsdRates; date: string } | null> } };

/** 1 USD = rates[currency]. Null when the service is unavailable. Memoised in memory for an hour. */
export function usdRates(): Promise<{ rates: UsdRates; date: string } | null> {
  if (!memo.__fx || Date.now() - memo.__fx.at > 3600_000) memo.__fx = { at: Date.now(), value: fetchRates() };
  return memo.__fx.value;
}

async function fetchRates(): Promise<{ rates: UsdRates; date: string } | null> {
  try {
    const data = await cachedJson<{ date: string; rates: Record<string, number> }>(URL, 24, { headers: { Accept: "application/json" } });
    const rates: UsdRates = {};
    for (const c of ["INR", "EUR", "GBP"] as const) if (typeof data.rates?.[c] === "number" && data.rates[c] > 0) rates[c] = data.rates[c];
    return Object.keys(rates).length ? { rates, date: data.date } : null;
  } catch {
    return null;
  }
}
