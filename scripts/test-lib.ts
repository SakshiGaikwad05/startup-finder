// Unit checks for the deterministic logic (no network, no DB). Run: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeName, domainOf } from "@/lib/deduplication";
import { parseRemote, locationTags } from "@/lib/jobs/location";
import { jobLevel, matchJob } from "@/lib/matching";
import { classifyStartup } from "@/lib/classification";
import { parseFundingHeadline, fundingStatus, isNewStartup, isRecentYcBatch, ycBatchFundingDate, ycBatchName } from "@/lib/funding";
import { generateQueries } from "@/lib/discovery/queries";
import { roleCategories } from "@/lib/jobs/roles";
import { classifyEmail, contactLink, extractEmails } from "@/lib/emails";
import { parseResumeText } from "@/lib/resume/parse";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/users";
import { himalayasJob } from "@/sources/jobs/himalayas";
import { beginnerIssueQuery, pickSuggestedIssue, popularRepoQuery, repoOf, type GhIssue } from "@/sources/oss";
import { isJobTooOld, jobAgeDays } from "@/lib/jobs/age";
import { fundedRecentlyEnough } from "@/lib/discovery/store";
import { careersLink, jobPostingsFromJsonLd } from "@/sources/company";
import type { CandidateProfile, StartupView } from "@/lib/types";
import {
  announcementKind,
  consolidateFunding,
  fundingStage,
  parseAmount,
  toUsd,
  type FundingReport,
} from "@/lib/funding";
import { countryFromCode, countryFromLocation } from "@/lib/country";
import { hqFromArticle, parseRss } from "@/sources/funding";
import { githubAccountUrl, ycFounders, ycHeadquarters } from "@/sources/yc";
import { mergeFundingReports, reportFrom } from "@/lib/discovery/store";
import { hqOf } from "@/lib/discovery/read";
import { roleType, workArrangement } from "@/lib/jobs/arrangement";
import { startupCategories } from "@/lib/classification";
import { emailLabel, emailPriority } from "@/lib/emails";
import { applyFilters, DEFAULT_FILTERS, fundingWindow, isOpenSource, isYcStartup, ycFundedWithin, type FilterState } from "@/lib/filters";

const profile: CandidateProfile = JSON.parse(fs.readFileSync("config/candidate_profile.json", "utf8"));
let passed = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

console.log("dedup");
t("legal suffixes stripped", () => assert.equal(normalizeName("Foo Technologies Pvt. Ltd."), "foo"));
t("ai suffix stripped", () => assert.equal(normalizeName("Bolna AI"), normalizeName("bolna.ai")));
t("domain", () => assert.equal(domainOf("https://www.Example.com/careers"), "example.com"));
t("linkedin is not a company domain", () => assert.equal(domainOf("https://linkedin.com/company/x"), null));

console.log("location / remote");
t("Pune onsite", () => {
  const r = parseRemote("Mumbai, MH, IN / Pune, MH, IN");
  assert.equal(r.remote, "no");
  assert.ok(locationTags("Mumbai, MH, IN / Pune, MH, IN", r.remote, r.scope).includes("Pune"));
});
t("Remote (IN)", () => {
  const r = parseRemote("Remote (IN)");
  assert.deepEqual(r, { remote: "yes", scope: "India" });
  assert.ok(locationTags("Remote (IN)", r.remote, r.scope).includes("Remote - India"));
});
t("Remote (US) is not India", () => {
  const r = parseRemote("San Francisco, CA, US / Remote (US)");
  assert.equal(r.scope, "US");
  const tags = locationTags("San Francisco, CA, US / Remote (US)", r.remote, r.scope);
  assert.ok(!tags.includes("Remote - India") && !tags.includes("Remote"), tags.join());
});
t("no location → unknown, not remote", () => assert.equal(parseRemote(null).remote, "unknown"));
t("Remote (PT; GB) is restricted, not India", () => assert.deepEqual(parseRemote("PT / GB / Remote (PT; GB)"), { remote: "yes", scope: "PT, GB" }));
t("IN, US is Indiana, not India", () => assert.equal(parseRemote("Remote (SC, US; IN, US; NJ, US)").scope, "US"));
t("Remote (Bengaluru, KA, IN) is India", () => assert.equal(parseRemote("Bengaluru, KA, IN / Remote (Bengaluru, KA, IN)").scope, "India"));
t("bare Remote has unknown region", () => assert.deepEqual(parseRemote("Remote / Remote"), { remote: "yes", scope: null }));

console.log("matching");
const base = { skills: [], description: null, min_experience: null, location: null, remote_scope: null, location_tags: [] as string[] };
t("backend Node role in Pune scores strong", () => {
  const m = matchJob({ ...base, job_title: "Backend Engineer", skills: ["Node.js", "MongoDB", "AWS"], location: "Pune, MH, IN", location_tags: ["Pune", "India"], min_experience: "0-1 years" }, profile);
  assert.equal(m.role_match.level, "strong");
  assert.ok(m.matched_skills.includes("Node.js") && m.matched_skills.includes("MongoDB"));
  assert.ok(m.missing_skills.includes("AWS"));
  assert.equal(m.relevance, "strong", JSON.stringify(m));
});
t("sales role not relevant", () => assert.equal(matchJob({ ...base, job_title: "Sales Manager" }, profile).relevance, "not_relevant"));
t("HR not relevant", () => assert.equal(matchJob({ ...base, job_title: "HR Executive" }, profile).relevance, "not_relevant"));
t("senior role penalised", () => {
  const m = matchJob({ ...base, job_title: "Senior Frontend Engineer", skills: ["React", "TypeScript"], location: "Remote", location_tags: ["Remote"] }, profile);
  assert.equal(m.experience_match.level, "too_senior");
  assert.equal(m.relevance, "low");
  assert.ok(m.cap_reason);
});
t("job outside your locations is low relevance even with great skills", () => {
  const m = matchJob({ ...base, job_title: "Software Engineer", skills: ["TypeScript"], location: "PT / GB / Remote (PT; GB)", remote_scope: "PT, GB", location_tags: ["Remote", "Other"] }, profile);
  assert.equal(m.location_match.level, "none");
  assert.equal(m.relevance, "low");
});
t("AI intern fits", () => {
  const m = matchJob({ ...base, job_title: "AI/ML Intern", skills: ["Python", "LLM"] }, profile);
  assert.equal(m.experience_match.level, "fits");
  assert.equal(m.role_match.level, "strong");
});
t("skills not in profile are never 'matched'", () => {
  const m = matchJob({ ...base, job_title: "Software Engineer", skills: ["Java", "Kubernetes"] }, profile);
  assert.deepEqual(m.matched_skills, []);
});
t("'10+ years' is not mistaken for fresher", () => {
  const m = matchJob({ ...base, job_title: "Software Engineer", min_experience: "10+ years" }, profile);
  assert.equal(m.experience_match.level, "too_senior");
  assert.equal(jobLevel("Software Engineer", "10+ years", null), "experienced");
});

console.log("experience level");
t("intern / fresher titles", () => {
  assert.equal(jobLevel("Software Engineering Intern", null, null), "fresher");
  assert.equal(jobLevel("Backend Developer", "0-1 years", null), "fresher");
  assert.equal(jobLevel("Backend Developer", "Freshers welcome", null), "fresher");
});
t("years asked", () => {
  assert.equal(jobLevel("Backend Developer", "1+ years", null), "fresher");
  assert.equal(jobLevel("Backend Developer", "2-4 years", null), "junior");
  assert.equal(jobLevel("Backend Developer", null, "You have 5+ years of experience with Node"), "experienced");
});
t("senior titles and unknown", () => {
  assert.equal(jobLevel("Senior Backend Engineer", null, null), "experienced");
  assert.equal(jobLevel("Backend Engineer", null, null), "unknown");
});

console.log("classification");
t("AI-first company", () => {
  const c = classifyStartup({ name: "Bolna AI", description: "Bolna is a voice AI platform. Build AI voice agents that call customers.", tags: ["Artificial Intelligence", "Voice AI"], industryHint: "B2B" });
  assert.equal(c.is_ai, true);
  assert.equal(c.classification_confidence, "high");
});
t("single AI mention is not an AI startup", () => {
  const c = classifyStartup({ name: "Kodo", description: "Corporate card & spend management platform for Indian startups. We use some AI for receipts.", tags: ["Fintech"], industryHint: "Fintech" });
  assert.equal(c.is_ai, false);
  assert.equal(c.industry, "FinTech");
});
t("no info → unknown", () => assert.equal(classifyStartup({ name: "X", description: null, tags: [], industryHint: null }).is_ai, null));

console.log("funding");
t("₹ crore headline", () => {
  const f = parseFundingHeadline("Seeds Fincap Raises ₹100 Cr To Scale Lending Tech Capabilities");
  assert.equal(f?.company, "Seeds Fincap");
  assert.equal(f?.amount, "₹100 Cr");
});
t("descriptor stripped", () => assert.equal(parseFundingHeadline("Home Interior Startup Gravity Nets $15 Mn To Expand")?.company, "Gravity"));
t("round + investors", () => {
  const f = parseFundingHeadline("Pune-based AI startup Foo raises $3 Mn in Series A led by Accel and Elevation Capital");
  assert.equal(f?.company, "Foo");
  assert.equal(f?.round, "Series A");
  assert.equal(f?.locationHint, "Pune");
  assert.deepEqual(f?.investors, ["Accel", "Elevation Capital"]);
});
t("non-funding headline rejected", () => assert.equal(parseFundingHeadline("Startup X raises the bar for UX"), null));
t("people descriptions are not company names", () => {
  assert.equal(parseFundingHeadline("Two Google alumni raise $11.3M for their startup"), null);
  assert.equal(parseFundingHeadline("Ex-Tesla team raises $12.5M seed round"), null);
});
t("'X-backed' prefix stripped", () => assert.equal(parseFundingHeadline("a16z-backed EliseAI raises $350M Series E")?.company, "EliseAI"));
t("industry from YC taxonomy beats description keywords", () => {
  const c = classifyStartup({ name: "ZiffyHomes", description: "Managed housing for students and young professionals.", tags: ["Real Estate"], industryHint: "Real Estate and Construction -> Housing and Real Estate" });
  assert.equal(c.industry, "Other");
});
t("'AI-Enhanced Learning' tag alone is not an AI startup", () => {
  const c = classifyStartup({ name: "Kids Coding", description: "Online coding classes for kids.", tags: ["Education", "AI-Enhanced Learning"], industryHint: "Education" });
  assert.equal(c.is_ai, false);
});
t("job age from YC-style and ISO dates", () => {
  const now = new Date("2026-10-12");
  assert.equal(jobAgeDays("3 days ago", now), 3);
  assert.equal(jobAgeDays("about 1 month ago", now), 30);
  assert.equal(jobAgeDays("over 4 years ago", now), 1460);
  assert.equal(jobAgeDays("about an hour ago", now), 1 / 24);
  assert.equal(Math.round(jobAgeDays("2026-09-12", now)!), 30);
  assert.equal(jobAgeDays(null, now), null);
  // Only last week's postings (settings.maxJobAgeDays = 7).
  assert.equal(isJobTooOld("almost 2 years ago", now), true);
  assert.equal(isJobTooOld("about 1 month ago", now), true);
  assert.equal(isJobTooOld("3 days ago", now), false);
  assert.equal(isJobTooOld("2026-10-01", now), true);
  assert.equal(isJobTooOld(null, now), false);
});
t("stored relative dates and undated jobs age from when we first saw them", () => {
  const now = new Date("2026-10-12");
  // "3 days ago" read on 5 Oct is 10 days old on 12 Oct.
  assert.equal(Math.round(jobAgeDays("3 days ago", now, "2026-10-05")!), 10);
  assert.equal(isJobTooOld("3 days ago", now, "2026-10-05"), true);
  assert.equal(isJobTooOld("3 days ago", now, "2026-10-11"), false);
  // No posting date: first seen 2 days ago is fine, 3 weeks ago is not.
  assert.equal(isJobTooOld(null, now, "2026-10-10"), false);
  assert.equal(isJobTooOld(null, now, "2026-09-20"), true);
});
t("only recently funded startups are added", () => {
  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);
  const r = (funding: any) => ({ name: "X", source: "funding_rss", sourceUrl: "u", funding }) as any;
  assert.equal(fundedRecentlyEnough(r({ date: ago(20), round: "Seed", investors: [] }), now), true);
  assert.equal(fundedRecentlyEnough(r({ date: ago(85), round: "Seed", investors: [] }), now), true);
  assert.equal(fundedRecentlyEnough(r({ date: ago(120), round: "Seed", investors: [] }), now), false); // > 3 months
  assert.equal(fundedRecentlyEnough(r({ date: ago(400), round: "Seed", investors: [] }), now), false);
  assert.equal(fundedRecentlyEnough(r({ date: null, round: "Y Combinator Winter 2019", investors: [] }), now), false);
  assert.equal(fundedRecentlyEnough(r(null), now), false);
});
t("YC batch dates the funding at Demo Day", () => {
  assert.equal(ycBatchFundingDate("Y Combinator Spring 2026"), "2026-06-01");
  assert.equal(ycBatchFundingDate("Y Combinator Winter 2021"), "2021-03-01");
  assert.equal(ycBatchFundingDate("Seed"), null);
  const now = new Date("2026-10-12");
  assert.equal(fundingStatus(ycBatchFundingDate("Y Combinator Spring 2026"), null, now), "funded_180");
  assert.equal(fundingStatus(ycBatchFundingDate("Y Combinator Winter 2026"), null, now), "older");
});
t("funding buckets", () => {
  const now = new Date("2026-10-01");
  assert.equal(fundingStatus("2026-09-20", "Seed", now), "funded_30");
  assert.equal(fundingStatus("2026-06-01", "Seed", now), "funded_180");
  assert.equal(fundingStatus(null, "Y Combinator Winter 2021", now), "older");
  assert.equal(fundingStatus(null, "Y Combinator Fall 2026", now), "unknown");
  assert.equal(fundingStatus(null, null, now), "unknown");
});
t("new startup threshold", () => {
  assert.equal(isNewStartup(2025), true);
  assert.equal(isNewStartup(2019), false);
  assert.equal(isNewStartup(null), null);
});

console.log("job roles");
t("AI roles", () => {
  assert.ok(roleCategories("AI applied engineer - Voice first (Internship)").includes("AI / ML"));
  assert.ok(roleCategories("Senior Machine Learning Engineer").includes("AI / ML"));
  assert.ok(roleCategories("Software Engineer", "Engineering · Machine learning").includes("AI / ML"));
});
t("full stack roles", () => {
  assert.ok(roleCategories("JS/Web3 Full Stack Engineer").includes("Full Stack"));
  assert.ok(roleCategories("Fullstack Developer").includes("Full Stack"));
});
t("a job can be AI and full stack", () => assert.deepEqual(roleCategories("AI Full-Stack Engineer"), ["AI / ML", "Full Stack"]));
t("'maintain' / 'detail' don't count as AI", () => assert.deepEqual(roleCategories("Retail Operations Associate"), ["Other"]));
t("sales is Other", () => assert.deepEqual(roleCategories("Account Executive"), ["Other"]));

console.log("careers pages");
t("careers link by text", () =>
  assert.equal(careersLink(`<a href="/about">About</a><a href="/company/join">Careers</a>`, "https://acme.ai"), "https://acme.ai/company/join"));
t("careers link by path", () => assert.equal(careersLink(`<a href="https://acme.ai/careers"><span>Work</span></a>`, "https://acme.ai"), "https://acme.ai/careers"));
t("no careers link", () => assert.equal(careersLink(`<a href="/blog">Blog</a>`, "https://acme.ai"), null));
t("JSON-LD JobPosting is read, remote India detected", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Full Stack Engineer",
    url: "/careers/fse",
    datePosted: "2026-09-28",
    employmentType: "FULL_TIME",
    jobLocation: { "@type": "Place", address: { addressLocality: "Pune", addressCountry: "IN" } },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "India" },
  })}</script>`;
  const [j] = jobPostingsFromJsonLd(html, "https://acme.ai/careers", "company_careers");
  assert.equal(j.title, "Full Stack Engineer");
  assert.equal(j.url, "https://acme.ai/careers/fse");
  assert.equal(j.remote, "yes");
  assert.equal(j.remoteScope, "India");
  assert.ok(j.location?.includes("Pune"));
});
t("page without JobPosting gives no jobs", () => assert.deepEqual(jobPostingsFromJsonLd(`<script type="application/ld+json">{"@type":"Organization"}</script>`, "https://a.ai", "x"), []));

console.log("emails");
t("only the startup's own domain, mailto + plain text, entities decoded", () => {
  const html = `<a href="mailto:careers@acme.ai">Jobs</a> write to hello&#64;acme.ai or ceo@gmail.com, partner@other.com, logo@2x.png, noreply@acme.ai, team@eu.acme.ai`;
  const got = extractEmails(html, "acme.ai", "https://acme.ai").map((e) => `${e.email}:${e.type}`);
  assert.deepEqual(got, ["careers@acme.ai:careers", "hello@acme.ai:general", "team@eu.acme.ai:general"]);
});
t("escaped characters in inline JSON don't leak into emails", () => {
  const got = extractEmails(`{"html":"\\u003esupport@routable.com\\u003c/a\\u003e"}`, "routable.com", "https://routable.com").map((e) => e.email);
  assert.deepEqual(got, ["support@routable.com"]);
});
t("first.last addresses are labelled 'person', team inboxes 'general'", () => {
  assert.equal(classifyEmail("priya.sharma@acme.ai"), "person");
  assert.equal(classifyEmail("compliance@acme.ai"), "general");
});
t("contact page link", () => assert.equal(contactLink(`<a href="/company/contact-us">Contact us</a>`, "https://acme.ai"), "https://acme.ai/company/contact-us"));

console.log("resume parsing");
t("finds skills, roles, locations and stated experience", () => {
  const r = parseResumeText(
    "Priya Shah, Pune, Maharashtra. Full Stack Developer with 2 years of experience. Built REST APIs in Node.js and Express, frontends in React and Next.js, data in PostgreSQL. Open to remote."
  );
  for (const s of ["Node.js", "Express.js", "React", "Next.js", "PostgreSQL", "REST APIs"]) assert.ok(r.skills.includes(s), s);
  assert.ok(r.roles.includes("Full Stack Developer"));
  assert.deepEqual(r.locations, ["Pune", "Remote"]);
  assert.equal(r.experienceYears, 2);
});
t("doesn't invent Go/TypeScript from short words", () => {
  const r = parseResumeText("I like to go hiking. TS is my initials. Worked on Excel reports.");
  assert.ok(!r.skills.includes("Go") && !r.skills.includes("TypeScript"));
});
t("AI role inferred from LLM skills", () => assert.ok(parseResumeText("Built agents with LangGraph and Groq LLM.").roles.includes("AI Engineer")));

console.log("himalayas");
t("Himalayas jobs: India or worldwide only, recent only, entry-level counts as fresher", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  const base = {
    title: "Junior Backend Engineer", companyName: "Acme", guid: "https://himalayas.app/companies/acme/jobs/x",
    applicationLink: "https://acme.com/apply", pubDate: Date.parse("2026-10-14T00:00:00Z") / 1000,
  };
  const world = himalayasJob({ ...base, locationRestrictions: [] }, now)!;
  assert.equal(world.remoteScope, "Worldwide");
  assert.equal(world.applyUrl, "https://acme.com/apply");
  assert.equal(world.url, base.guid); // links back to Himalayas
  assert.equal(himalayasJob({ ...base, locationRestrictions: ["India", "Nepal"] }, now)!.remoteScope, "India");
  assert.equal(himalayasJob({ ...base, locationRestrictions: ["United States"] }, now), null);
  assert.equal(himalayasJob({ ...base, pubDate: Date.parse("2026-09-01T00:00:00Z") / 1000 }, now), null); // older than a week
  const entry = himalayasJob({ ...base, title: "Backend Engineer", seniority: ["Entry-level"] }, now)!;
  assert.equal(jobLevel(entry.title, entry.minExperience ?? null, null), "fresher");
});

console.log("open source");
t("suggested issue: 'good first issue' first, then fewest comments, then most recent", () => {
  const i = (title: string, labels: string[], comments: number, updated: string): GhIssue => ({
    title, html_url: `https://github.com/a/b/issues/${title}`, repository_url: "https://api.github.com/repos/acme/app",
    labels: labels.map((name) => ({ name })), comments, updated_at: updated,
  });
  const pick = pickSuggestedIssue([
    i("help-busy", ["help wanted"], 0, "2026-10-10"),
    i("gfi-busy", ["good first issue"], 9, "2026-10-12"),
    i("gfi-quiet-old", ["Good First Issue"], 1, "2026-09-01"),
    i("gfi-quiet-new", ["good-first-issue", "bug"], 1, "2026-10-01"),
  ]);
  assert.equal(pick.title, "gfi-quiet-new");
  assert.equal(repoOf(pick), "acme/app");
});
t("popular projects: repo search, then issues scoped to those repos", () => {
  const rq = popularRepoQuery(1000, "2026-10-01");
  assert.ok(rq.includes("good-first-issues:>=3") && rq.includes("stars:>=1000") && rq.includes("pushed:>=2026-10-01") && rq.includes("archived:false"));
  const iq = beginnerIssueQuery(["oven-sh/bun", "vllm-project/vllm"], "2026-04-14", "repo");
  assert.ok(iq.includes("repo:oven-sh/bun repo:vllm-project/vllm") && !iq.includes("user:"));
});
t("beginner-issue search covers several accounts and recent issues only", () => {
  const q = beginnerIssueQuery(["PostHog", "cedana"], "2026-04-14");
  assert.ok(q.includes("user:PostHog user:cedana"));
  assert.ok(q.includes("is:open") && q.includes("no:assignee") && q.includes("updated:>=2026-04-14"));
  assert.ok(q.includes('"good first issue"'));
});

console.log("sessions and private links");
t("tokens are stored as SHA-256 hex (same as Postgres encode(sha256(...),'hex') in the migration)", () => {
  assert.equal(hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(hashToken("abc").length, 64);
  assert.notEqual(hashToken("token-a"), hashToken("token-b"));
});

console.log("rate limiting");
t("6th new profile from the same IP within an hour is refused; other IPs aren't affected", () => {
  const req = (ip: string) => new Request("http://x/api/me", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
  for (let i = 0; i < 5; i++) assert.equal(rateLimit(req("203.0.113.7"), "createProfile"), null);
  const blocked = rateLimit(req("203.0.113.7"), "createProfile");
  assert.equal(blocked?.status, 429);
  assert.ok(Number(blocked?.headers.get("Retry-After")) > 0);
  assert.equal(rateLimit(req("198.51.100.9"), "createProfile"), null);
});

console.log("YC jobs page");
t("GitHub account only from a real github.com link", () => {
  assert.equal(githubAccountUrl("https://github.com/acme-ai"), "https://github.com/acme-ai");
  assert.equal(githubAccountUrl("github.com/acme/repo?tab=readme"), "https://github.com/acme");
  assert.equal(githubAccountUrl("https://www.github.com/Acme/"), "https://github.com/Acme");
  assert.equal(githubAccountUrl("https://gitlab.com/acme"), null);
  assert.equal(githubAccountUrl(""), null);
  assert.equal(githubAccountUrl(null), null);
});
t("open source only from a listed GitHub account or YC's Open Source tag", () => {
  assert.equal(isOpenSource("https://github.com/acme", []), true);
  assert.equal(isOpenSource(null, ["B2B", "Open Source"]), true);
  assert.equal(isOpenSource(null, ["open-source"]), true);
  assert.equal(isOpenSource(null, ["Developer Tools", "AI"]), false);
  assert.equal(isOpenSource(null, null), false);
});
t("YC batches: names, and every batch of this year counts as recent", () => {
  assert.equal(ycBatchName("Y Combinator Summer 2026"), "Summer 2026");
  assert.equal(ycBatchName("Y Combinator winter 2026"), "Winter 2026");
  assert.equal(ycBatchName("Series A"), null);
  const oct = new Date("2026-10-14");
  assert.equal(isRecentYcBatch("Y Combinator Winter 2026", oct), true); // Demo Day Mar 2026, same year
  assert.equal(isRecentYcBatch("Y Combinator Fall 2026", oct), true);
  assert.equal(isRecentYcBatch("Y Combinator Fall 2025", oct), false); // last year, Demo Day > 3 months ago
  assert.equal(isRecentYcBatch("Y Combinator Fall 2025", new Date("2026-01-20")), true); // still within 3 months in January
  assert.equal(isRecentYcBatch("Seed", oct), false);
  const r = { name: "X", source: "yc", sourceUrl: "u", funding: { date: null, amount: null, round: "Y Combinator Winter 2026", investors: [], source: "YC", sourceUrl: "u" } } as any;
  assert.equal(fundedRecentlyEnough(r, oct), true);
});
t("YC companies are recognised by round or source", () => {
  assert.equal(isYcStartup({ funding_round: "Y Combinator Summer 2026", sources_seen: [], source: "funding_rss" }), true);
  assert.equal(isYcStartup({ funding_round: null, sources_seen: ["yc"], source: "company_careers" }), true);
  assert.equal(isYcStartup({ funding_round: "Series A", sources_seen: ["funding_rss"], source: "funding_rss" }), false);
});
t("current YC batch (future Demo Day) counts as funded; old batches don't", () => {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  assert.equal(ycFundedWithin({ last_funding_date: day(-60) }, 90), true); // Demo Day in 2 months
  assert.equal(ycFundedWithin({ last_funding_date: day(40) }, 90), true);
  assert.equal(ycFundedWithin({ last_funding_date: day(40) }, 30), false);
  assert.equal(ycFundedWithin({ last_funding_date: day(200) }, 90), false);
  assert.equal(ycFundedWithin({ last_funding_date: null }, 90), false);
});

console.log("queries");
t("queries come from the profile", () => {
  const q = generateQueries(profile, 2026);
  assert.ok(q.includes("Pune startup hiring Backend Developer"));
  assert.ok(q.some((x) => x.startsWith("remote India")));
  assert.ok(!q.some((x) => /SDET/.test(x)));
});

console.log("headquarters country");
t("ISO code at the end wins; Indiana is the US", () => {
  assert.equal(countryFromLocation("Bengaluru, KA, IN"), "India");
  assert.equal(countryFromLocation("Indianapolis, IN, US"), "United States");
  assert.equal(countryFromLocation("San Francisco, CA, USA"), "United States");
});
t("cities and plain names", () => {
  assert.equal(countryFromLocation("Pune"), "India");
  assert.equal(countryFromLocation("Gurugram"), "India");
  assert.equal(countryFromLocation("New York"), "United States");
  assert.equal(countryFromLocation("London"), null);
  assert.equal(countryFromLocation(null), null);
});
t("a place that names both countries is unknown", () => assert.equal(countryFromLocation("San Francisco and Bengaluru"), null));
t("country codes", () => {
  assert.equal(countryFromCode("IN"), "India");
  assert.equal(countryFromCode("us"), "United States");
  assert.equal(countryFromCode("GB"), null);
});
t("headline '-based' is medium confidence; ₹ amount alone is low", () => {
  assert.deepEqual(hqFromArticle("Bengaluru", "$5 Mn", "Inc42", "u")?.country, "India");
  assert.equal(hqFromArticle("Bengaluru", "$5 Mn", "Inc42", "u")?.confidence, "medium");
  const inr = hqFromArticle(null, "₹50 Cr", "ET", "u");
  assert.equal(inr?.country, "India");
  assert.equal(inr?.confidence, "low");
  assert.equal(hqFromArticle(null, "$5M", "TechCrunch", "u"), null); // a US outlet doesn't make it a US startup
});
t("investor location in the summary is ignored", () => {
  const f = parseFundingHeadline("Foo raises $3 Mn in seed round", "The round was led by Mumbai-based VC firm Bar Capital.");
  assert.equal(f?.company, "Foo");
  assert.equal(f?.locationHint, null);
});
t("company location in the summary is used", () => {
  const f = parseFundingHeadline("Foo raises $3 Mn in seed round", "Hyderabad-based fintech startup Foo said on Monday it raised…");
  assert.equal(f?.locationHint, "Hyderabad");
});
t("'Indian startup' in the headline", () => assert.equal(parseFundingHeadline("Indian AI startup Foo raises $3 Mn")?.locationHint, "India"));
t("YC page: HQ from country code, other offices kept separately", () => {
  const { hq, others } = ycHeadquarters({ location: "Bengaluru, India", country: "IN" }, { all_locations: "Bengaluru, KA, India; San Francisco, CA, USA; Remote" }, "https://yc/x");
  assert.equal(hq?.country, "India");
  assert.equal(hq?.confidence, "high");
  assert.deepEqual(others, ["San Francisco, CA, USA"]);
});
t("YC founders with profile links", () => {
  const f = ycFounders({ founders: [{ full_name: "Ana Rao", title: "CEO", linkedin_url: "https://linkedin.com/in/ana", twitter_url: "" }, { full_name: "" }] }, "https://yc/x");
  assert.deepEqual(f, [{ name: "Ana Rao", title: "CEO", profile_url: "https://linkedin.com/in/ana", source_url: "https://yc/x" }]);
});
t("stored rows without HQ evidence fall back to their HQ location only", () => {
  assert.equal(hqOf({ location: "Pune, MH, IN", hq_country: null }).hq_country, "India");
  assert.equal(hqOf({ location: null, hq_country: null }).hq_country, null);
  assert.equal(hqOf({ location: "Pune", hq_country: "United States", hq_confidence: "high" }).hq_country, "United States");
});

console.log("funding amounts / stages / kinds");
t("amounts in crore, lakh, million, billion", () => {
  assert.deepEqual(parseAmount("₹100 Cr"), { value: 1e9, currency: "INR" });
  assert.deepEqual(parseAmount("Rs 90 crore"), { value: 9e8, currency: "INR" });
  assert.deepEqual(parseAmount("$42M"), { value: 42e6, currency: "USD" });
  assert.deepEqual(parseAmount("$1.2 Bn"), { value: 1.2e9, currency: "USD" });
  assert.deepEqual(parseAmount("€3 Mn"), { value: 3e6, currency: "EUR" });
  assert.deepEqual(parseAmount("₹50 lakh"), { value: 5e6, currency: "INR" });
  assert.equal(parseAmount("10 million")?.currency, null);
  assert.equal(parseAmount(null), null);
});
t("USD conversion only with a rate", () => {
  assert.equal(toUsd({ value: 9.5e8, currency: "INR" }, { INR: 95 }), 1e7);
  assert.equal(toUsd({ value: 5e6, currency: "USD" }, null), 5e6);
  assert.equal(toUsd({ value: 9.5e8, currency: "INR" }, null), null);
  assert.equal(toUsd({ value: 1e6, currency: null }, { INR: 95 }), null);
});
t("stages", () => {
  assert.equal(fundingStage("Pre-Seed"), "pre_seed");
  assert.equal(fundingStage("Seed"), "seed");
  assert.equal(fundingStage("Pre-Series A"), "seed");
  assert.equal(fundingStage("Series A"), "series_a");
  assert.equal(fundingStage("Series C"), "series_b_plus");
  assert.equal(fundingStage("Y Combinator Summer 2026"), "accelerator");
  assert.equal(fundingStage(null), null);
});
t("confirmed / planned / rumored", () => {
  assert.equal(announcementKind("Foo raises $10M Series A"), "confirmed");
  assert.equal(announcementKind("Foo in talks to raise $50M"), "planned");
  assert.equal(announcementKind("Foo eyes $20 Mn in fresh funding"), "planned");
  assert.equal(announcementKind("Foo reportedly raises $30M at $1B valuation"), "rumored");
});
t("planned raises are parsed and labelled, not dropped", () => {
  const f = parseFundingHeadline("Foo in talks to raise $50 Mn in Series B");
  assert.equal(f?.company, "Foo");
  assert.equal(f?.kind, "planned");
});
t("cleaner company names (from real feed headlines)", () => {
  assert.equal(parseFundingHeadline("KL Rahul-backed Boldfit raises Rs 400 Cr in Series B")?.company, "Boldfit");
  assert.equal(parseFundingHeadline("Toothsi parent MakeO raises Rs 90 crore to expand dental care business")?.company, "MakeO");
  assert.equal(parseFundingHeadline("Hero Electronix’s Tessolve Semiconductor raises $75 Mn")?.company, "Tessolve Semiconductor");
});
t("IPOs and event promos are not startup rounds (from real feed headlines)", () => {
  assert.equal(parseFundingHeadline("Zetwerk raises Rs 2,830 Cr from anchor investors ahead of IPO"), null);
  assert.equal(parseFundingHeadline("TechCrunch Disrupt 2026 starts tomorrow: Your final chance to secure up to $100 ticket savings"), null);
});
t("ET-style CDATA with spaces is cleaned", () => {
  const xml = `<rss><item><title> <![CDATA[MakeO raises Rs 90 crore to expand]]> </title><link>https://et/x</link><pubDate>Tue, 13 Oct 2026 15:05:46 +0530</pubDate><description><![CDATA[<p>Dental care</p>]]></description></item></rss>`;
  const [it] = parseRss(xml);
  assert.equal(it.title, "MakeO raises Rs 90 crore to expand");
  assert.equal(it.description, "Dental care");
});

console.log("funding consolidation");
const rep = (o: Partial<FundingReport>): FundingReport => ({
  source: "Inc42", url: "u1", date: "2026-10-01", amount: "$10 Mn", round: "Series A", investors: [], kind: "confirmed",
  currency: "USD", amount_value: 1e7, amount_usd: 1e7, ...o,
});
t("confirmed beats a newer rumor", () => {
  const c = consolidateFunding([rep({}), rep({ url: "u2", date: "2026-10-10", kind: "rumored", amount: "$50M", amount_usd: 5e7 })]);
  assert.equal(c.primary?.url, "u1");
});
t("earliest confirmed report is the announcement date; second outlet verifies", () => {
  const c = consolidateFunding([rep({ date: "2026-10-03", source: "ET", url: "u2" }), rep({})]);
  assert.equal(c.primary?.url, "u2"); // newest report of the round is shown…
  assert.equal(c.announcement_date, "2026-10-01"); // …but the date is when it was first announced
  assert.equal(c.verification_url, "u1"); // the other outlet confirms it
  assert.deepEqual(c.conflicts, []);
});
t("same-outlet repeat is not independent verification", () => assert.equal(consolidateFunding([rep({}), rep({ url: "u2", date: "2026-10-02" })]).verification_url, null));
t("conflicting amounts are flagged", () => {
  const c = consolidateFunding([rep({}), rep({ source: "ET", url: "u2", date: "2026-10-02", amount: "$15 Mn", amount_usd: 1.5e7 })]);
  assert.equal(c.conflicts.length, 1);
  assert.match(c.conflicts[0], /Amount/);
});
t("dated news beats an older YC batch", () => {
  const c = consolidateFunding([rep({ source: "YC directory", url: "yc", date: null, round: "Y Combinator Winter 2025", amount: null, amount_usd: null, currency: null }), rep({ date: "2026-09-20" })]);
  assert.equal(c.primary?.url, "u1");
});
t("report merge: same article refreshed, not duplicated", () => {
  const a = reportFrom({ date: "2026-10-01", amount: "₹95 Cr", round: "Series A", investors: [], source: "Inc42", sourceUrl: "u1" }, { INR: 95 });
  assert.equal(a.amount_usd, 1e7);
  assert.equal(a.kind, "confirmed");
  const merged = mergeFundingReports([a], { ...a, amount: "₹96 Cr" });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].amount, "₹96 Cr");
  assert.equal(mergeFundingReports(merged, { ...a, url: "u2" }).length, 2);
});

console.log("jobs: role type and work arrangement");
t("internships", () => {
  assert.equal(roleType("Software Engineering Intern", null, "fresher"), "internship");
  assert.equal(roleType("Backend Developer", "Internship", "unknown"), "internship");
  assert.equal(roleType("Backend Developer", "Full-time", "junior"), "junior");
  assert.equal(roleType("International Sales Lead", null, "experienced"), "experienced");
});
t("work arrangement only from the posting", () => {
  assert.equal(workArrangement("Remote (IN)", "yes"), "remote");
  assert.equal(workArrangement("Bengaluru (Hybrid)", "no"), "hybrid");
  assert.equal(workArrangement("Pune, MH, IN", "no"), "onsite");
  assert.equal(workArrangement(null, "unknown"), "unknown");
});

console.log("industry categories");
t("AI agents, GenAI and SaaS", () => {
  const c = startupCategories({ industry: "AI Startup", is_ai: true, ai_category: "Generative AI / LLM apps", description: "LLM copilots for enterprises" });
  assert.ok(c.includes("AI & AI Agents") && c.includes("Generative AI & LLMs") && c.includes("Enterprise Software"), c.join());
});
t("robotics and data", () => {
  assert.ok(startupCategories({ industry: "Other", is_ai: false, ai_category: null, description: "Warehouse robots for retailers" }).includes("Robotics"));
  assert.ok(startupCategories({ industry: "SaaS", is_ai: false, ai_category: null, description: "Analytics dashboards for D2C brands" }).includes("Data & Analytics"));
});
t("nothing matches → Other", () => assert.deepEqual(startupCategories({ industry: "Consumer", is_ai: false, ai_category: null, description: "A dating app" }), ["Other"]));

console.log("email labels");
t("careers / hiring / general / person", () => {
  assert.equal(emailLabel({ email: "careers@a.ai", type: "careers" }), "Careers");
  assert.equal(emailLabel({ email: "recruiting@a.ai", type: "careers" }), "Careers");
  assert.equal(emailLabel({ email: "hr@a.ai", type: "careers" }), "Hiring");
  assert.equal(emailLabel({ email: "hello@a.ai", type: "general" }), "General contact");
  assert.equal(emailLabel({ email: "ana.rao@a.ai", type: "person" }), "Person");
});
t("careers emails are listed before general ones", () =>
  assert.ok(emailPriority({ email: "jobs@a.ai", type: "careers" }) < emailPriority({ email: "hello@a.ai", type: "general" })));

console.log("filters");
const today = new Date();
const ago = (d: number) => new Date(today.getTime() - d * 86_400_000).toISOString().slice(0, 10);
const startup = (o: Partial<StartupView>): StartupView =>
  ({
    id: 1, name: "X", industry: "SaaS", is_ai: false, categories: ["SaaS"], location_tags: ["Unknown"], is_fresh: true, jobs: [],
    relevant_jobs: 0, best_match: 0, relevance: "low", emails: [], age_bucket: "unknown", funding_status: "unknown",
    last_funding_date: null, funding_kind: null, funding_stage: null, funding_amount_usd: null, hq_country: null,
    first_discovered_at: today.toISOString(), founded_year: null, ...o,
  }) as StartupView;
const anyF: FilterState = { ...DEFAULT_FILTERS, view: "all", locations: [], hiringOnly: false };
const list = [
  startup({ id: 1, name: "InA", hq_country: "India", last_funding_date: ago(5), funding_kind: "confirmed", funding_stage: "seed", funding_amount_usd: 2e6 }),
  startup({ id: 2, name: "UsB", hq_country: "United States", last_funding_date: ago(45), funding_kind: "confirmed", funding_stage: "series_a", funding_amount_usd: 2e7 }),
  startup({ id: 3, name: "UnkC", hq_country: null, last_funding_date: ago(20), funding_kind: "rumored", funding_stage: "series_b_plus", funding_amount_usd: null }),
];
const names = (f: FilterState) => applyFilters(list, f).map((s) => s.name).sort();
t("country: India / USA / Both / Any (unknown HQ only in Any)", () => {
  assert.deepEqual(names({ ...anyF, country: "india" }), ["InA"]);
  assert.deepEqual(names({ ...anyF, country: "usa" }), ["UsB"]);
  assert.deepEqual(names({ ...anyF, country: "both" }), ["InA", "UsB"]);
  assert.deepEqual(names({ ...anyF, country: "any" }), ["InA", "UnkC", "UsB"]);
});
t("funding recency 7 / 30 / 60 days", () => {
  assert.deepEqual(names({ ...anyF, fundingDays: 7 }), ["InA"]);
  assert.deepEqual(names({ ...anyF, fundingDays: 30 }), ["InA", "UnkC"]);
  assert.deepEqual(names({ ...anyF, fundingDays: 60 }), ["InA", "UnkC", "UsB"]);
});
t("an estimated future YC Demo Day is not 'funded in the last 30 days' (bug seen in the UI)", () => {
  const future = new Date(today.getTime() + 48 * 86_400_000).toISOString().slice(0, 10);
  assert.deepEqual(applyFilters([startup({ name: "YcFall", last_funding_date: future, funding_date_approximate: true })], { ...anyF, fundingDays: 30 }), []);
});
t("filters saved before day windows still work", () => {
  assert.equal(fundingWindow({ ...anyF, funding: ["funded_90"] }), 90);
  assert.equal(fundingWindow({ ...anyF, funding: [] }), null);
});
t("confirmed only, stage and amount", () => {
  assert.deepEqual(names({ ...anyF, confirmedOnly: true }), ["InA", "UsB"]);
  assert.deepEqual(names({ ...anyF, stages: ["series_a", "series_b_plus"] }), ["UnkC", "UsB"]);
  assert.deepEqual(names({ ...anyF, amounts: ["1to10"] }), ["InA"]); // unknown amounts are hidden
});
t("role type and work arrangement keep only matching jobs", () => {
  const job = (o: any) => ({ job_title: "x", role_categories: ["Backend"], experience_level: "unknown", role_type: "unknown", work_arrangement: "unknown", match: { relevance: "low", match_score: 0 }, ...o });
  const s = startup({ name: "J", jobs: [job({ role_type: "internship", experience_level: "fresher", work_arrangement: "remote" }), job({ role_type: "experienced", experience_level: "experienced", work_arrangement: "onsite" })] as any });
  const out = applyFilters([s], { ...anyF, levels: ["internship"] });
  assert.equal(out[0].jobs.length, 1);
  assert.equal(applyFilters([s], { ...anyF, levels: ["fresher"] })[0].jobs.length, 1); // interns still count as fresher
  assert.equal(applyFilters([s], { ...anyF, arrangements: ["hybrid"] }).length, 0);
});
t("industry: profile 'AI' and new categories", () => {
  const ai = startup({ name: "AI", industry: "AI Startup", categories: ["AI & AI Agents"], is_ai: true });
  assert.equal(applyFilters([ai, list[0]], { ...anyF, types: ["AI"] }).length, 1);
  assert.equal(applyFilters([ai, list[0]], { ...anyF, types: ["SaaS"] })[0].name, "InA");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
