# Daily Startup Finder (v0)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Every day, find startups (Pune + Remote by default) that are hiring for **your** profile,
and show exactly why each job matches. Upload a resume or pick skills, locations and startup types.

**Live:** https://startup-finder.sakshii.tech · Next.js + TypeScript + Tailwind + PostgreSQL

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

## For users

Anyone can use it — no sign-up:
1. **Set up a profile** (`/onboarding`): upload a resume PDF (skills/roles are detected and shown for review; the file isn't stored) or type skills, pick target roles and experience, locations, and preferred startup types (AI, HealthTech, …).
2. **Dashboard**: startups and jobs are shared, but match scores, filters, pins and the application tracker are per person.
3. The profile is kept in a secure cookie. **My profile → Your private link** reopens it on another device.

"Find Startups Today" runs one shared search with fresh funding news and job boards; if one ran in the last 10 minutes, users just get those results.

## Deploy (Render + Neon)

1. Create a free PostgreSQL database on [Neon](https://neon.tech) and copy its connection string.
2. On [Render](https://render.com): **New → Blueprint** → pick this repo (uses `render.yaml`), or **New → Web Service** with
   build `npm ci --include=dev && npm run build`, start `npm start`.
3. Environment: `DATABASE_URL` = Neon string, `NODE_VERSION` = `22`. Leave `APP_PASSWORD` empty for a public site.
4. Custom domain: Render → Settings → Custom Domains → add e.g. `startups.sakshii.tech`, then add the CNAME record it shows at your DNS provider.
5. Optional daily search: a free scheduler (e.g. cron-job.org) sending `POST https://<your-domain>/api/discover` with header `x-cron-secret: <CRON_SECRET>`.

Tables are created automatically on first request.

## How it works

`Find Startups Today` runs each source in `sources/` and stores results:

| Source | What it gives | Notes |
|---|---|---|
| `yc` | Hiring YC companies (recent batches: India, US and fully remote); HQ country, other offices, founders + LinkedIn, founded year, jobs | yc-oss open dataset + public YC company pages (robots.txt allows them). Up to 60 new pages/run, cached 20h |
| `producthunt` | Startups that launched on Product Hunt in the last 3 months with 100+ upvotes | Official API, needs `PRODUCT_HUNT_TOKEN` |
| `himalayas` | Remote jobs open to India (India-only or worldwide) | Public API, no key, cached 1h |
| `funding_rss` | Funding announcements (date, amount, round, investors, article URL, confirmed/planned/rumored) | Free RSS: Inc42, ET Tech Funding, ET Startups, Entrackr, YourStory, TechCrunch Fundraising + Startups, Crunchbase News |
| `company_careers` | Careers page, jobs from public Greenhouse / Lever / Ashby boards or schema.org JobPosting, public emails | For known startups with a website |
| `search` | Profile-generated queries → public ATS job boards | Optional, needs `SEARCH_API_KEY` (Brave Search API, has a free tier) |
| Frankfurter | USD exchange rates (ECB) for the amount filter | Free, no key. If unreachable, the original amount is shown and the amount filter skips that startup |

Every source above is free. There are no paid APIs, paid databases or paid email tools, and nothing needs billing.

### Sources that need checking by hand
These were checked and are **not** automated:

| Source | Why |
|---|---|
| VCCircle | No public RSS feed; most articles are behind a paywall |
| Crunchbase (database / API) | The API is paid. Only the free Crunchbase **News** RSS is used |
| Wellfound, LinkedIn Jobs | Need a login, and their terms forbid automated access. Cards link to a LinkedIn Jobs search so you can check yourself |
| YourStory | Feed works, but few funding headlines; kept for coverage |

### Country, funding and verification rules
- **Country = headquarters**, never an investor's location or the news outlet's country. Evidence and confidence are stored and shown:
  YC company page `country` (high) → "Bengaluru-based Foo" / "Indian startup Foo" in the headline (medium) → round announced in ₹ (low, shown as "likely").
  Disagreeing evidence of equal strength is flagged as a conflict. Other offices are stored separately (`other_locations`).
- **Funding date = announcement date** (the article's publish date; the earliest confirmed report of the same round), not when we found it.
- **Confirmed vs planned vs rumored**: "in talks to raise", "eyes", "plans to raise" → planned; "reportedly", "sources say" → unconfirmed. Both are shown with a badge and can be hidden with *Confirmed announcements only*. A confirmed round always beats a newer rumor.
- **Verification**: a second, different outlet reporting the same round is shown as *Independently confirmed*. Different amounts (>15%) or rounds within 45 days are flagged as *Sources disagree*.
- **Amounts** keep the original text and currency (`₹25 Cr`); USD is added only when a free rate is available.
- **Emails** come only from the startup's own website and are labelled Careers (careers@, jobs@, recruiting@), Hiring (hiring@, hr@, talent@), General contact, or Person. Nothing is guessed. Missing ones show "Not publicly available".
- **Openings** are "verified" only when read from a job board (YC, Greenhouse, Lever, Ashby, Himalayas) or schema.org JobPosting on the company's own careers page. Otherwise: "No verified opening found". Funding doesn't mean hiring.
- **Founders** are listed only from structured public pages (YC), with their profile link and source.

### Filters
Country (India / USA / Both), funding recency (7 / 30 / 60 / 90 days), confirmed-only, funding stage (Pre-seed, Seed, Series A, Series B+),
funding amount (USD buckets), industry (AI & AI Agents, Generative AI & LLMs, SaaS, Developer Tools, FinTech, HealthTech, EdTech,
Cybersecurity, E-commerce, ClimateTech, Robotics, Enterprise Software, Data & Analytics, Other), role type (Internship / Fresher / Junior /
Experienced), work arrangement (Remote / Hybrid / Onsite), verified openings, public contact email. "Explore" mode defaults to the last 30 days.

All HTTP goes through `lib/http.ts`: robots.txt check, ≥1.5s between requests per host, timeouts, disk cache in `.cache/`.

**Adding a source:** implement `StartupSource` (`lib/types.ts`) in a new folder and add it to `sources/index.ts`.

### Data-quality rules
- Unknown/unverified values are stored as `NULL` and shown as "Not known" / "Not publicly available". Nothing is guessed.
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

## Known limitations
- No LLM calls: classification and matching are deterministic. The obvious next step is an optional LLM pass for
  low-confidence AI/industry classification only.
- Wellfound / LinkedIn are not scraped (authentication / terms).
- Funding-news startups often have no website in the article, so their careers page, emails and jobs are only found if another source knows them.
- The announcement date is the article's publish date: usually the same day, occasionally a day later.
- RSS feeds only carry the latest ~10–50 articles, so funding older than a few days is only kept if a previous run saw it.
  Run discovery daily (see Deploy, step 5) to build up 30–90 days of history.
- Many news-only startups have no stated HQ and show "Country unknown"; they're hidden when a country filter is on.
- YC rounds have no announced amount and are shown under the *Accelerator* stage, not Seed.

## Contributing
Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up, test and
submit a change, and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License
[MIT](LICENSE) © 2026 Sakshi Gaikwad.

The license covers this code only. Data the app collects (YC directory, job boards, funding news, company sites)
belongs to those sources and stays under their own terms.

The favicon uses the "space-awesome" icon from [Font Awesome Free](https://fontawesome.com) (CC BY 4.0).
