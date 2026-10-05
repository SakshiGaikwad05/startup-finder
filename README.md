# Daily Startup Finder (v0)

Personal tool: every day, find startups (Pune + Remote by default) that are hiring for **your** profile,
and show exactly why each job matches.

## Run it

```bash
npm install
cp .env.example .env          # DATABASE_URL points at port 5433
npm run db:local              # starts a project-local PostgreSQL (uses your PostgreSQL 18 install)
#   or: npm run db:up         # same thing via Docker, if Docker Desktop is running
npm run dev                   # http://localhost:3000
```

Tables are created automatically on first request (`lib/database/schema.sql`), and the candidate
profile is seeded from `config/candidate_profile.json`.

Other commands: `npm run discover` (same as the button, from the terminal), `npm test` (logic checks),
`npm run typecheck`, `npm run db:local:stop`.

## How it works

`Find Startups Today` runs each source in `sources/` and stores results:

| Source | What it gives | Notes |
|---|---|---|
| `yc` | Hiring YC companies in India + fully-remote ones; founded year, LinkedIn, jobs (location, experience, salary) | yc-oss open dataset + public YC company pages (robots.txt allows them). Up to 60 new pages/run, cached 20h |
| `remotive` | Remote jobs open to India / Worldwide / APAC | Public API, cached 6h |
| `funding_rss` | Funding announcements (date, amount, round, investors, article URL) | Inc42, YourStory, TechCrunch RSS. Headline must explicitly state a raise |
| `company_careers` | Careers page + jobs from public Greenhouse / Lever / Ashby boards | For known startups with a website but no jobs yet |
| `search` | Profile-generated queries → public ATS job boards | Optional, needs `SEARCH_API_KEY` (Brave Search API) |

All HTTP goes through `lib/http.ts`: robots.txt check, ≥1.5s between requests per host, timeouts, disk cache in `.cache/`.

**Adding a source:** implement `StartupSource` (`lib/types.ts`) in a new folder and add it to `sources/index.ts`.

### Data-quality rules
- Unknown/unverified values are stored as `NULL` and shown as "Unknown". Nothing is guessed.
- A job is remote only when its **own** location text says so (`lib/jobs/location.ts`); "Remote (US)" is not counted as India-eligible.
- Funding is only recorded from a source (YC batch page or a news article); the URL is shown on the startup page.
  An undated YC investment counts as "Older funding" only if the batch year is before this year.
- `is_new_startup = founded_year >= 2024` (configurable in `config/settings.ts`); unknown if no founded year.
- AI startup: needs a source AI tag, AI in the one-line pitch, or repeated AI language — a single mention isn't enough. Reasons are stored and shown.

### Matching (`lib/matching`)
Score out of 100 = **role** (40) + **skills** (30) + **location** (20) + **experience** (10). Each part is shown under "Why".
Skills you "have" come only from the profile; skills a job mentions that you don't have are listed under "Missing".
Sales/HR/marketing etc. are marked *not relevant* and don't count toward a startup's match.
Matching runs on read, so editing the profile in **Settings** changes scores immediately.

### "Don't show it again"
Dashboard defaults to **New & updated today**: startups first discovered today, or updated today
(new relevant job, funding change, company info change, careers page found), or pinned with **Show again**.
Switch to **All startups** to see everything.

## Not in v0
- No LLM calls: classification and matching are deterministic. The obvious next step is an optional LLM pass for
  low-confidence AI/industry classification only.
- Wellfound / LinkedIn are not scraped (authentication / terms).
- Funding-news startups usually have no website, so jobs for them are only found if another source knows them.
