import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { getPlaybook, recordRun } from "@/lib/agent-os/playbooks";
import { listTmuxSessions, resolveTmux } from "@/lib/agent-os/tmux";
import type { PlaybookRun } from "@/lib/agent-os/playbooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLAUDE_OS = path.join(os.homedir(), ".claude", "agent-os", "claude-os");
const QUEUE_DIR = path.join(os.homedir(), ".claude", "agent-os", "queue");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function spawnSession(opts: {
  tmuxName: string;
  cwd: string;
  initialPrompt: string;
  permissionMode?: string;
  model?: string;
}): Promise<{ ok: boolean; pid?: number; error?: string }> {
  const tmux = resolveTmux();
  if (!tmux) return { ok: false, error: "tmux not installed" };

  if (!fs.existsSync(opts.cwd) || !fs.statSync(opts.cwd).isDirectory()) {
    return { ok: false, error: `cwd does not exist: ${opts.cwd}` };
  }
  if (!fs.existsSync(CLAUDE_OS)) {
    return { ok: false, error: "claude-os wrapper not found" };
  }

  // Skip if session already exists
  const existing = await listTmuxSessions();
  if (existing.find((s) => s.name === opts.tmuxName)) {
    return {
      ok: false,
      error: `tmux session "${opts.tmuxName}" already exists. Kill it first or use a different name.`,
    };
  }

  // Stage the prompt in a queue file. The claude-os wrapper picks it up via
  // --queued-prompt-file flag.
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
  const promptFile = path.join(QUEUE_DIR, `${opts.tmuxName}.txt`);
  fs.writeFileSync(promptFile, opts.initialPrompt, "utf8");

  // Build the inner command for tmux to execute
  const claudeArgs: string[] = [];
  if (opts.permissionMode) {
    claudeArgs.push("--permission-mode", opts.permissionMode);
  }
  if (opts.model) {
    claudeArgs.push("--model", opts.model);
  }

  // Pass the prompt file as a positional. claude-os reads it and forwards as
  // the initial prompt to claude.
  const innerCmd = [
    `"${CLAUDE_OS}"`,
    "--queued-prompt-file",
    `"${promptFile}"`,
    ...claudeArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a)),
  ].join(" ");

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      tmux,
      ["new", "-d", "-s", opts.tmuxName, "-c", opts.cwd, innerCmd],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PATH: process.env.PATH ?? "" },
      }
    );
    proc.unref();
    proc.on("error", reject);
    setTimeout(resolve, 250);
  });

  // Verify
  await sleep(400);
  const sessions = await listTmuxSessions();
  const created = sessions.find((s) => s.name === opts.tmuxName);
  if (!created) {
    return { ok: false, error: "session did not start" };
  }
  return { ok: true, pid: created.pid ?? undefined };
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const pb = getPlaybook(id);
  if (!pb) return NextResponse.json({ error: "not found" }, { status: 404 });

  const runId = randomUUID();
  const startedAt = Date.now();
  const results: PlaybookRun["sessions"] = [];

  for (const s of pb.sessions) {
    const r = await spawnSession({
      tmuxName: s.tmuxName,
      cwd: s.cwd,
      initialPrompt: s.initialPrompt,
      permissionMode: s.permissionMode,
      model: s.model,
    });
    results.push({
      tmuxName: s.tmuxName,
      cwd: s.cwd,
      ok: r.ok,
      error: r.error,
      pid: r.pid,
    });
  }

  const run: PlaybookRun = {
    runId,
    playbookId: pb.id,
    startedAt,
    completedAt: Date.now(),
    sessions: results,
  };
  recordRun(run);

  return NextResponse.json({ run });
}
