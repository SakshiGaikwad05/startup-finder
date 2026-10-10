// Visitor identity: a random secret token in an httpOnly cookie. No passwords or emails.
// The same token in a "private link" lets someone reopen their profile on another device.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/database";
import type { CandidateProfile } from "@/lib/types";

export const USER_COOKIE = "sf_uid";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface AppUser {
  id: number;
  token: string;
  profile: CandidateProfile;
  pinned: number[];
}

export async function userByToken(token: string | undefined | null): Promise<AppUser | null> {
  if (!token || token.length < 20) return null;
  const rows = await query<AppUser>("SELECT id, token, profile, pinned FROM users WHERE token = $1", [token]);
  if (!rows[0]) return null;
  // Cheap "last seen" bump, at most once an hour per user.
  query("UPDATE users SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '1 hour'", [rows[0].id]).catch(() => {});
  return rows[0];
}

/** Current user from the request cookie (server components and route handlers). */
export async function currentUser(): Promise<AppUser | null> {
  const jar = await cookies();
  return userByToken(jar.get(USER_COOKIE)?.value);
}

export async function createUser(profile: CandidateProfile): Promise<AppUser> {
  const token = crypto.randomBytes(24).toString("base64url");
  const rows = await query<AppUser>(
    "INSERT INTO users (token, profile) VALUES ($1, $2) RETURNING id, token, profile, pinned",
    [token, JSON.stringify(profile)]
  );
  return rows[0];
}

export async function updateUserProfile(userId: number, profile: CandidateProfile): Promise<void> {
  await query("UPDATE users SET profile = $2, updated_at = now() WHERE id = $1", [userId, JSON.stringify(profile)]);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};
