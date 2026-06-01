import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The job-watcher is a standalone Python project that scores roles into a
// local SQLite db. We read it directly, mirroring how app/api/trades reads
// the polymarket-agent db.
const JOB_WATCHER_DIR =
  process.env.JOB_WATCHER_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/job-watcher";

const DB_PATH = path.join(JOB_WATCHER_DIR, "data", "jobs.db");

interface JoinedRow {
  id: number;
  source: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  posted_at: string | null;
  inserted_at: string;
  fit_score: number | null;
  fit_reason: string | null;
  suggested_resume: string | null;
  state: string;
  surfaced_at: string | null;
  applied_at: string | null;
}

const STATES = [
  "scored",
  "surfaced",
  "applied",
  "replied",
  "interviewing",
  "rejected",
  "ghosted",
] as const;

function emptyFunnel(): Record<string, number> {
  const f: Record<string, number> = { tracked: 0 };
  for (const s of STATES) f[s] = 0;
  return f;
}

export async function GET() {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const rows = db
      .prepare(
        `SELECT j.id, j.source, j.company, j.title, j.location, j.url,
                j.posted_at, j.inserted_at,
                a.fit_score, a.fit_reason, a.suggested_resume, a.state,
                a.surfaced_at, a.applied_at
         FROM jobs j
         JOIN applications a ON a.job_id = j.id
         ORDER BY a.fit_score DESC, j.inserted_at DESC`
      )
      .all() as JoinedRow[];

    const stateCounts = db
      .prepare("SELECT state, COUNT(*) AS n FROM applications GROUP BY state")
      .all() as { state: string; n: number }[];

    const stats = db
      .prepare(
        `SELECT AVG(fit_score) AS avg,
                SUM(CASE WHEN fit_score >= 9.0 THEN 1 ELSE 0 END) AS strong,
                COUNT(fit_score) AS scoredCount
         FROM applications`
      )
      .get() as {
      avg: number | null;
      strong: number | null;
      scoredCount: number;
    };

    db.close();

    const funnel = emptyFunnel();
    for (const { state, n } of stateCounts) {
      if (state in funnel) funnel[state] = n;
      funnel.tracked += n;
    }

    const jobs = rows.map((r) => ({
      id: r.id,
      source: r.source,
      company: r.company,
      title: r.title,
      location: r.location,
      url: r.url,
      postedAt: r.posted_at,
      insertedAt: r.inserted_at,
      fitScore: r.fit_score,
      fitReason: r.fit_reason,
      suggestedResume: r.suggested_resume,
      state: r.state,
      surfacedAt: r.surfaced_at,
      appliedAt: r.applied_at,
    }));

    return NextResponse.json({
      jobs,
      funnel,
      meta: {
        avgFit: stats.avg != null ? +stats.avg.toFixed(1) : null,
        strongCount: stats.strong ?? 0,
        scoredCount: stats.scoredCount ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to read job-watcher DB:", error);
    return NextResponse.json(
      {
        jobs: [],
        funnel: emptyFunnel(),
        meta: { avgFit: null, strongCount: 0, scoredCount: 0 },
        error:
          "Failed to read job-watcher database. Check JOB_WATCHER_DIR and that data/jobs.db exists.",
      },
      { status: 500 }
    );
  }
}
