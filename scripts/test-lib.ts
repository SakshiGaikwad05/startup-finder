// Unit checks for the deterministic logic (no network, no DB). Run: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeName, domainOf } from "@/lib/deduplication";
import { parseRemote, locationTags } from "@/lib/jobs/location";
import { matchJob } from "@/lib/matching";
import { classifyStartup } from "@/lib/classification";
import { parseFundingHeadline, fundingStatus, isNewStartup } from "@/lib/funding";
import { generateQueries } from "@/lib/discovery/queries";
import { roleCategories } from "@/lib/jobs/roles";
import { classifyEmail, contactLink, extractEmails } from "@/lib/emails";
import { parseResumeText } from "@/lib/resume/parse";
import { careersLink, jobPostingsFromJsonLd } from "@/sources/company";
import type { CandidateProfile } from "@/lib/types";

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

console.log("queries");
t("queries come from the profile", () => {
  const q = generateQueries(profile, 2026);
  assert.ok(q.includes("Pune startup hiring Backend Developer"));
  assert.ok(q.some((x) => x.startsWith("remote India")));
  assert.ok(!q.some((x) => /SDET/.test(x)));
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
