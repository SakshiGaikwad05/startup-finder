// Email display labels. Kept free of Node imports so client components can use it.

export type EmailType = "careers" | "general" | "person";

// Recruiting inboxes count as "Careers" (top priority); these are named hiring contacts.
const HIRING_LOCAL = /^(hiring|hire|hr|talent|people|join)\b/i;

export type EmailLabel = "Careers" | "Hiring" | "General contact" | "Person";

/**
 * Display label: Careers (careers@, jobs@, recruiting@, apply@), Hiring (hiring@, hr@, talent@),
 * General contact (hello@, info@, contact@ …), Person (a named individual listed on the site).
 */
export function emailLabel(e: { email: string; type: EmailType }): EmailLabel {
  if (e.type === "person") return "Person";
  const local = e.email.split("@")[0];
  if (HIRING_LOCAL.test(local)) return "Hiring";
  if (e.type === "careers") return "Careers";
  return "General contact";
}

/** Recruiting/careers inboxes first, then hiring contacts, then general, then individuals. */
export function emailPriority(e: { email: string; type: EmailType }): number {
  return ["Careers", "Hiring", "General contact", "Person"].indexOf(emailLabel(e));
}
