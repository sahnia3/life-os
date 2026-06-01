import path from "path";
import type {
  AttentionItem,
  AttentionReason,
  HookLiveStatus,
  HookSessionState,
} from "./types";

export interface HookBroadcast {
  sessionId: string | null;
  cwd: string | null;
  projectName: string;
  eventName: string;
  matcher: string | null;
  toolName: string | null;
  message: string;
  ts: number;
  status: HookLiveStatus;
}

declare global {
  var __agentOsHookState: HookStateStore | undefined;
}

function projectFromCwd(cwd: string | null): string {
  if (!cwd) return "(unknown)";
  return path.basename(cwd) || cwd;
}

/**
 * In-memory live state derived from Claude Code HTTP hook events.
 * This is the authoritative source: pushed structured events beat polled
 * JSONL heuristics. Falls back gracefully — sessions only appear here once
 * they've fired at least one hook.
 */
class HookStateStore {
  private sessions = new Map<string, HookSessionState>();

  ingest(b: HookBroadcast): HookSessionState | null {
    const sid = b.sessionId;
    if (!sid) return null;
    const prev = this.sessions.get(sid);
    const now = b.ts || Date.now();

    let status: HookLiveStatus = b.status;
    let attention: AttentionItem | null = prev?.attention ?? null;

    const ev = b.eventName;
    const matcher = b.matcher;

    if (ev === "SessionStart") {
      status = "working";
      attention = null;
    } else if (ev === "SessionEnd") {
      status = "finished";
      attention = null;
    } else if (ev === "UserPromptSubmit") {
      status = "working";
      attention = null;
    } else if (ev === "PreToolUse" || ev === "PostToolUse") {
      status = "working";
      attention = null;
    } else if (ev === "Notification") {
      if (matcher === "permission_prompt" || /permission|approve/i.test(b.message)) {
        status = "waiting";
        attention = {
          sessionId: sid,
          cwd: b.cwd,
          projectName: b.projectName,
          reason: "permission_prompt",
          message: b.message || "Wants permission to use a tool",
          since: now,
          toolName: b.toolName,
        };
      } else if (matcher === "idle_prompt" || /idle|waiting/i.test(b.message)) {
        status = "waiting";
        attention = {
          sessionId: sid,
          cwd: b.cwd,
          projectName: b.projectName,
          reason: "idle_prompt",
          message: b.message || "Idle — waiting for your input",
          since: now,
          toolName: null,
        };
      }
    } else if (ev === "Stop") {
      status = "finished";
      attention = {
        sessionId: sid,
        cwd: b.cwd,
        projectName: b.projectName,
        reason: "finished",
        message: b.message || "Finished a turn",
        since: now,
        toolName: null,
      };
    } else if (ev === "StopFailure" || ev === "Error") {
      status = "error";
      attention = {
        sessionId: sid,
        cwd: b.cwd,
        projectName: b.projectName,
        reason: "error",
        message: b.message || "Session hit an error",
        since: now,
        toolName: null,
      };
    } else if (ev === "SubagentStop") {
      status = prev?.status ?? "working";
    }

    const state: HookSessionState = {
      sessionId: sid,
      cwd: b.cwd ?? prev?.cwd ?? null,
      projectName:
        b.projectName !== "(unknown)"
          ? b.projectName
          : prev?.projectName ?? projectFromCwd(b.cwd),
      status,
      lastEventName: ev,
      lastMessage: b.message || prev?.lastMessage || "",
      lastTool: b.toolName ?? prev?.lastTool ?? null,
      updatedAt: now,
      startedAt: prev?.startedAt ?? now,
      attention,
    };
    this.sessions.set(sid, state);
    return state;
  }

  /** Decay: sessions silent > 3 min while "working" drift to idle. */
  private decay(): void {
    const now = Date.now();
    for (const s of this.sessions.values()) {
      if (s.status === "working" && now - s.updatedAt > 3 * 60 * 1000) {
        s.status = "idle";
      }
    }
  }

  list(): HookSessionState[] {
    this.decay();
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  get(sessionId: string): HookSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /** Sessions that need the human, ranked: permission > error > idle > finished. */
  attentionQueue(): AttentionItem[] {
    this.decay();
    const order: Record<AttentionReason, number> = {
      permission_prompt: 0,
      error: 1,
      idle_prompt: 2,
      finished: 3,
    };
    const items: AttentionItem[] = [];
    for (const s of this.sessions.values()) {
      if (s.attention && (s.status === "waiting" || s.status === "error")) {
        items.push(s.attention);
      }
    }
    return items.sort((a, b) => {
      const o = order[a.reason] - order[b.reason];
      if (o !== 0) return o;
      return a.since - b.since; // oldest blocked first within a tier
    });
  }

  clearAttention(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.attention = null;
      if (s.status === "waiting") s.status = "idle";
    }
  }

  size(): number {
    return this.sessions.size;
  }
}

export function getHookState(): HookStateStore {
  if (!globalThis.__agentOsHookState) {
    globalThis.__agentOsHookState = new HookStateStore();
  }
  return globalThis.__agentOsHookState;
}

export { projectFromCwd };
