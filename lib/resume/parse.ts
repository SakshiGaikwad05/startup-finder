// Deterministic resume reading: finds skills, likely target roles, locations and stated years of
// experience in resume text. Everything is a *suggestion* — the user confirms it on the onboarding form.
import { SKILL_DICTIONARY } from "@/lib/matching/skills";

export const ROLE_OPTIONS: { role: string; re: RegExp }[] = [
  { role: "Software Engineer", re: /software (engineer|developer|development)|\bsde\b|\bswe\b/i },
  { role: "Full Stack Developer", re: /full[\s-]?stack|\bmern\b|\bmean\b/i },
  { role: "Backend Developer", re: /back[\s-]?end|server[\s-]side|rest(ful)? api/i },
  { role: "Frontend Developer", re: /front[\s-]?end|\bui (engineer|developer)|react(\.js)? developer/i },
  { role: "AI Engineer", re: /\bai engineer|\bllm|generative ai|gen\s?ai|langchain|langgraph|agentic|ai agents?/i },
  { role: "ML Engineer", re: /machine learning|\bml engineer|deep learning|pytorch|tensorflow|scikit/i },
  { role: "Data Scientist", re: /data scien/i },
  { role: "Data Analyst", re: /data analy|power bi|tableau|\bexcel\b.*dashboards?/i },
  { role: "DevOps Engineer", re: /devops|\bsre\b|site reliability|kubernetes|terraform/i },
  { role: "Mobile Developer", re: /android|\bios\b|flutter|react native|kotlin|swift(ui)?\b/i },
  { role: "QA / SDET", re: /\bqa\b|quality assurance|\bsdet\b|test automation|selenium|cypress/i },
  { role: "Technical Support Engineer", re: /technical support|tech support|application support|support engineer|troubleshoot/i },
  { role: "Python Developer", re: /\bpython developer|\bdjango\b|\bfastapi\b|\bflask\b/i },
  { role: "Product Manager", re: /product manag/i },
];

export const STARTUP_TYPE_OPTIONS = ["AI", "HealthTech", "FinTech", "SaaS", "EdTech", "Developer Tools", "Cybersecurity", "E-commerce", "ClimateTech", "Consumer", "Web3"];

const CITY_RES: [string, RegExp][] = [
  ["Pune", /\bpune\b/i],
  ["Mumbai", /\bmumbai\b|\bnavi mumbai\b|\bthane\b/i],
  ["Bangalore", /\bbengaluru\b|\bbangalore\b/i],
  ["Hyderabad", /\bhyderabad\b/i],
  ["Delhi NCR", /\bdelhi\b|\bgurugram\b|\bgurgaon\b|\bnoida\b/i],
];

export interface ResumeSuggestions {
  skills: string[];
  roles: string[];
  locations: string[];
  experienceYears: number | null;
  charsRead: number;
}

export function parseResumeText(raw: string): ResumeSuggestions {
  const text = raw.replace(/\s+/g, " ");
  const skills = Object.entries(SKILL_DICTIONARY)
    .filter(([name, re]) => {
      // Very short / ambiguous tokens need stronger evidence in prose.
      if (name === "Go") return /\bgolang\b|\bgo (developer|programming|language)\b/i.test(text);
      if (name === "TypeScript") return /\btypescript\b/i.test(text);
      if (name === "JavaScript") return /\bjavascript\b|\bes6\b|\bnode\.?js\b/i.test(text);
      if (name === "Swift") return /\bswift\b/i.test(text);
      if (name === "Machine Learning") return /machine learning/i.test(text);
      return re.test(text);
    })
    .map(([name]) => name);

  const roles = ROLE_OPTIONS.filter((r) => r.re.test(text)).map((r) => r.role);
  // Infer from skills when the resume doesn't name a role.
  const has = (s: string) => skills.includes(s);
  if (!roles.includes("Full Stack Developer") && has("React") && (has("Node.js") || has("Express.js") || has("Django") || has("FastAPI"))) roles.push("Full Stack Developer");
  if (!roles.includes("AI Engineer") && (has("LLM / GenAI") || has("LangChain") || has("LangGraph") || has("AI Agents"))) roles.push("AI Engineer");
  if (!roles.length && skills.length) roles.push("Software Engineer");

  const locations = CITY_RES.filter(([, re]) => re.test(text)).map(([c]) => c);
  if (/\bremote\b/i.test(text)) locations.push("Remote");

  const yrs = text.match(/(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|industry\s+|work\s+)?experience/i);
  const experienceYears = yrs ? Math.min(40, parseFloat(yrs[1])) : null;

  return { skills, roles: [...new Set(roles)], locations: [...new Set(locations)], experienceYears, charsRead: raw.length };
}
