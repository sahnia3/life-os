import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  insertHookEvent,
  insertFileTouch,
} from "@/lib/agent-os/db";
import { getBus } from "@/lib/agent-os/event-bus";
import { getHookState, type HookBroadcast } from "@/lib/agent-os/hooks-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Ingest endpoint for Claude Code HTTP hooks.
 * Configure in ~/.claude/settings.json with type:"http" hooks pointing here.
 * Accepts the raw hook JSON payload; tolerant of schema variation across
 * Claude Code versions.
 */

function pick<T = unknown>(o: Record<string, unknown>, ...keys: string[]): T | null {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k] as T;
  }
  return null;
}

function deriveMessage(
  eventName: string,
  p: Record<string, unknown>
): string {
  const direct = pick<string>(
    p,
    "message",
    "last_assistant_message",
    "reason",
    "error"
  );
  if (direct && typeof direct === "string") return direct.slice(0, 500);
  const toolName = pick<string>(p, "tool_name");
  if (eventName === "PreToolUse" && toolName) {
    const ti = p.tool_input as Record<string, unknown> | undefined;
    if (ti) {
      if (typeof ti.command === "string") return `${toolName}: ${ti.command}`.slice(0, 200);
      if (typeof ti.file_path === "string")
        return `${toolName}: ${path.basename(ti.file_path)}`;
      if (typeof ti.pattern === "string") return `${toolName}: ${ti.pattern}`;
    }
    return `Running ${toolName}`;
  }
  if (eventName === "PostToolUse" && toolName) return `${toolName} done`;
  return eventName;
}

function statusFor(eventName: string): HookBroadcast["status"] {
  switch (eventName) {
    case "Stop":
      return "finished";
    case "StopFailure":
    case "Error":
      return "error";
    case "Notification":
      return "waiting";
    case "SessionEnd":
      return "finished";
    default:
      return "working";
  }
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventName =
    pick<string>(payload, "hook_event_name", "hookEventName", "event") ||
    "Unknown";
  const sessionId = pick<string>(payload, "session_id", "sessionId");
  const cwd = pick<string>(payload, "cwd", "workspace_dir");
  const matcher = pick<string>(payload, "matcher", "notification_type");
  const toolName = pick<string>(payload, "tool_name", "toolName");
  const ts = Date.now();
  const message = deriveMessage(eventName, payload);
  const projectName = cwd ? path.basename(cwd) : "(unknown)";

  // Persist raw event
  try {
    insertHookEvent({
      sessionId,
      cwd,
      eventName,
      matcher,
      toolName,
      message,
      payload,
      ts,
    });
  } catch (e) {
    console.error("[agent-os] hook insert failed", e);
  }

  // File-collision tracking on Edit/Write/NotebookEdit PreToolUse
  if (
    eventName === "PreToolUse" &&
    sessionId &&
    toolName &&
    /^(Edit|Write|NotebookEdit|MultiEdit)$/.test(toolName)
  ) {
    const ti = payload.tool_input as Record<string, unknown> | undefined;
    const fp = ti && typeof ti.file_path === "string" ? ti.file_path : null;
    if (fp) {
      try {
        insertFileTouch({
          sessionId,
          cwd,
          filePath: fp,
          toolName,
          ts,
        });
      } catch {
        /* ignore */
      }
    }
  }

  // Update live state + broadcast
  const broadcast: HookBroadcast = {
    sessionId,
    cwd,
    projectName,
    eventName,
    matcher,
    toolName,
    message,
    ts,
    status: statusFor(eventName),
  };
  const state = getHookState().ingest(broadcast);
  const bus = getBus();
  bus.emit({ type: "hook", event: broadcast });
  if (state) {
    bus.emit({ type: "attention", items: getHookState().attentionQueue() });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Health check for installer verification
  return NextResponse.json({
    ok: true,
    service: "agent-os-hook-ingest",
    liveSessions: getHookState().size(),
  });
}
