// Search queries generated from the candidate profile (nothing hard-coded about the candidate).
import type { CandidateProfile } from "@/lib/types";

export function generateQueries(p: CandidateProfile, year = new Date().getFullYear()): string[] {
  const locs = (p.preferred_locations ?? []).filter((l) => !/remote/i.test(l));
  const wantsRemote = (p.preferred_locations ?? []).some((l) => /remote/i.test(l));
  const places = [...locs, ...(wantsRemote ? ["remote India"] : [])];
  const roles = p.target_roles ?? [];
  const langs = (p.programming_languages ?? []).filter((l) => l !== "SQL");
  const hasAi = (p.ai_ml_skills ?? []).length > 0;

  const q = new Set<string>();
  for (const place of places) {
    q.add(`${place} startup hiring software engineer`);
    q.add(`${place} startup careers`);
    for (const role of roles) q.add(`${place} startup hiring ${role}`);
    for (const lang of langs) q.add(`${place} ${lang} developer jobs startup`);
    for (const fw of (p.frameworks ?? []).slice(0, 4)) q.add(`${place} ${fw} jobs startup`);
    if (hasAi) q.add(`${place} AI startup hiring`);
    q.add(`${place} SaaS startup hiring`);
  }
  q.add(`new startups ${locs[0] ?? "India"} ${year}`);
  if (hasAi) q.add(`new AI startups India ${year}`);
  q.add(`recently funded startups India ${year} hiring`);
  return [...q];
}
