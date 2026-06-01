import fs from "fs";
import readline from "readline";
import { parseJsonlLine } from "./jsonl-parser";
import type { ParsedJsonlLine } from "./types";

const RECAP_TAIL_LINES = 1500;
const MAX_TOOL_SAMPLES = 20;

interface RecapSeed {
  sessionId: string;
  cwd: string | null;
  projectName: string;
  startedAt: number | null;
  lastEventAt: number | null;
  userMessages: string[];
  assistantSummaries: string[];
  filesTouched: Set<string>;
  bashCommands: string[];
  totalTokens: { input: number; output: number; cacheCreate: number; cacheRead: number };
}

function isLikelyPath(s: string): boolean {
  return /^\/?[\w./-]+\.[a-z0-9]+$/i.test(s);
}

async function tailJsonl(filepath: string, maxLines: number): Promise<ParsedJsonlLine[]> {
  const events: ParsedJsonlLine[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filepath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    const buffer: ParsedJsonlLine[] = [];
    rl.on("line", (line) => {
      const parsed = parseJsonlLine(line);
      if (!parsed) return;
      buffer.push(parsed);
      if (buffer.length > maxLines) buffer.shift();
    });
    rl.on("close", () => {
      events.push(...buffer);
      resolve();
    });
    rl.on("error", reject);
  });
  return events;
}

function summarizeBashCommand(cmd: string): string {
  const trimmed = cmd.replace(/\s+/g, " ").trim();
  return trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
}

export async function generateRecap(
  sessionId: string,
  jsonlPath: string,
  cwd: string | null
): Promise<string> {
  if (!fs.existsSync(jsonlPath)) {
    throw new Error("JSONL file not found: " + jsonlPath);
  }
  const events = await tailJsonl(jsonlPath, RECAP_TAIL_LINES);
  if (events.length === 0) return "# Handoff\n\nNo events found.\n";

  const seed: RecapSeed = {
    sessionId,
    cwd,
    projectName: cwd ? cwd.split("/").pop() ?? "(unknown)" : "(unknown)",
    startedAt: events[0]?.ts ?? null,
    lastEventAt: events[events.length - 1]?.ts ?? null,
    userMessages: [],
    assistantSummaries: [],
    filesTouched: new Set(),
    bashCommands: [],
    totalTokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
  };

  for (const e of events) {
    if (e.tokens) {
      seed.totalTokens.input += e.tokens.input;
      seed.totalTokens.output += e.tokens.output;
      seed.totalTokens.cacheCreate += e.tokens.cacheCreate;
      seed.totalTokens.cacheRead += e.tokens.cacheRead;
    }
    if (e.kind === "user" && e.summary) {
      seed.userMessages.push(e.summary);
    }
    if (e.kind === "assistant" && e.summary) {
      seed.assistantSummaries.push(e.summary);
    }
    if (e.toolName === "Bash" && e.summary) {
      seed.bashCommands.push(summarizeBashCommand(e.summary));
    }
    if (
      (e.toolName === "Edit" || e.toolName === "Write" || e.toolName === "Read") &&
      e.summary
    ) {
      const m = /(?:Edit|Write|Read): (.+)/.exec(e.summary);
      if (m && isLikelyPath(m[1].trim())) seed.filesTouched.add(m[1].trim());
    }
  }

  const recentUserMsgs = seed.userMessages.slice(-5);
  const recentAssistant = seed.assistantSummaries.slice(-3);
  const recentBash = seed.bashCommands.slice(-MAX_TOOL_SAMPLES);
  const filesList = Array.from(seed.filesTouched).slice(-20);

  const fmtTokens = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : (n / 1000).toFixed(1) + "k");

  const recap = `# Session handoff

**Session ID**: \`${sessionId}\`
**Working directory**: \`${cwd ?? "(unknown)"}\`
**Project**: ${seed.projectName}
**Started**: ${seed.startedAt ? new Date(seed.startedAt).toLocaleString() : "(unknown)"}
**Last event**: ${seed.lastEventAt ? new Date(seed.lastEventAt).toLocaleString() : "(unknown)"}
**Events in this recap**: ${events.length}
**Token usage**: input=${fmtTokens(seed.totalTokens.input)}, output=${fmtTokens(seed.totalTokens.output)}, cache_create=${fmtTokens(seed.totalTokens.cacheCreate)}, cache_read=${fmtTokens(seed.totalTokens.cacheRead)}

## Recent user instructions (last 5)
${recentUserMsgs.length ? recentUserMsgs.map((m, i) => `${i + 1}. ${m}`).join("\n") : "(none)"}

## Recent assistant responses (last 3)
${recentAssistant.length ? recentAssistant.map((m, i) => `${i + 1}. ${m}`).join("\n") : "(none)"}

## Recent shell commands (last ${recentBash.length})
${recentBash.length ? recentBash.map((c) => `- \`${c}\``).join("\n") : "(none)"}

## Files touched
${filesList.length ? filesList.map((f) => `- \`${f}\``).join("\n") : "(none)"}

## Next step
Continue from the last user instruction. If unclear, ask the user to clarify before proceeding.
`;

  return recap;
}
