// Tunable thresholds. Change these instead of editing logic.
export const settings = {
  /** is_new_startup = founded_year >= this */
  newStartupFoundedYear: 2024,
  /** Startup-age buckets (by founded year, relative to newStartupFoundedYear) */
  earlyStageYears: 3, // founded within N years before the "new" threshold
  growingYears: 10, // founded within N years of today
  /** Funding buckets in days */
  fundingBuckets: [30, 90, 180] as const,
  /** Match-score cut-offs */
  strongMatch: 65,
  potentialMatch: 40,
  /** Politeness: minimum ms between requests to the same host */
  perHostDelayMs: 1500,
  requestTimeoutMs: 25000,
  /** Max YC company pages fetched per discovery run (each is ~100KB) */
  ycMaxCompanyPages: 60,
  /** Max company websites checked for a careers page per run */
  maxCareersChecks: 25,
  /** Cache lifetimes */
  cacheHours: { ycDirectory: 20, ycCompanyPage: 20, remotive: 6, rss: 3, robots: 24 },
  userAgent: "DailyStartupFinder/0.1 (personal job-search tool; respects robots.txt)",
};

export type Settings = typeof settings;
