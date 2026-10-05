// Skill dictionary: canonical name → regex. Used to (a) read which skills a job mentions and
// (b) map the candidate profile's free-text skills onto the same canonical names.
// Adding a skill here does NOT give it to the candidate — ownership comes only from the profile.
import type { CandidateProfile } from "@/lib/types";

export const SKILL_DICTIONARY: Record<string, RegExp> = {
  Python: /\bpython\b/i,
  JavaScript: /\bjavascript\b|\bjs\b|\bes6\b/i,
  TypeScript: /\btypescript\b|\bts\b/i,
  SQL: /\bsql\b/i,
  Java: /\bjava\b(?!\s*script)/i,
  Go: /\bgolang\b|\bgo\b(?=\s*(developer|engineer|lang))/i,
  "C++": /c\+\+/i,
  "C#": /c#|\.net\b/i,
  Rust: /\brust\b/i,
  Kotlin: /\bkotlin\b/i,
  Swift: /\bswift\b|\bios\b/i,
  Ruby: /\bruby\b|\brails\b/i,
  PHP: /\bphp\b|\blaravel\b/i,
  React: /\breact(\.?js)?\b(?!\s*native)/i,
  "React Native": /react\s*native/i,
  "Next.js": /\bnext\.?js\b/i,
  "Node.js": /\bnode(\.?js)?\b/i,
  "Express.js": /\bexpress(\.?js)?\b/i,
  FastAPI: /\bfastapi\b/i,
  Django: /\bdjango\b/i,
  Flask: /\bflask\b/i,
  Spring: /\bspring( boot)?\b/i,
  Angular: /\bangular\b/i,
  Vue: /\bvue(\.?js)?\b/i,
  "Tailwind CSS": /\btailwind\b/i,
  Redux: /\bredux\b/i,
  Flutter: /\bflutter\b/i,
  "HTML/CSS": /\bhtml5?\b|\bcss3?\b/i,
  MongoDB: /\bmongo(db)?\b|\bmongoose\b/i,
  PostgreSQL: /\bpostgres(ql)?\b/i,
  MySQL: /\bmysql\b/i,
  SQLite: /\bsqlite\b/i,
  Redis: /\bredis\b/i,
  AWS: /\baws\b|amazon web services/i,
  GCP: /\bgcp\b|google cloud/i,
  Azure: /\bazure\b/i,
  Docker: /\bdocker\b/i,
  Kubernetes: /\bkubernetes\b|\bk8s\b/i,
  Terraform: /\bterraform\b/i,
  Linux: /\blinux\b/i,
  "CI/CD": /\bci\/cd\b|continuous integration/i,
  Git: /\bgit\b|\bgithub\b/i,
  Postman: /\bpostman\b/i,
  "REST APIs": /\brest(ful)?\b|\brest api/i,
  GraphQL: /\bgraphql\b/i,
  Microservices: /\bmicroservices?\b/i,
  "LLM / GenAI": /\bllms?\b|large language model|\bgen\s?ai\b|generative ai|\bgroq\b|\bnim\b/i,
  "AI Agents": /\bagentic\b|\bai agents?\b|tool[- ]calling/i,
  LangChain: /\blangchain\b/i,
  LangGraph: /\blanggraph\b/i,
  RAG: /\brag\b|retrieval[- ]augmented/i,
  "Prompt Engineering": /prompt engineering/i,
  "Machine Learning": /machine learning|\bml\b/i,
  "Deep Learning": /deep learning|neural network/i,
  PyTorch: /\bpytorch\b/i,
  TensorFlow: /\btensorflow\b/i,
  NLP: /\bnlp\b|natural language processing/i,
  "Computer Vision": /computer vision|\bopencv\b/i,
  Pandas: /\bpandas\b/i,
  NumPy: /\bnumpy\b/i,
  Playwright: /\bplaywright\b/i,
  Selenium: /\bselenium\b/i,
  Cypress: /\bcypress\b/i,
  Jest: /\bjest\b/i,
  Pytest: /\bpytest\b/i,
  "API Testing": /api testing/i,
  "Technical Support": /technical support|tech support|application support|troubleshoot/i,
  Debugging: /\bdebugging\b|root[- ]cause/i,
  Authentication: /\bauthentication\b|\boauth\b|\bjwt\b|\brbac\b/i,
  DNS: /\bdns\b/i,
  Excel: /\bexcel\b|spreadsheets?/i,
};

function profileItems(p: CandidateProfile): string[] {
  return [
    ...(p.skills ?? []),
    ...(p.programming_languages ?? []),
    ...(p.frameworks ?? []),
    ...(p.libraries ?? []),
    ...(p.databases ?? []),
    ...(p.cloud_tools ?? []),
    ...(p.testing_skills ?? []),
    ...(p.ai_ml_skills ?? []),
    ...(p.projects ?? []).flatMap((x) => x.stack ?? []),
  ];
}

/** Canonical skills the candidate has (from the profile only). */
export function candidateSkillSet(p: CandidateProfile): Set<string> {
  const owned = new Set<string>();
  for (const item of profileItems(p)) {
    let hit = false;
    for (const [name, re] of Object.entries(SKILL_DICTIONARY)) {
      if (re.test(item)) {
        owned.add(name);
        hit = true;
      }
    }
    if (!hit) owned.add(item); // custom profile skill not in dictionary
  }
  return owned;
}

/** Canonical skills mentioned in a piece of job text. Custom profile skills are matched literally. */
export function skillsMentioned(text: string, owned: Set<string>): string[] {
  const found = new Set<string>();
  for (const [name, re] of Object.entries(SKILL_DICTIONARY)) if (re.test(text)) found.add(name);
  for (const s of owned) {
    if (SKILL_DICTIONARY[s] || s.length < 3) continue;
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(text)) found.add(s);
  }
  // "Java" regex can't see "JavaScript" — fine. Avoid JS/TS double-counting when only "Node" appears.
  return [...found];
}
