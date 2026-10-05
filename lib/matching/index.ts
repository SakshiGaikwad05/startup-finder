// Transparent candidate ↔ job matching. Score = role (40) + skills (30) + location (20) + experience (10).
// Every point is explained in the returned object so the UI can show "why".
import type { CandidateProfile, JobMatch } from "@/lib/types";
import { settings } from "@/config/settings";
import { candidateSkillSet, skillsMentioned } from "./skills";

/** Known role families. Profile target roles are mapped onto these; unknown roles get a word-based pattern. */
const ROLE_PATTERNS: Record<string, RegExp> = {
  "software engineer":
    /software (engineer|developer|development engineer)|\bsde\b|\bswe\b|engineer(ing)? intern|developer intern|associate engineer|graduate engineer|member of technical staff|product engineer/i,
  "full stack": /full[\s-]?stack/i,
  "backend": /back[\s-]?end|server[\s-]side|\bapi (engineer|developer)/i,
  "frontend": /front[\s-]?end|\bui (engineer|developer)|react (developer|engineer)|web developer/i,
  "python": /\bpython\b/i,
  "node": /\bnode(\.?js)?\b/i,
  "ai engineer": /\bai\b[\w\s/]*(engineer|developer|intern)|(llm|gen\s?ai|generative ai|\bml\b|machine learning|applied ai|ai\/ml) (engineer|developer|intern)|\bai\/ml\b/i,
  "application support": /application support|app support|production support|\bl[12] support/i,
  "technical support": /technical support|tech support|support engineer|solutions engineer|implementation (engineer|specialist)/i,
  "qa": /\bqa\b|quality assurance|\bsdet\b|test (engineer|automation)/i,
  "data": /data (analyst|engineer|scientist)/i,
  "devops": /devops|\bsre\b|site reliability|platform engineer|cloud engineer/i,
  "mobile": /android|\bios\b|mobile (developer|engineer)|flutter|react native/i,
};

const GENERIC_TECH = /engineer|developer|programmer|\bsde\b|\bswe\b|technical|intern\b/i;
const NOT_RELEVANT =
  /\bsales\b|account executive|business development|\bbdr?\b|\bsdr\b|marketing|\bhr\b|human resources|recruit|talent acquisition|people (ops|partner)|finance|accountant|\blegal\b|counsel|operations (manager|associate|executive)|content writer|copywriter|customer success manager|chief\b|head of|\bdirector\b|\bvp\b|vice president|founder'?s office|field (executive|sales)|graphic designer|product designer|\bdesigner\b(?!.*engineer)|\bcontroller\b|\bmedical\b|\bnurse\b|\bdoctor\b|\bphysician\b|\bchef\b|\bdriver\b/i;
const SENIOR = /\bsenior\b|\bsr\.?\b|\bstaff\b|\bprincipal\b|\blead\b|\barchitect\b|\bmanager\b|\bhead\b|\bii{1,2}\b|\b(level|l)\s?[3-9]\b/i;
const JUNIOR = /\bintern(ship)?\b|\bfresher\b|new grad|graduate|entry[- ]level|\bjunior\b|\bjr\.?\b|\btrainee\b|\bassociate\b|0[-–]\d\s*(yrs|years)/i;

function patternForRole(role: string): RegExp {
  const r = role.toLowerCase();
  for (const [key, re] of Object.entries(ROLE_PATTERNS)) {
    if (r.includes(key) || re.test(role)) return re;
  }
  const words = r.split(/[^a-z0-9.+#]+/).filter((w) => w.length > 2 && !["developer", "engineer", "the", "and"].includes(w));
  return words.length ? new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : /$^/;
}

export function roleMatch(title: string, profile: CandidateProfile): JobMatch["role_match"] {
  if (NOT_RELEVANT.test(title) && !/engineer|developer/i.test(title)) {
    return { level: "none", matched_role: null, points: 0, note: "Non-engineering role" };
  }
  for (const role of profile.target_roles ?? []) {
    if (patternForRole(role).test(title)) {
      return { level: "strong", matched_role: role, points: 40, note: `Title matches target role "${role}"` };
    }
  }
  if (GENERIC_TECH.test(title) && !NOT_RELEVANT.test(title)) {
    return { level: "partial", matched_role: null, points: 20, note: "Technical role, not one of your target roles" };
  }
  return { level: "none", matched_role: null, points: 0, note: "Role not related to your target roles" };
}

function parseYears(text: string): number | null {
  const m = text.match(/(\d+)\s*\+?\s*(?:[-–to]+\s*\d+\s*)?(?:years?|yrs?)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function experienceMatch(title: string, minExperience: string | null, description: string | null, profile: CandidateProfile): JobMatch["experience_match"] {
  const have = profile.tech_experience_years ?? 0;
  if (JUNIOR.test(title) || (minExperience && /intern|fresher|new grad|0\b|any/i.test(minExperience))) {
    return { level: "fits", label: "Fresher / junior friendly", points: 10 };
  }
  if (SENIOR.test(title) && have < 3) {
    return { level: "too_senior", label: "Senior-level title", points: 0 };
  }
  const yrs = parseYears(minExperience ?? "") ?? parseYears(description ?? "");
  if (yrs === null) return { level: "unknown", label: "Experience not stated", points: 5 };
  if (yrs <= Math.ceil(have)) return { level: "fits", label: `Needs ${yrs}+ yrs (you: ~${have})`, points: 10 };
  if (yrs <= Math.ceil(have) + 1) return { level: "stretch", label: `Needs ${yrs}+ yrs (stretch)`, points: 5 };
  return { level: "too_senior", label: `Needs ${yrs}+ yrs`, points: 0 };
}

export function locationMatch(tags: string[], remoteScope: string | null, location: string | null, profile: CandidateProfile): JobMatch["location_match"] {
  const prefs = (profile.preferred_locations ?? []).map((s) => s.toLowerCase());
  const wantsRemote = prefs.some((p) => p.includes("remote"));
  if (tags.includes("Pune") && prefs.includes("pune")) return { level: "match", label: "Pune", points: 20 };
  if (tags.includes("Remote - India") && wantsRemote)
    return { level: "match", label: remoteScope === "India" ? "Remote India" : `Remote (${remoteScope}, India eligible)`, points: 20 };
  if (tags.includes("Remote") && wantsRemote && !remoteScope) {
    return { level: "partial", label: "Remote (region not stated)", points: 10 };
  }
  if (remoteScope && !tags.includes("Remote - India") && !tags.includes("Pune")) {
    return { level: "none", label: `Remote, restricted to ${remoteScope}`, points: 0 };
  }
  for (const city of ["Mumbai", "Bangalore", "Hyderabad", "Delhi NCR"]) {
    if (tags.includes(city) && prefs.includes(city.toLowerCase())) return { level: "match", label: city, points: 20 };
  }
  if (!location) return { level: "unknown", label: "Location not stated", points: 5 };
  if (tags.includes("India")) return { level: "partial", label: `India (${tags.filter((t) => t !== "India").join(", ") || "city not stated"})`, points: 6 };
  return { level: "none", label: "Outside preferred locations", points: 0 };
}

export interface MatchInput {
  job_title: string;
  skills: string[];
  description: string | null;
  min_experience: string | null;
  location: string | null;
  remote_scope: string | null;
  location_tags: string[];
}

export function matchJob(job: MatchInput, profile: CandidateProfile, owned = candidateSkillSet(profile)): JobMatch {
  const role = roleMatch(job.job_title, profile);
  const text = [job.job_title, job.skills.join(", "), job.description ?? ""].join("\n");
  const mentioned = skillsMentioned(text, owned);
  const matched = mentioned.filter((s) => owned.has(s));
  const missing = mentioned.filter((s) => !owned.has(s));
  const skill_points = mentioned.length ? Math.round((30 * matched.length) / mentioned.length) : 12;
  const loc = locationMatch(job.location_tags, job.remote_scope, job.location, profile);
  const exp = experienceMatch(job.job_title, job.min_experience, job.description, profile);
  const score = role.points + skill_points + loc.points + exp.points;
  let relevance: JobMatch["relevance"];
  let cap_reason: string | null = null;
  if (role.level === "none") relevance = "not_relevant";
  else if (score >= settings.strongMatch) relevance = "strong";
  else if (score >= settings.potentialMatch) relevance = "potential";
  else relevance = "low";
  // Hard constraints: a great skills match doesn't help if you can't take the job.
  if (relevance === "strong" || relevance === "potential") {
    if (loc.level === "none") {
      relevance = "low";
      cap_reason = `Marked low relevance: ${loc.label.toLowerCase()}`;
    } else if (exp.level === "too_senior") {
      relevance = "low";
      cap_reason = `Marked low relevance: ${exp.label.toLowerCase()} (you have ~${profile.tech_experience_years} yrs)`;
    } else if (relevance === "strong" && loc.level === "partial") {
      relevance = "potential";
      cap_reason = `Marked potential (not strong): location is ${loc.label}`;
    } else if (relevance === "strong" && role.level === "partial") {
      relevance = "potential";
      cap_reason = "Marked potential (not strong): not one of your target roles";
    }
  }
  return {
    match_score: score,
    relevance,
    cap_reason,
    role_match: role,
    matched_skills: matched,
    missing_skills: missing,
    skill_points,
    location_match: loc,
    experience_match: exp,
  };
}
