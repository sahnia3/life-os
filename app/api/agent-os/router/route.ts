import { NextRequest, NextResponse } from "next/server";
import { listTmuxSessions, sendKeys } from "@/lib/agent-os/tmux";
import { getWatcher } from "@/lib/agent-os/watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DispatchTarget {
  tmuxName: string;
  text: string;
  sessionId: string | null;
  projectName: string | null;
}

function resolveAlias(
  alias: string,
  tmuxNames: string[],
  watcherProjects: Array<{ projectName: string; tmuxName: string | null; sessionId: string }>
): string | null {
  const lower = alias.toLowerCase();
  // Exact tmux name match
  const tx = tmuxNames.find((n) => n.toLowerCase() === lower);
  if (tx) return tx;
  // Prefix tmux name match (only if exactly one)
  const prefix = tmuxNames.filter((n) => n.toLowerCase().startsWith(lower));
  if (prefix.length === 1) return prefix[0];
  // Match by claude project name → tmux name
  const proj = watcherProjects.find(
    (p) => p.projectName.toLowerCase() === lower
  );
  if (proj?.tmuxName) return proj.tmuxName;
  return null;
}

function parseRoute(input: string, tmuxNames: string[], watcherProjects: Array<{ projectName: string; tmuxName: string | null; sessionId: string }>):
  | { ok: true; targets: string[]; text: string; broadcast: boolean }
  | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: false, error: "empty input" };

  // Match @all to broadcast
  if (/^@all\s+/.test(text)) {
    return {
      ok: true,
      broadcast: true,
      targets: tmuxNames,
      text: text.replace(/^@all\s+/, ""),
    };
  }

  // Match a comma-separated list of @aliases at the start
  const m = /^((?:@[A-Za-z0-9_\-]+(?:\s*,\s*@[A-Za-z0-9_\-]+)*)\s+)(.*)/s.exec(text);
  if (!m) {
    return {
      ok: false,
      error:
        "Prefix with @sessionName (or @all). Example: '@ml refactor login' or '@ml,@poly status?'",
    };
  }
  const aliases = m[1].trim().split(/\s*,\s*/).map((a) => a.replace(/^@/, ""));
  const body = m[2].trim();
  if (!body) return { ok: false, error: "no prompt text after @ targets" };

  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const a of aliases) {
    const t = resolveAlias(a, tmuxNames, watcherProjects);
    if (t) resolved.push(t);
    else unresolved.push(a);
  }
  if (unresolved.length > 0) {
    return {
      ok: false,
      error: `unknown alias: ${unresolved.join(", ")}. Available: ${tmuxNames.join(", ") || "(no tmux sessions)"}`,
    };
  }
  return { ok: true, broadcast: false, targets: resolved, text: body };
}

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const text = body.text;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const [tsessions, snapshot] = await Promise.all([
    listTmuxSessions(),
    Promise.resolve(getWatcher().getSnapshot()),
  ]);
  const tmuxNames = tsessions.map((s) => s.name);
  const projects = snapshot.map((s) => ({
    projectName: s.projectName,
    tmuxName: s.tmuxName,
    sessionId: s.sessionId,
  }));

  const parsed = parseRoute(text, tmuxNames, projects);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const results: Array<DispatchTarget & { ok: boolean; error?: string }> = [];
  for (const target of parsed.targets) {
    const proj = projects.find((p) => p.tmuxName === target);
    try {
      await sendKeys(target, parsed.text, true);
      results.push({
        tmuxName: target,
        text: parsed.text,
        sessionId: proj?.sessionId ?? null,
        projectName: proj?.projectName ?? null,
        ok: true,
      });
    } catch (e) {
      results.push({
        tmuxName: target,
        text: parsed.text,
        sessionId: proj?.sessionId ?? null,
        projectName: proj?.projectName ?? null,
        ok: false,
        error: e instanceof Error ? e.message : "send failed",
      });
    }
  }

  return NextResponse.json({
    broadcast: parsed.broadcast,
    dispatched: results,
  });
}
