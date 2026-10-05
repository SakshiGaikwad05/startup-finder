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
    id: "remotive",
    name: "Remotive remote jobs",
    kind: "job_board",
    baseUrl: "https://remotive.com/api/remote-jobs",
    notes: "Public API. Only jobs whose candidate location includes India/Worldwide/APAC are kept. Max a few calls per day (cached).",
  },
  {
    id: "funding_rss",
    name: "Funding news (Inc42, YourStory, TechCrunch)",
    kind: "news",
    baseUrl: null,
    notes: "Public RSS feeds. Only headlines that explicitly state a raise are parsed; the article URL is stored as the funding source.",
  },
  {
    id: "company_careers",
    name: "Company websites / careers pages",
    kind: "company",
    baseUrl: null,
    notes: "Looks for a careers link on a startup's own website and reads public Greenhouse / Lever / Ashby job-board APIs.",
  },
  {
    id: "search",
    name: "Web search (Brave Search API)",
    kind: "search",
    baseUrl: "https://api.search.brave.com",
    notes: "Optional (needs SEARCH_API_KEY). Runs profile-based queries against public ATS job boards.",
  },
] as const;
