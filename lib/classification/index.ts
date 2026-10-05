// Deterministic startup classification (industry + AI). Reasons are stored so the UI can explain it.
// "AI startup" requires AI to be central: a source tag, or AI in the one-line pitch, or repeated
// AI language in the description. A single passing mention is NOT enough.

export interface ClassificationInput {
  name: string;
  description: string | null;
  tags: string[];
  industryHint: string | null;
}

export interface Classification {
  industry: string;
  is_ai: boolean | null;
  ai_category: string | null;
  classification_confidence: "high" | "medium" | "low";
  reasons: string[];
}

// "AI-Enhanced Learning"-style tags are deliberately NOT strong signals (AI is a feature there, not the product).
const AI_TAG = /^(artificial intelligence|ai|generative ai|machine learning|deep learning|computer vision|nlp|llms?|ai assistant|conversational ai|ai agents?|voice ai|ai infrastructure)$/i;
const AI_TEXT = /\bAI\b|artificial intelligence|machine learning|\bLLMs?\b|generative AI|\bGenAI\b|large language model|neural network|computer vision|AI agents?|agentic|\bNLP\b|voice AI/g;

const AI_CATEGORIES: [string, RegExp][] = [
  ["AI Agents", /\bagents?\b|agentic|autonomous|copilot/i],
  ["Voice AI", /\bvoice\b|speech|calls?\b/i],
  ["Computer Vision", /computer vision|\bvision\b|image|video analytics|camera/i],
  ["AI Infrastructure / MLOps", /infrastructure|\bmlops\b|inference|\bgpu|model (training|serving)|fine[- ]tun/i],
  ["Generative AI / LLM apps", /generative|\bllm|large language|\bgpt|content generation|chatbot|assistant/i],
  ["Applied ML / Analytics", /machine learning|predictive|analytics|forecast/i],
];

const INDUSTRY_RULES: [string, RegExp][] = [
  ["FinTech", /fintech|payments?|lending|banking|\bcredit\b|insurance|insurtech|wealth|invest|accounting|\bspend\b|neobank|\bupi\b/i],
  ["HealthTech", /health|medical|clinic|patient|pharma|diagnos|hospital|wellness|biotech|therapeut/i],
  ["EdTech", /education|edtech|learning platform|students?|tutor|course|school|upskill/i],
  ["Developer Tools", /developer tools?|devtools|engineering, product and design|\bapi\b platform|\bsdk\b|open source|ci\/cd|observability|for developers|code(base)?\b/i],
  ["Cybersecurity", /security|cyber|fraud|identity verification|compliance automation|threat/i],
  ["E-commerce", /e-?commerce|retail|marketplace|d2c|online store|shopping|quick commerce/i],
  ["Web3", /crypto|blockchain|web3|\bdefi\b|\bnft\b|bitcoin|stablecoin/i],
  ["ClimateTech", /climate|energy|\bev\b|electric vehicle|battery|solar|carbon|sustainab|clean ?tech/i],
  ["Consumer", /\bconsumer\b|social|dating|gaming|entertainment|media|travel|food|fitness|matrimon/i],
  ["SaaS", /\bb2b\b|saas|enterprise|workflow|platform for (teams|businesses|companies)|crm|\bhr tech|productivity|sales tools|operations/i],
];

/** Maps a source's own taxonomy (YC industry "B2B -> Security", tags) onto our categories. */
function structuredIndustry(hint: string | null, tags: string[]): string | undefined {
  if (!hint && !tags.length) return undefined;
  const has = (re: RegExp) => tags.some((t) => re.test(t)) || (hint ? re.test(hint) : false);
  const primary = (hint ?? "").split("->")[0].trim().toLowerCase();
  if (has(/crypto|web3|blockchain/i)) return "Web3";
  if (has(/cybersecurity|^security$|-> security/i)) return "Cybersecurity";
  if (primary === "fintech" || has(/^fintech$|^payments$/i)) return "FinTech";
  if (primary === "healthcare" || has(/^health ?tech$|^digital health$/i)) return "HealthTech";
  if (primary === "education" || has(/^edtech$|^education$/i)) return "EdTech";
  if (has(/developer tools|engineering, product and design|^open source$|^api$|aiops|data engineering|-> infrastructure/i)) return "Developer Tools";
  if (has(/^climate$|^energy$|-> climate|-> energy/i)) return "ClimateTech";
  if (has(/^e-commerce$|-> retail|^marketplace$/i)) return "E-commerce";
  if (primary === "consumer" || has(/^consumer$/i)) return "Consumer";
  if (primary === "b2b" || has(/^saas$|^b2b$|^enterprise software$/i)) return "SaaS";
  if (primary && primary !== "unspecified") return "Other"; // e.g. Real Estate, Industrials, Government
  return undefined;
}

export function classifyStartup(input: ClassificationInput): Classification {
  const reasons: string[] = [];
  const desc = input.description ?? "";
  const firstSentence = desc.split(/(?<=[.!?])\s/)[0] ?? "";
  const aiTags = input.tags.filter((t) => AI_TAG.test(t));
  const aiMentions = (desc.match(AI_TEXT) ?? []).length;
  const aiInPitch = /\bAI\b|artificial intelligence|machine learning|\bLLM|generative AI|AI agents?|agentic|computer vision/i.test(
    firstSentence + " " + input.name.replace(/\.ai$/i, " AI")
  );

  let is_ai: boolean | null;
  let conf: Classification["classification_confidence"];
  if (!desc && input.tags.length === 0) {
    is_ai = null;
    conf = "low";
    reasons.push("No company description available — AI status unknown");
  } else if ((aiTags.length && (aiInPitch || aiMentions >= 2)) || (aiInPitch && aiMentions >= 3)) {
    is_ai = true;
    conf = "high";
    if (aiTags.length) reasons.push(`Source tags: ${aiTags.join(", ")}`);
    if (aiInPitch) reasons.push("AI is in the company's one-line pitch");
    reasons.push(`${aiMentions} AI mentions in description`);
  } else if (aiTags.length || aiInPitch || aiMentions >= 3) {
    is_ai = true;
    conf = "medium";
    reasons.push(aiTags.length ? `Source tags: ${aiTags.join(", ")}` : aiInPitch ? "AI in one-line pitch" : `${aiMentions} AI mentions in description`);
  } else {
    is_ai = false;
    conf = aiMentions > 0 ? "medium" : "high";
    reasons.push(aiMentions > 0 ? `Only ${aiMentions} passing AI mention(s) — not treated as an AI startup` : "No AI signals in description or tags");
  }

  let ai_category: string | null = null;
  if (is_ai) {
    const text = `${firstSentence} ${input.tags.join(" ")} ${desc}`;
    ai_category = AI_CATEGORIES.find(([, re]) => re.test(text))?.[0] ?? "Applied AI";
  }

  const haystack = `${input.industryHint ?? ""} | ${input.tags.join(", ")} | ${desc}`;
  let industry = structuredIndustry(input.industryHint, input.tags);
  if (industry) reasons.push(`Industry from source's own category (${input.industryHint || input.tags.slice(0, 3).join(", ")}): ${industry}`);
  else {
    industry = INDUSTRY_RULES.find(([, re]) => re.test(haystack))?.[0];
    if (industry) reasons.push(`Industry from description keywords: ${industry}`);
  }
  if (is_ai && conf === "high" && (!industry || industry === "SaaS")) {
    industry = "AI Startup";
  }
  if (!industry) {
    industry = "Other";
    if (conf === "high" && is_ai === false) conf = "medium";
  }
  return { industry, is_ai, ai_category, classification_confidence: conf, reasons };
}
