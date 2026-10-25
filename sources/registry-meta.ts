// Static metadata for every discovery source (seeded into the `sources` table).
export const SOURCE_DEFS = [
  {
    id: "yc",
    name: "Y Combinator directory",
    kind: "directory",
    baseUrl: "https://www.ycombinator.com/companies",
    notes:
      "Hiring-company list from the open yc-oss dataset (github.com/yc-oss/api), then each public YC company page for founded year, LinkedIn and job postings.",
  },
  {
    id: "producthunt",
    name: "Product Hunt launches",
    kind: "launches",
    baseUrl: "https://api.producthunt.com/v2/api/graphql",
    notes:
      "Official API (needs PRODUCT_HUNT_TOKEN, a free developer token). Most-upvoted launches of the last 90 days; 100+ upvotes counts as a recent signal. Website from the allowed /r/p/ redirect.",
  },
  {
    id: "himalayas",
    name: "Himalayas remote jobs",
    kind: "job_board",
    baseUrl: "https://himalayas.app/jobs/api/search",
    notes:
      "Free public API, no key. Search with country=India returns remote jobs open to India (India-restricted or worldwide), newest first; cached 1h. Job links point to Himalayas as they ask. Replaces Remotive, whose robots.txt now disallows its API.",
  },
  {
    id: "funding_rss",
    name: "Funding news (Inc42, ET, Entrackr, YourStory, TechCrunch, Crunchbase News)",
    kind: "news",
    baseUrl: null,
    notes:
      "Free public RSS feeds (robots.txt checked). Only headlines that state a raise are parsed; planned rounds and unconfirmed reports are labelled as such. The article URL is stored as the funding source.",
  },
  {
    id: "fx_frankfurter",
    name: "Exchange rates (Frankfurter, ECB)",
    kind: "reference",
    baseUrl: "https://api.frankfurter.app",
    notes: "Free, no key. Converts INR/EUR/GBP amounts to USD for the amount filter. If unavailable, the original amount is shown.",
  },
  {
    id: "company_careers",
    name: "Company websites / careers pages",
    kind: "company",
    baseUrl: null,
    notes: "Looks for a careers link on a startup's own website and reads public Greenhouse / Lever / Ashby job-board APIs.",
  },
  {
    id: "oss_github",
    name: "Open-source projects (YC + GitHub)",
    kind: "open_source",
    baseUrl: "https://api.github.com/search/issues",
    notes:
      "YC companies tagged Open Source (yc-oss dataset); their GitHub account from the YC company page; then GitHub's public search API for open, unassigned good-first-issue / help-wanted issues. Optional GITHUB_TOKEN raises the rate limit.",
  },
  {
    id: "search",
    name: "Web search (Brave Search API)",
    kind: "search",
    baseUrl: "https://api.search.brave.com",
    notes: "Optional (needs SEARCH_API_KEY). Runs profile-based queries against public ATS job boards.",
  },
] as const;
