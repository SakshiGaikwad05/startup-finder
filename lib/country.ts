// Headquarters country (India / United States). Only the company's own location counts —
// never an investor's, and never the country of the news outlet that reported it.

export type HqCountry = "India" | "United States";
export type HqConfidence = "high" | "medium" | "low";

const INDIA_PLACES =
  /\b(india|indian|bengaluru|bangalore|mumbai|bombay|navi mumbai|thane|new delhi|delhi|gurugram|gurgaon|noida|ghaziabad|faridabad|pune|hyderabad|chennai|kolkata|ahmedabad|jaipur|kochi|cochin|chandigarh|mohali|indore|coimbatore|thiruvananthapuram|trivandrum|bhubaneswar|lucknow|surat|nagpur|mysuru|mysore|goa|vadodara|visakhapatnam|bhopal|kanpur|patna|guwahati|dehradun)\b/i;
// Delaware is left out on purpose: "Delaware-based" usually means where a company is incorporated.
const US_PLACES =
  /\b(united states|usa|u\.s\.a?\.?|us|american|san francisco|sf|bay area|silicon valley|new york|nyc|brooklyn|manhattan|seattle|boston|cambridge, ma|austin|los angeles|palo alto|mountain view|menlo park|san jose|san mateo|redwood city|sunnyvale|oakland|berkeley|san diego|chicago|denver|boulder|miami|atlanta|washington,? d\.?c\.?|philadelphia|pittsburgh|salt lake city|dallas|houston|nashville|portland|minneapolis|detroit|raleigh|california|texas|massachusetts|colorado|florida|georgia|illinois|washington state|new jersey)\b/i;

/** "Bengaluru, KA, IN" / "San Francisco, CA, US" / "Pune" / "New York-based" → country, or null if unclear. */
export function countryFromLocation(text: string | null | undefined): HqCountry | null {
  if (!text) return null;
  const t = text.trim();
  // A trailing ISO country code is the most reliable signal ("Indianapolis, IN, US" is the US).
  const code = t.match(/,\s*([A-Z]{2,3})\s*$/);
  if (code) {
    if (code[1] === "US" || code[1] === "USA") return "United States";
    if (code[1] === "IN" || code[1] === "IND") return "India";
  }
  const india = INDIA_PLACES.test(t);
  // "US" as a bare word is too ambiguous inside prose ("let us"), so only trust it in short location strings.
  const us = US_PLACES.test(t) && (t.length < 60 || !/\bus\b/i.test(t) || /\b(united states|u\.s\.)/i.test(t));
  if (india && !us) return "India";
  if (us && !india) return "United States";
  return null;
}

/** ISO 3166 code from a structured source (e.g. YC's `country` field). */
export function countryFromCode(code: string | null | undefined): HqCountry | null {
  const c = (code ?? "").trim().toUpperCase();
  if (c === "IN" || c === "IND") return "India";
  if (c === "US" || c === "USA") return "United States";
  return null;
}

const RANK: Record<HqConfidence, number> = { high: 3, medium: 2, low: 1 };
export const confidenceRank = (c: HqConfidence | null | undefined) => (c ? RANK[c] : 0);

// No flag emoji: Windows renders them as plain letters ("IN", "US").
export const COUNTRY_SHORT: Record<HqCountry, string> = { India: "India", "United States": "USA" };
