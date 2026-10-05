import { NextResponse } from "next/server";
import { getProfile, query, saveProfile } from "@/lib/database";
import { generateQueries } from "@/lib/discovery/queries";
import { candidateSkillSet } from "@/lib/matching/skills";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  const sources = await query("SELECT * FROM sources ORDER BY id");
  return NextResponse.json({
    profile,
    queries: generateQueries(profile),
    canonicalSkills: [...candidateSkillSet(profile)].sort(),
    sources,
  });
}

const REQUIRED_ARRAYS = ["target_roles", "skills", "programming_languages", "frameworks", "preferred_locations"];

export async function PUT(req: Request) {
  const body = await req.json();
  for (const k of REQUIRED_ARRAYS) {
    if (!Array.isArray(body[k])) return NextResponse.json({ error: `"${k}" must be an array` }, { status: 400 });
  }
  if (typeof body.tech_experience_years !== "number") {
    return NextResponse.json({ error: `"tech_experience_years" must be a number` }, { status: 400 });
  }
  await saveProfile(body);
  return NextResponse.json({ ok: true });
}
