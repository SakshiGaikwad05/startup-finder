// Shared types. `null` always means "unknown / not verified".
import type { FoundEmail } from "@/lib/emails";
export type { FoundEmail };

export interface CandidateProfile {
  name?: string;
  target_roles: string[];
  skills: string[];
  programming_languages: string[];
  frameworks: string[];
  libraries: string[];
  databases: string[];
  cloud_tools: string[];
  testing_skills: string[];
  ai_ml_skills: string[];
  projects: { name: string; year?: number; stack?: string[] }[];
  experience: { title: string; company: string; location?: string; start?: string | null; end?: string | null; note?: string }[];
  tech_experience_years: number;
  education: { degree: string; institution: string; graduated?: number }[];
  preferred_locations: string[];
  remote_preference: string;
  /** e.g. ["AI", "HealthTech"]; empty = any. "AI" means is_ai startups; others are industries. */
  preferred_startup_types?: string[];
  [key: string]: unknown;
}

export type RemoteFlag = "yes" | "no" | "unknown";

/** A job as returned by a source adapter (before storage). */
export interface JobResult {
  title: string;
  url: string;
  applyUrl?: string | null;
  location?: string | null;
  remote: RemoteFlag;
  remoteScope?: string | null;
  employmentType?: string | null;
  postedDate?: string | null;
  minExperience?: string | null;
  salary?: string | null;
  skills?: string[];
  description?: string | null;
  source: string;
  sourceUrl: string;
}

export interface FundingResult {
  date: string | null; // ISO date
  amount: string | null;
  round: string | null;
  investors: string[];
  source: string;
  sourceUrl: string;
}

/** A startup as returned by a source adapter (before dedup/storage). */
export interface StartupResult {
  name: string;
  website?: string | null;
  linkedinUrl?: string | null;
  careersUrl?: string | null;
  description?: string | null;
  location?: string | null;
  tags?: string[];
  industryHint?: string | null;
  foundedYear?: number | null;
  funding?: FundingResult | null;
  source: string;
  sourceUrl: string;
  jobs?: JobResult[];
  /** Emails found on the startup's own pages. Undefined = not checked this time. */
  emails?: FoundEmail[];
}

export interface DiscoveryContext {
  profile: CandidateProfile;
  queries: string[];
  log: (msg: string) => void;
  /** Startups already in the DB that have a website but no known careers page (for careers-page lookups). */
  careersCandidates: { id: number; name: string; website: string }[];
}

/** Every discovery source implements this. Add a new folder under sources/ and register it. */
export interface StartupSource {
  id: string;
  name: string;
  /** Returns a reason string when the source can't run (e.g. missing API key). */
  disabledReason(): string | null;
  discover(ctx: DiscoveryContext): Promise<StartupResult[]>;
}

// ---------- read models for the UI ----------

export interface JobMatch {
  match_score: number;
  relevance: "strong" | "potential" | "low" | "not_relevant";
  /** Why relevance was lowered despite the score (location / seniority). */
  cap_reason: string | null;
  role_match: { level: "strong" | "partial" | "none"; matched_role: string | null; points: number; note: string };
  matched_skills: string[];
  missing_skills: string[];
  skill_points: number;
  location_match: { level: "match" | "partial" | "none" | "unknown"; label: string; points: number };
  experience_match: { level: "fits" | "stretch" | "too_senior" | "unknown"; label: string; points: number };
}

export interface JobView {
  id: number;
  startup_id: number;
  job_title: string;
  job_url: string;
  apply_url: string | null;
  location: string | null;
  remote: RemoteFlag;
  remote_scope: string | null;
  employment_type: string | null;
  posted_date: string | null;
  min_experience: string | null;
  salary: string | null;
  skills: string[];
  source: string;
  source_url: string | null;
  discovered_at: string;
  is_active: boolean;
  location_tags: string[];
  role_categories: string[];
  match: JobMatch;
}

export interface ApplicationView {
  id: number;
  startup_id: number;
  job_id: number | null;
  status: string;
  applied_at: string | null;
  application_url: string | null;
  notes: string | null;
  updated_at: string;
  startup_name?: string;
  job_title?: string | null;
}

export interface StartupView {
  id: number;
  name: string;
  website: string | null;
  domain: string | null;
  linkedin_url: string | null;
  careers_url: string | null;
  description: string | null;
  location: string | null;
  remote_available: boolean | null;
  industry: string | null;
  is_ai: boolean | null;
  ai_category: string | null;
  classification_confidence: string | null;
  classification_reasons: string[];
  founded_year: number | null;
  is_new_startup: boolean | null;
  age_bucket: "new" | "early" | "growing" | "established" | "unknown";
  funding_status: FundingStatus;
  last_funding_date: string | null;
  last_funding_amount: string | null;
  funding_round: string | null;
  investors: string[] | null;
  funding_source: string | null;
  funding_source_url: string | null;
  source: string;
  source_url: string | null;
  sources_seen: string[];
  field_sources: Record<string, { source: string; url: string }>;
  first_discovered_at: string;
  last_seen_at: string;
  last_updated_at: string;
  last_change_reason: string | null;
  show_again: boolean;
  is_fresh: boolean; // new or updated in the latest run window, or "show again"
  location_tags: string[];
  emails: FoundEmail[];
  jobs: JobView[];
  relevant_jobs: number;
  best_match: number;
  relevance: "strong" | "potential" | "low";
  applications: ApplicationView[];
}

export type FundingStatus = "funded_30" | "funded_90" | "funded_180" | "older" | "unknown";

export const APPLICATION_STATUSES = [
  "Not Applied",
  "Saved",
  "Applied",
  "Interview",
  "Rejected",
  "Offer",
  "Not Interested",
] as const;

export const LOCATION_OPTIONS = [
  "Pune",
  "Remote",
  "Remote - India",
  "India",
  "Mumbai",
  "Bangalore",
  "Hyderabad",
  "Delhi NCR",
  "Other",
] as const;

export const CATEGORIES = [
  "AI Startup",
  "SaaS",
  "FinTech",
  "HealthTech",
  "EdTech",
  "Developer Tools",
  "Cybersecurity",
  "E-commerce",
  "Web3",
  "ClimateTech",
  "Consumer",
  "Other",
] as const;
