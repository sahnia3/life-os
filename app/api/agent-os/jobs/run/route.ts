import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Manually trigger the job-watcher's `cycle` (poll -> score -> digest) on
// demand, instead of waiting for its daily 08:30 LaunchAgent. The cycle runs
// as a detached child so the request returns immediately; a lock file lets the
// UI poll for completion and prevents double-firing.
const JOB_WATCHER_DIR =
  process.env.JOB_WATCHER_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/job-watcher";

const LOCK_PATH = path.join(JOB_WATCHER_DIR, "logs", ".life-os-run.lock");
const PY = path.join(".venv", "bin", "python"); // relative to cwd
const LOG_REL = path.join("logs", "life-os-run.log"); // relative to cwd
const STALE_MS = 20 * 60_000;

interface Lock {
  startedAt: number;
}

function readLock(): Lock | null {
  try {
    const j = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as Lock;
    return typeof j.startedAt === "number" ? j : null;
  } catch {
    return null;
  }
}

function isRunning(lock: Lock | null): lock is Lock {
  return !!lock && Date.now() - lock.startedAt < STALE_MS;
}

export async function GET() {
  const lock = readLock();
  const running = isRunning(lock);
  if (lock && !running) {
    try {
      fs.unlinkSync(LOCK_PATH); // clean up a stale/crashed lock
    } catch {
      /* ignore */
    }
  }
  return NextResponse.json({
    running,
    startedAt: running ? lock.startedAt : null,
  });
}

export async function POST() {
  const existing = readLock();
  if (isRunning(existing)) {
    return NextResponse.json(
      {
        running: true,
        startedAt: existing.startedAt,
        error: "A scan is already running.",
      },
      { status: 409 }
    );
  }

  // Write the lock first so a status poll reflects "running" immediately.
  try {
    fs.writeFileSync(LOCK_PATH, JSON.stringify({ startedAt: Date.now() }));
  } catch (e) {
    console.error("jobs/run: failed to write lock", e);
    return NextResponse.json(
      { error: "Could not start scan (lock write failed)." },
      { status: 500 }
    );
  }

  // Shell wrapper runs the cycle, then clears the lock on completion.
  // All paths are trusted constants — no user input is interpolated.
  const cmd = `${PY} -m src.cli cycle >> ${LOG_REL} 2>&1; rm -f ${JSON.stringify(
    LOCK_PATH
  )}`;

  try {
    const child = spawn("bash", ["-c", cmd], {
      cwd: JOB_WATCHER_DIR,
      detached: true,
      stdio: "ignore",
    });
    child.on("error", (err) => {
      console.error("jobs/run: spawn error", err);
      try {
        fs.unlinkSync(LOCK_PATH);
      } catch {
        /* ignore */
      }
    });
    child.unref();
  } catch (e) {
    console.error("jobs/run: spawn threw", e);
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: "Could not start scan." }, { status: 500 });
  }

  return NextResponse.json({ started: true, startedAt: Date.now() });
}
