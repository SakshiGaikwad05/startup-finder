// Tunable thresholds. Change these instead of editing logic.
export const settings = {
  /** is_new_startup = founded_year >= this */
  newStartupFoundedYear: 2024,
  /** Startup-age buckets (by founded year, relative to newStartupFoundedYear) */
  earlyStageYears: 3, // founded within N years before the "new" threshold
  growingYears: 10, // founded within N years of today
  /** Funding buckets in days */
  fundingBuckets: [30, 90, 180] as const,
  /**
   * Only startups funded within this many days are added and shown (YC batches dated at Demo Day).
   * Older ones stay hidden unless the user saved, applied to or pinned them.
   */
  addFundedWithinDays: 90,
  /** Only jobs posted in the last N days are stored and shown (undated: N days since we first saw them). */
  maxJobAgeDays: 7,
  /** Match-score cut-offs */
  strongMatch: 65,
  potentialMatch: 40,
  /** Politeness: minimum ms between requests to the same host */
  perHostDelayMs: 1500,
  requestTimeoutMs: 25000,
  /** Max YC company pages fetched per discovery run (each is ~100KB) */
  ycMaxCompanyPages: 60,
  /** Himalayas: pages of 20 newest remote jobs open to India read per run */
  himalayasPages: 10,
  /** Max company websites checked for a careers page per run */
  maxCareersChecks: 25,
  /** Open source: YC pages read per run to find GitHub accounts, GitHub searches per run, accounts per search */
  ossMaxCompanyPages: 50,
  ossMaxSearches: 10,
  ossOrgsPerSearch: 8,
  /** Open source, popular projects: repos per run (GitHub repo search), repos per issue search, minimum stars */
  ossPopularRepos: 30,
  ossReposPerSearch: 6,
  ossPopularMinStars: 1000,
  /** Open source: only issues updated in the last N days are suggested */
  ossIssueMaxAgeDays: 180,
  /** Cache lifetimes */
  // Funding news and job boards are re-read on every new run (runs are at least 10 minutes apart);
  // the YC directory is a daily mirror, so a day-long cache loses nothing.
  cacheHours: { ycDirectory: 20, ycCompanyPage: 20, jobBoards: 1, rss: 0.25, robots: 24, githubSearch: 6 },
  userAgent: "DailyStartupFinder/0.1 (personal job-search tool; respects robots.txt)",
};

export type Settings = typeof settings;
