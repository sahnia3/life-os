export type SessionStatus = "active" | "idle" | "running-tool" | "stale";

export interface SessionMeta {
  sessionId: string;
  pid: number | null;
  cwd: string;
  projectName: string;
  startedAt: number;
  status: SessionStatus;
  lastEventAt: number;
  lastSummary: string;
  lastTool: string | null;
  contextPct: number | null;
  tokensThisWindow: TokenTotals;
  jsonlPath: string;
  anchor: string | null;
  anchorUpdatedAt: number | null;
  digest: string | null;
  digestGeneratedAt: number | null;
  goalAlignment: string | null;
  awaitingInput: boolean;
  awaitingSince: number | null;
  tmuxName: string | null;
  role: string | null;
  roleFocus: string | null;
}

export interface TokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
}

export interface TokenRollup {
  windowMs: number;
  windowStartedAt: number;
  totals: TokenTotals & { effectiveTotal: number };
  bySession: Record<
    string,
    TokenTotals & { projectName: string; cwd: string }
  >;
  buckets: Array<{ tsStart: number; effectiveTotal: number }>;
  warning?: string;
}

export type SessionEventKind =
  | "user"
  | "assistant"
  | "tool_use"
  | "tool_result"
  | "system"
  | "summary";

export interface SessionEvent {
  sessionId: string;
  cwd: string | null;
  jsonlPath: string;
  ts: number;
  kind: SessionEventKind;
  summary: string;
  toolName: string | null;
  tokens: TokenTotals | null;
  model: string | null;
}

export interface ParsedJsonlLine {
  ts: number;
  kind: SessionEventKind;
  summary: string;
  toolName: string | null;
  tokens: TokenTotals | null;
  model: string | null;
  sessionId: string | null;
  cwd: string | null;
}

export type AttentionReason =
  | "permission_prompt"
  | "idle_prompt"
  | "error"
  | "finished";

export interface AttentionItem {
  sessionId: string;
  cwd: string | null;
  projectName: string;
  reason: AttentionReason;
  message: string;
  since: number;
  toolName: string | null;
}

export type HookLiveStatus =
  | "working"
  | "waiting"
  | "idle"
  | "error"
  | "finished";

export interface HookSessionState {
  sessionId: string;
  cwd: string | null;
  projectName: string;
  status: HookLiveStatus;
  lastEventName: string;
  lastMessage: string;
  lastTool: string | null;
  updatedAt: number;
  startedAt: number;
  attention: AttentionItem | null;
}

export type StreamEvent =
  | { type: "snapshot"; sessions: SessionMeta[]; serverTime: number }
  | { type: "session-added"; session: SessionMeta }
  | { type: "session-removed"; sessionId: string }
  | { type: "session-updated"; session: SessionMeta }
  | { type: "event"; sessionId: string; event: SessionEvent }
  | { type: "hook"; event: import("./hooks-state").HookBroadcast }
  | { type: "attention"; items: AttentionItem[] }
  | { type: "heartbeat"; ts: number };
