-- Daily Startup Finder schema. Idempotent: safe to run on every start.
-- NULL means "unknown / not verified". The UI renders NULL as "Unknown".

CREATE TABLE IF NOT EXISTS candidate_profile (
  id          SERIAL PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id            TEXT PRIMARY KEY,          -- e.g. 'yc', 'remotive', 'funding_rss'
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,             -- 'directory' | 'job_board' | 'news' | 'search' | 'company'
  base_url      TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  last_status   TEXT,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS startups (
  id                        SERIAL PRIMARY KEY,
  name                      TEXT NOT NULL,
  normalized_name           TEXT NOT NULL,
  website                   TEXT,
  domain                    TEXT,
  linkedin_url              TEXT,
  careers_url               TEXT,
  description               TEXT,
  location                  TEXT,
  remote_available          BOOLEAN,       -- true only if a job/source explicitly says remote
  industry                  TEXT,
  is_ai                     BOOLEAN,
  ai_category               TEXT,
  classification_confidence TEXT,          -- 'high' | 'medium' | 'low'
  classification_reasons    JSONB NOT NULL DEFAULT '[]',
  founded_year              INT,
  is_new_startup            BOOLEAN,
  funding_status            TEXT,          -- computed on read too; stored for convenience
  last_funding_date         DATE,
  last_funding_amount       TEXT,          -- verbatim from source, e.g. '₹25 Cr'
  funding_round             TEXT,
  investors                 TEXT[],
  funding_source            TEXT,
  funding_source_url        TEXT,
  source                    TEXT NOT NULL, -- first source that found it
  source_url                TEXT,
  sources_seen              TEXT[] NOT NULL DEFAULT '{}',
  field_sources             JSONB NOT NULL DEFAULT '{}', -- field -> source URL
  raw_tags                  TEXT[] NOT NULL DEFAULT '{}',
  first_discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_change_reason        TEXT,
  show_again                BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS startups_domain_uq ON startups (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS startups_norm_idx ON startups (normalized_name);
CREATE INDEX IF NOT EXISTS startups_linkedin_idx ON startups (linkedin_url);

CREATE TABLE IF NOT EXISTS jobs (
  id               SERIAL PRIMARY KEY,
  startup_id       INT NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  job_title        TEXT NOT NULL,
  job_url          TEXT NOT NULL UNIQUE,
  apply_url        TEXT,
  location         TEXT,
  remote           TEXT NOT NULL DEFAULT 'unknown', -- 'yes' | 'no' | 'unknown'
  remote_scope     TEXT,                            -- 'India' | 'Worldwide' | 'US' | ... | NULL
  employment_type  TEXT,
  posted_date      TEXT,                            -- as given by source (may be relative)
  min_experience   TEXT,
  salary           TEXT,                            -- only if the source states it
  skills           TEXT[] NOT NULL DEFAULT '{}',
  description      TEXT,
  source           TEXT NOT NULL,
  source_url       TEXT,
  discovered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active        BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS jobs_startup_idx ON jobs (startup_id);

CREATE TABLE IF NOT EXISTS applications (
  id               SERIAL PRIMARY KEY,
  startup_id       INT NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  job_id           INT REFERENCES jobs(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'Saved',
  applied_at       DATE,
  application_url  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS applications_startup_job_uq
  ON applications (startup_id, COALESCE(job_id, 0));

-- One row per "Find Startups Today" run, so the dashboard can say what is new today.
CREATE TABLE IF NOT EXISTS discovery_runs (
  id           SERIAL PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running',
  log          JSONB NOT NULL DEFAULT '[]',
  stats        JSONB NOT NULL DEFAULT '{}'
);
