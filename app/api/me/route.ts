// Current visitor: GET profile, POST create (onboarding), PUT update, DELETE sign out of this device.
import { NextResponse } from "next/server";
import { createUser, currentUser, updateUserProfile, USER_COOKIE, cookieOptions } from "@/lib/users";
import { GENERIC_PROFILE } from "@/lib/database";
import { generateQueries } from "@/lib/discovery/queries";
import { candidateSkillSet } from "@/lib/matching/skills";
import type { CandidateProfile } from "@/lib/types";
import { LOCATION_OPTIONS } from "@/lib/types";
import { STARTUP_TYPE_OPTIONS } from "@/lib/resume/parse";

export const dynamic = "force-dynamic";

const strArr = (v: unknown, max = 80) =>
  Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string").map((x) => x.trim().slice(0, 60)).filter(Boolean))].slice(0, max) : [];

/** Accepts the onboarding form (or a full profile from the advanced editor) and returns a clean profile. */
function toProfile(body: any, base: CandidateProfile = GENERIC_PROFILE): CandidateProfile | string {
  const roles = strArr(body.target_roles, 20);
  const skills = strArr(body.skills);
  const locations = strArr(body.preferred_locations, 12).filter((l) => (LOCATION_OPTIONS as readonly string[]).includes(l));
  if (!roles.length) return "Pick at least one target role.";
  if (!skills.length) return "Add at least one skill.";
  if (!locations.length) return "Pick at least one location.";
  const years = Number(body.tech_experience_years);
  return {
    ...base,
    ...(typeof body.name === "string" ? { name: body.name.slice(0, 80) } : {}),
    target_roles: roles,
    skills,
    programming_languages: strArr(body.programming_languages ?? []),
    frameworks: strArr(body.frameworks ?? []),
    libraries: strArr(body.libraries ?? []),
    databases: strArr(body.databases ?? []),
    cloud_tools: strArr(body.cloud_tools ?? []),
    testing_skills: strArr(body.testing_skills ?? []),
    ai_ml_skills: strArr(body.ai_ml_skills ?? []),
    tech_experience_years: Number.isFinite(years) ? Math.max(0, Math.min(40, years)) : 0,
    preferred_locations: locations,
    remote_preference: locations.some((l) => l.startsWith("Remote")) ? "remote_ok" : "onsite",
    preferred_startup_types: strArr(body.preferred_startup_types, 12).filter((t) => STARTUP_TYPE_OPTIONS.includes(t)),
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: { id: user.id, profile: user.profile, privateLinkToken: user.token },
    queries: generateQueries(user.profile),
    canonicalSkills: [...candidateSkillSet(user.profile)].sort(),
  });
}

export async function POST(req: Request) {
  const profile = toProfile(await req.json());
  if (typeof profile === "string") return NextResponse.json({ error: profile }, { status: 400 });
  const existing = await currentUser();
  if (existing) {
    await updateUserProfile(existing.id, profile);
    return NextResponse.json({ ok: true, updated: true });
  }
  const user = await createUser(profile);
  const res = NextResponse.json({ ok: true, created: true });
  res.cookies.set(USER_COOKIE, user.token, cookieOptions);
  return res;
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "No profile yet." }, { status: 401 });
  const profile = toProfile(await req.json(), user.profile);
  if (typeof profile === "string") return NextResponse.json({ error: profile }, { status: 400 });
  await updateUserProfile(user.id, profile);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
