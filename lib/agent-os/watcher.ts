import chokidar, { FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";
import readline from "readline";
import os from "os";
import {
  getClaudeProjectsDir,
  getClaudeSessionsDir,
  getCursor,
  setCursor,
  insertTokenEvent,
  getAllAnchors,
  getAllDigests,
} from "./db";
import { parseJsonlLine } from "./jsonl-parser";
import { getBus } from "./event-bus";
import { getAllClassifications } from "./classifier";
import {
  isPidAlive,
  listAllSessionJsonFiles,
  listRunningClaudePids,
  projectNameForCwd,
} from "./sessions";
import type { SessionEvent, SessionMeta, SessionStatus } from "./types";

declare global {
   
  var __agentOsWatcher: AgentOsWatcher | undefined;
}

const IDLE_THRESHOLD_MS = 90_000;
const RECONCILE_INTERVAL_MS = 5_000;

interface LiveSession {
  meta: SessionMeta;
  lastWindowTokens: { input: number; output: number; cacheCreate: number; cacheRead: number };
  lastUserEventAt: number;
  lastAssistantEndedWithQuestion: boolean;
}

class AgentOsWatcher {
  private watcher: FSWatcher | null = null;
  private sessions = new Map<string, LiveSession>(); // sessionId -> live meta
  private byJsonl = new Map<string, string>(); // jsonlPath -> sessionId
  private offsets = new Map<string, number>();
  private reconcileTimer: NodeJS.Timeout | null = null;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;

    const projects = getClaudeProjectsDir();
    const sessionsDir = getClaudeSessionsDir();
    if (!fs.existsSync(projects)) {
      console.warn("[agent-os] projects dir missing:", projects);
      return;
    }

    // chokidar v4 dropped built-in glob support: watch dirs and filter on events.
    const watchTargets = [projects];
    if (fs.existsSync(sessionsDir)) watchTargets.push(sessionsDir);

    this.watcher = chokidar.watch(watchTargets, {
      persistent: true,
      usePolling: false,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      ignoreInitial: false,
      ignorePermissionErrors: true,
      ignored: (p) => p.includes("/node_modules/") || p.endsWith(".tmp"),
    });

    this.watcher
      .on("add", (p) => {
        if (p.endsWith(".jsonl")) void this.processJsonl(p, true);
        else if (p.endsWith(".json") && p.includes("/.claude/sessions/"))
          this.reconcile();
      })
      .on("change", (p) => {
        if (p.endsWith(".jsonl")) void this.processJsonl(p, false);
        else if (p.endsWith(".json") && p.includes("/.claude/sessions/"))
          this.reconcile();
      })
      .on("ready", () => {
        console.log("[agent-os] watcher ready");
      })
      .on("error", (e) => {
        console.error("[agent-os] watcher error", e);
      });

    this.reconcile();
    this.reconcileTimer = setInterval(() => this.reconcile(), RECONCILE_INTERVAL_MS);

    // Heartbeat to subscribers
    setInterval(() => {
      getBus().emit({ type: "heartbeat", ts: Date.now() });
    }, 25_000);
  }

  stop(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    void this.watcher?.close();
    this.watcher = null;
    this.started = false;
  }

  getSnapshot(): SessionMeta[] {
    return Array.from(this.sessions.values()).map((s) => s.meta);
  }

  private async processJsonl(jsonlPath: string, initial: boolean): Promise<void> {
    try {
      const stat = fs.statSync(jsonlPath);
      let offset = this.offsets.get(jsonlPath);
      if (offset === undefined) {
        offset = getCursor(jsonlPath);
        this.offsets.set(jsonlPath, offset);
      }
      if (offset > stat.size) {
        // file truncated/rotated — reset
        offset = 0;
      }
      if (offset === stat.size) return;

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(jsonlPath, {
          start: offset,
          encoding: "utf8",
        });
        const rl = readline.createInterface({ input: stream });
        let lastOffset = offset!;
        // Track how many bytes we consumed
        let consumed = 0;

        rl.on("line", (line) => {
          consumed += Buffer.byteLength(line, "utf8") + 1; // +1 for newline
          if (!line.trim()) return;

          const parsed = parseJsonlLine(line);
          if (!parsed) return;

          this.handleParsedLine(parsed, jsonlPath, initial);
          lastOffset = offset! + consumed;
        });

        rl.on("close", () => {
          this.offsets.set(jsonlPath, lastOffset);
          setCursor(jsonlPath, lastOffset);
          resolve();
        });
        rl.on("error", (e) => reject(e));
      });
    } catch (e) {
      console.error("[agent-os] processJsonl error", jsonlPath, e);
    }
  }

  private handleParsedLine(
    parsed: ReturnType<typeof parseJsonlLine>,
    jsonlPath: string,
    initial: boolean
  ): void {
    if (!parsed) return;
    const sessionId = parsed.sessionId ?? this.sessionIdFromJsonl(jsonlPath);
    if (!sessionId) return;

    const cwd = parsed.cwd ?? this.cwdFromExisting(sessionId);
    this.byJsonl.set(jsonlPath, sessionId);

    if (parsed.tokens) {
      insertTokenEvent({
        session_id: sessionId,
        cwd,
        ts: parsed.ts,
        input: parsed.tokens.input,
        output: parsed.tokens.output,
        cache_create: parsed.tokens.cacheCreate,
        cache_read: parsed.tokens.cacheRead,
        model: parsed.model,
        jsonl_path: jsonlPath,
        jsonl_offset: this.offsets.get(jsonlPath) ?? 0,
      });
    }

    // Update in-memory session
    let live = this.sessions.get(sessionId);
    if (!live) {
      live = {
        meta: {
          sessionId,
          pid: null,
          cwd: cwd ?? "",
          projectName: cwd ? projectNameForCwd(cwd) : "(unknown)",
          startedAt: parsed.ts,
          status: "active",
          lastEventAt: parsed.ts,
          lastSummary: parsed.summary || "(no summary)",
          lastTool: parsed.toolName,
          contextPct: null,
          tokensThisWindow: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
          jsonlPath,
          anchor: null,
          anchorUpdatedAt: null,
          digest: null,
          digestGeneratedAt: null,
          goalAlignment: null,
          awaitingInput: false,
          awaitingSince: null,
          tmuxName: null,
          role: null,
          roleFocus: null,
        },
        lastWindowTokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
        lastUserEventAt: 0,
        lastAssistantEndedWithQuestion: false,
      };
      this.sessions.set(sessionId, live);
      if (!initial) getBus().emit({ type: "session-added", session: live.meta });
    } else {
      // Update meta
      if (cwd && !live.meta.cwd) {
        live.meta.cwd = cwd;
        live.meta.projectName = projectNameForCwd(cwd);
      }
      live.meta.jsonlPath = jsonlPath;
      if (parsed.ts > live.meta.lastEventAt) live.meta.lastEventAt = parsed.ts;
      if (parsed.summary) live.meta.lastSummary = parsed.summary;
      if (parsed.toolName) live.meta.lastTool = parsed.toolName;
    }

    if (parsed.tokens) {
      live.meta.tokensThisWindow.input += parsed.tokens.input;
      live.meta.tokensThisWindow.output += parsed.tokens.output;
      live.meta.tokensThisWindow.cacheRead += parsed.tokens.cacheRead;
      live.meta.tokensThisWindow.cacheCreate += parsed.tokens.cacheCreate;
    }

    // Track awaiting-input state: assistant message ending with '?' AND no
    // user response since means session is waiting on the user.
    if (parsed.kind === "user") {
      live.lastUserEventAt = parsed.ts;
      live.lastAssistantEndedWithQuestion = false;
      live.meta.awaitingInput = false;
      live.meta.awaitingSince = null;
    } else if (parsed.kind === "assistant") {
      const trimmed = (parsed.summary || "").trim();
      const endsWithQ = /[?]\s*[")\]'»。]*$/.test(trimmed);
      live.lastAssistantEndedWithQuestion = endsWithQ;
      if (endsWithQ && live.lastUserEventAt < parsed.ts) {
        live.meta.awaitingInput = true;
        live.meta.awaitingSince = parsed.ts;
      } else if (!endsWithQ) {
        live.meta.awaitingInput = false;
        live.meta.awaitingSince = null;
      }
    } else if (parsed.kind === "tool_use") {
      // Tool use clears awaiting (assistant is actively working)
      live.meta.awaitingInput = false;
      live.meta.awaitingSince = null;
    }

    if (!initial) {
      const evt: SessionEvent = {
        sessionId,
        cwd,
        jsonlPath,
        ts: parsed.ts,
        kind: parsed.kind,
        summary: parsed.summary,
        toolName: parsed.toolName,
        tokens: parsed.tokens,
        model: parsed.model,
      };
      getBus().emit({ type: "event", sessionId, event: evt });
      getBus().emit({ type: "session-updated", session: live.meta });
    }
  }

  private sessionIdFromJsonl(jsonlPath: string): string | null {
    const m = /([0-9a-f-]{36})\.jsonl$/i.exec(jsonlPath);
    return m ? m[1] : null;
  }

  private cwdFromExisting(sessionId: string): string | null {
    const live = this.sessions.get(sessionId);
    return live?.meta.cwd || null;
  }

  private reconcile(): void {
    const pids = listRunningClaudePids();
    const sessionJsonRecords = listAllSessionJsonFiles();
    const aliveByPid = new Map(pids.map((p) => [p.pid, p]));

    // Map sessionId -> pid via session json
    for (const rec of sessionJsonRecords) {
      const live = this.sessions.get(rec.sessionId);
      const alive = aliveByPid.has(rec.pid) && isPidAlive(rec.pid);
      if (live) {
        live.meta.pid = rec.pid;
        if (!live.meta.cwd) {
          live.meta.cwd = rec.cwd;
          live.meta.projectName = projectNameForCwd(rec.cwd);
        }
        live.meta.status = this.deriveStatus(live, alive);
        getBus().emit({ type: "session-updated", session: live.meta });
      }
    }

    // For sessions with no matching pid in session json, derive from JSONL freshness only
    for (const live of this.sessions.values()) {
      if (live.meta.pid !== null) {
        const alive = isPidAlive(live.meta.pid);
        live.meta.status = this.deriveStatus(live, alive);
      } else {
        live.meta.status = this.deriveStatus(live, false);
      }
    }

    // Attach anchors + digests from DB
    this.attachAnchorsAndDigests();

    // Read contextPct flag files if present
    this.refreshContextPcts();

    // Resolve tmux names by matching session cwd to tmux session start dirs
    void this.attachTmuxNames();
  }

  private attachAnchorsAndDigests(): void {
    try {
      const anchors = getAllAnchors();
      const digests = getAllDigests();
      const classifications = getAllClassifications();
      for (const live of this.sessions.values()) {
        const a = anchors.get(live.meta.sessionId);
        live.meta.anchor = a?.text ?? null;
        live.meta.anchorUpdatedAt = a?.updatedAt ?? null;
        const d = digests.get(live.meta.sessionId);
        live.meta.digest = d?.digestText ?? null;
        live.meta.digestGeneratedAt = d?.generatedAt ?? null;
        live.meta.goalAlignment = d?.goalAlignment ?? null;
        const c = classifications.get(live.meta.sessionId);
        live.meta.role = c?.role ?? null;
        live.meta.roleFocus = c?.focus ?? null;
      }
    } catch (e) {
      console.error("[agent-os] attachAnchorsAndDigests", e);
    }
  }

  private async attachTmuxNames(): Promise<void> {
    try {
      const { listTmuxSessions } = await import("./tmux");
      const tsessions = await listTmuxSessions();
      // Match by checking if tmux session pid's claude has the same cwd.
      // Cheaper heuristic: match if the tmux session's start directory equals
      // the claude session cwd. tmux doesn't expose start-dir directly via
      // list-panes, so fall back to: any tmux session whose pane_pid is an
      // ancestor of the claude pid wins. For now, match by name pattern if
      // user used playbooks (which set tmuxName predictably) — best-effort.
      for (const live of this.sessions.values()) {
        live.meta.tmuxName = null;
        if (!live.meta.cwd) continue;
        // 1) Exact cwd match (most reliable — tmux's pane_current_path
        //    equals the session's cwd when claude was started inside it).
        const exact = tsessions.find((t) => t.panePath === live.meta.cwd);
        if (exact) {
          live.meta.tmuxName = exact.name;
          continue;
        }
        // 2) Same project root match (cwd is a parent of panePath, or vice
        //    versa). Useful when claude cd's into subdirs inside the pane.
        const projectMatch = tsessions.find(
          (t) =>
            t.panePath &&
            (t.panePath.startsWith(live.meta.cwd + "/") ||
              live.meta.cwd.startsWith(t.panePath + "/"))
        );
        if (projectMatch) {
          live.meta.tmuxName = projectMatch.name;
          continue;
        }
        // 3) Fall back to basename-in-name heuristic
        const cwdBase = live.meta.cwd.split("/").pop() ?? "";
        const nameMatch = tsessions.find(
          (t) =>
            t.name === cwdBase ||
            t.name.startsWith(cwdBase + "-") ||
            t.name.endsWith("-" + cwdBase)
        );
        if (nameMatch) live.meta.tmuxName = nameMatch.name;
      }
    } catch {
      // tmux not installed — skip silently
    }
  }

  private deriveStatus(live: LiveSession, pidAlive: boolean): SessionStatus {
    const now = Date.now();
    const age = now - live.meta.lastEventAt;
    if (!pidAlive && live.meta.pid !== null) return "stale";
    // If JSONL has been silent for a while AND no pid info, consider stale
    if (!pidAlive && age > 10 * 60 * 1000) return "stale";
    if (live.meta.lastTool && age < 5_000) return "running-tool";
    if (age < IDLE_THRESHOLD_MS) return "active";
    return "idle";
  }

  private refreshContextPcts(): void {
    const dir = path.join(os.homedir(), ".claude", "agent-os", "context");
    if (!fs.existsSync(dir)) return;
    try {
      for (const f of fs.readdirSync(dir)) {
        const m = /^ctx-([0-9a-f-]{36})\.json$/i.exec(f);
        if (!m) continue;
        const sessionId = m[1];
        const live = this.sessions.get(sessionId);
        if (!live) continue;
        try {
          const raw = JSON.parse(
            fs.readFileSync(path.join(dir, f), "utf8")
          ) as { contextPct?: number };
          if (typeof raw.contextPct === "number") {
            live.meta.contextPct = raw.contextPct;
          }
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }
  }
}

export function getWatcher(): AgentOsWatcher {
  if (!globalThis.__agentOsWatcher) {
    globalThis.__agentOsWatcher = new AgentOsWatcher();
    globalThis.__agentOsWatcher.start();
  }
  return globalThis.__agentOsWatcher;
}
