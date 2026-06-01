import { NextResponse, NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createClient } from "@/lib/supabase/server";

const AGENT_DIR =
  process.env.POLYMARKET_AGENT_DIR ||
  "/Users/adityasahni/Desktop/Claudecode/polymarket-agent";

const PROGRESS_PATH = path.join(AGENT_DIR, "data", "pipeline_progress.json");

let runningProcess: ReturnType<typeof spawn> | null = null;

async function verifyAuth(): Promise<boolean> {
  // Allow unauthenticated access ONLY when Supabase env vars are missing
  // (local dev without auth configured). Production MUST have a user session.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user !== null;
  } catch {
    return false;
  }
}

export async function POST(_req: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (runningProcess && !runningProcess.killed) {
    return NextResponse.json(
      { error: "A cycle is already running" },
      { status: 409 }
    );
  }

  try {
    // Write "starting" status BEFORE spawning Python.
    // Prevents race condition: SSE reads stale "completed" from previous cycle
    // and closes the connection before Python finishes importing.
    fs.writeFileSync(
      PROGRESS_PATH,
      JSON.stringify({ status: "starting", currentStage: "init", completedStages: [], detail: "Launching pipeline..." }),
    );

    const scriptPath = path.join(AGENT_DIR, "scripts", "run_weather_cycle.py");
    const pythonPath = path.join(AGENT_DIR, ".venv", "bin", "python3");

    runningProcess = spawn(pythonPath, [scriptPath], {
      cwd: AGENT_DIR,
      env: { ...process.env, PYTHONPATH: AGENT_DIR },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    runningProcess.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    runningProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    runningProcess.on("close", () => {
      runningProcess = null;
    });

    return NextResponse.json({
      status: "started",
      pid: runningProcess.pid,
    });
  } catch (error) {
    console.error("Failed to trigger cycle:", error);
    return NextResponse.json(
      { error: "Failed to start cycle" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    running: runningProcess !== null && !runningProcess.killed,
    pid: runningProcess?.pid ?? null,
  });
}
