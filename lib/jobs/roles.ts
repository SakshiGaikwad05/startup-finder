// Job-role categories for the "Job roles" filter. A job can be in several (e.g. "AI Full Stack Engineer").
export const ROLE_CATEGORIES = ["AI / ML", "Full Stack", "Backend", "Frontend", "Support / Solutions"] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number] | "Other";

const RULES: [RoleCategory, RegExp][] = [
  [
    "AI / ML",
    /\bai\b|\bml\b|machine learning|\bllms?\b|gen\s?ai|generative|deep learning|computer vision|\bnlp\b|data scien|applied scien|research (engineer|scientist)|\bagents?\b|agentic|prompt/i,
  ],
  ["Full Stack", /full[\s-]?stack/i],
  ["Backend", /back[\s-]?end|server[\s-]side|\bapi (engineer|developer)|python (developer|engineer)|node(\.?js)? (developer|engineer)|platform engineer/i],
  ["Frontend", /front[\s-]?end|\bui (engineer|developer)|react (developer|engineer)|web developer/i],
  ["Support / Solutions", /support engineer|technical support|application support|solutions engineer|implementation|customer engineer|forward deployed/i],
];

export function roleCategories(title: string, extra = ""): RoleCategory[] {
  const text = `${title} ${extra}`;
  const out = RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
  return out.length ? out : ["Other"];
}
