import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { resolveTmux, listTmuxSessions } from "@/lib/agent-os/tmux";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { name?: string; cwd?: string; cmd?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const cwd = body.cwd?.trim();
  const cmd = body.cmd?.trim() || path.join(os.homedir(), ".claude", "agent-os", "claude-os");

  if (!name || !/^[A-Za-z0-9_\-]+$/.test(name)) {
    return NextResponse.json(
      { error: "name required, alphanumeric/dash/underscore only" },
      { status: 400 }
    );
  }
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    return NextResponse.json(
      { error: "cwd must be an existing directory" },
      { status: 400 }
    );
  }

  const tmux = resolveTmux();
  if (!tmux) {
    return NextResponse.json({ error: "tmux not installed" }, { status: 400 });
  }

  // Spawn detached via setsid so the tmux server is its own session leader and
  // survives the API request lifecycle.
  const args = ["new", "-d", "-s", name, "-c", cwd, cmd];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(tmux, args, {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PATH: process.env.PATH ?? "" },
    });
    proc.unref();
    proc.on("error", reject);
    // tmux new -d returns immediately. Give it a beat.
    setTimeout(resolve, 200);
  });

  // Verify
  const sessions = await listTmuxSessions();
  const created = sessions.find((s) => s.name === name);
  if (!created) {
    return NextResponse.json(
      { error: "session did not start. Check tmux logs." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, session: created });
}
