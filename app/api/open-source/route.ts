// GET /api/open-source — open-source repos of YC companies with an open beginner issue, and the one we suggest.
import { NextResponse } from "next/server";
import { query } from "@/lib/database";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "read");
  if (limited) return limited;
  try {
    const [projects, [stats]] = await Promise.all([
      query(
        `SELECT repo, origin, github_org, company_name, company_yc_url, company_website, one_liner, yc_batch, hiring,
                stars, language, repo_description,
                beginner_issues, issue_title, issue_url, issue_labels, issue_comments, issue_updated_at, fetched_at
         FROM oss_projects ORDER BY (origin = 'yc') DESC, hiring DESC, issue_updated_at DESC NULLS LAST LIMIT 500`
      ),
      query<{ companies: number; with_github: number; last_search: string | null }>(
        "SELECT count(*)::int companies, count(github_org)::int with_github, max(searched_at) last_search FROM oss_orgs"
      ),
    ]);
    return NextResponse.json({ projects, stats });
  } catch (e) {
    console.error("open-source:", e);
    return NextResponse.json({ error: "Couldn't load open-source projects. Please try again in a moment." }, { status: 500 });
  }
}
