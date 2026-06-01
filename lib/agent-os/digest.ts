import fs from "fs";
import readline from "readline";
import { parseJsonlLine } from "./jsonl-parser";
import { getDigest, setDigest, getAnchor } from "./db";
import type { ParsedJsonlLine } from "./types";

const TAIL_LINES = 60;
const STALE_AFTER_MS = 5 * 60 * 1000;

async function tail(filepath: string, max: number): Promise<ParsedJsonlLine[]> {
  if (!fs.existsSync(filepath)) return [];
  const events: ParsedJsonlLine[] = [];
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream });
    const buf: ParsedJsonlLine[] = [];
    rl.on("line", (line) => {
      const p = parseJsonlLine(line);
      if (!p) return;
      buf.push(p);
      if (buf.length > max) buf.shift();
    });
    rl.on("close", () => {
      events.push(...buf);
      resolve(events);
    });
    rl.on("error", reject);
  });
}

function buildTranscriptSnippet(events: ParsedJsonlLine[]): string {
  const lines: string[] = [];
  for (const e of events) {
    if (e.kind === "user") {
      lines.push(`USER: ${e.summary.slice(0, 200)}`);
    } else if (e.kind === "assistant") {
      lines.push(`ASSISTANT: ${e.summary.slice(0, 200)}`);
    } else if (e.kind === "tool_use" && e.toolName) {
      lines.push(`TOOL ${e.toolName}: ${e.summary.slice(0, 120)}`);
    }
  }
  return lines.slice(-30).join("\n");
}

function isMeaningful(s: string): boolean {
  // Skip generic fallback summaries from parser
  if (!s) return false;
  const t = s.trim();
  return t !== "(user message)" && t !== "(assistant)" && t !== "(no summary)" && t.length > 3;
}

function heuristicDigest(events: ParsedJsonlLine[]): string {
  // Fallback when no API key — pick the most recent meaningful assistant or
  // user content, and tally what tools were called.
  let lastUser = "";
  let lastAssistant = "";
  const toolCounts = new Map<string, number>();
  let totalTools = 0;
  for (const e of events) {
    if (e.kind === "user" && isMeaningful(e.summary)) lastUser = e.summary;
    else if (e.kind === "assistant" && isMeaningful(e.summary))
      lastAssistant = e.summary;
    else if (e.kind === "tool_use" && e.toolName) {
      toolCounts.set(e.toolName, (toolCounts.get(e.toolName) ?? 0) + 1);
      totalTools++;
    }
  }
  const topTools = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n, c]) => `${n}×${c}`)
    .join(", ");
  const toolSuffix = totalTools > 0 ? ` · ${totalTools} tool calls (${topTools})` : "";

  if (lastUser) {
    return `Last ask: ${lastUser.slice(0, 110)}${toolSuffix}`;
  }
  if (lastAssistant) {
    return `Last reply: ${lastAssistant.slice(0, 110)}${toolSuffix}`;
  }
  if (totalTools > 0) {
    return `Active: ${topTools}`;
  }
  return "Idle — no recent activity.";
}

export interface DigestResult {
  digest: string;
  goalAlignment: string | null;
  model: string | null;
  cached: boolean;
  generatedAt: number;
}

export async function getOrGenerateDigest(
  sessionId: string,
  jsonlPath: string,
  lastEventAt: number,
  forceRefresh = false
): Promise<DigestResult> {
  // Cache check
  const cached = getDigest(sessionId);
  if (!forceRefresh && cached) {
    const fresh = cached.lastEventAt >= lastEventAt;
    const recent = Date.now() - cached.generatedAt < STALE_AFTER_MS;
    if (fresh && recent) {
      return {
        digest: cached.digestText,
        goalAlignment: cached.goalAlignment,
        model: cached.model,
        cached: true,
        generatedAt: cached.generatedAt,
      };
    }
  }

  const events = await tail(jsonlPath, TAIL_LINES);
  const anchor = getAnchor(sessionId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const text = heuristicDigest(events);
    setDigest(sessionId, text, lastEventAt, null, null);
    return {
      digest: text,
      goalAlignment: null,
      model: null,
      cached: false,
      generatedAt: Date.now(),
    };
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const transcript = buildTranscriptSnippet(events);
    const goalLine = anchor?.text
      ? `\nUser's stated goal for this session: "${anchor.text}"\n\nAfter the summary line, on a new line starting with "ALIGNMENT:", say "on track" if the recent activity matches the goal, "drift" if it doesn't, "unclear" if you can't tell. One word only.`
      : "";

    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `Summarize what this Claude Code session has been doing in ONE sentence (≤25 words). Active voice, present tense. Skip filler. Output the sentence only, no preamble.${goalLine}\n\nRecent transcript:\n${transcript}`,
        },
      ],
    });

    let text = "";
    let alignment: string | null = null;
    for (const block of resp.content) {
      if (block.type === "text") text += block.text;
    }
    text = text.trim();

    const m = /\nALIGNMENT:\s*(on track|drift|unclear)/i.exec(text);
    if (m) {
      alignment = m[1].toLowerCase();
      text = text.replace(/\nALIGNMENT:.*$/i, "").trim();
    }

    setDigest(sessionId, text, lastEventAt, alignment, "claude-haiku-4-5");
    return {
      digest: text,
      goalAlignment: alignment,
      model: "claude-haiku-4-5",
      cached: false,
      generatedAt: Date.now(),
    };
  } catch {
    // Fallback to heuristic on API error
    const text = heuristicDigest(events);
    setDigest(sessionId, text, lastEventAt, null, "fallback");
    return {
      digest: text,
      goalAlignment: null,
      model: "fallback",
      cached: false,
      generatedAt: Date.now(),
    };
  }
}
