import type { ParsedJsonlLine } from "./types";

function truncate(s: string, n: number): string {
  s = s.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object") {
      const b = block as { type?: string; text?: string };
      if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
    }
  }
  return parts.join(" ");
}

function findToolUse(content: unknown): { name: string; input: unknown } | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === "object") {
      const b = block as { type?: string; name?: string; input?: unknown };
      if (b.type === "tool_use" && typeof b.name === "string") {
        return { name: b.name, input: b.input };
      }
    }
  }
  return null;
}

function describeToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return name;
  const i = input as Record<string, unknown>;
  switch (name) {
    case "Bash":
      return typeof i.command === "string" ? truncate(i.command, 80) : name;
    case "Edit":
    case "Write":
    case "Read":
    case "NotebookEdit":
      if (typeof i.file_path === "string") {
        const short = i.file_path.replace(/^.*\//, "");
        return `${name}: ${short}`;
      }
      return name;
    case "Glob":
      return typeof i.pattern === "string" ? `Glob: ${truncate(i.pattern, 60)}` : name;
    case "Grep":
      return typeof i.pattern === "string" ? `Grep: ${truncate(i.pattern, 60)}` : name;
    case "WebFetch":
      return typeof i.url === "string" ? `Fetch: ${truncate(i.url, 60)}` : name;
    case "TodoWrite":
      return "TodoWrite";
    case "Task": {
      const desc = typeof i.description === "string" ? i.description : "agent";
      return `Task: ${truncate(desc, 60)}`;
    }
    default:
      return name;
  }
}

export function parseJsonlLine(raw: string): ParsedJsonlLine | null {
  raw = raw.trim();
  if (!raw) return null;

  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const sessionId = (evt.sessionId as string | undefined) ?? (evt.session_id as string | undefined) ?? null;
  const cwd = (evt.cwd as string | undefined) ?? null;

  const tsRaw =
    (evt.timestamp as string | number | undefined) ??
    (evt.ts as string | number | undefined) ??
    null;
  let ts = Date.now();
  if (tsRaw != null) {
    if (typeof tsRaw === "number") ts = tsRaw;
    else {
      const parsed = Date.parse(String(tsRaw));
      if (!isNaN(parsed)) ts = parsed;
    }
  }

  const type = (evt.type as string | undefined) ?? "";

  if (type === "user") {
    const msg = evt.message as { content?: unknown } | undefined;
    let text = "";
    if (typeof msg?.content === "string") text = msg.content;
    else text = extractTextFromContent(msg?.content);
    return {
      ts,
      kind: "user",
      summary: text ? truncate(text, 100) : "(user message)",
      toolName: null,
      tokens: null,
      model: null,
      sessionId,
      cwd,
    };
  }

  if (type === "assistant") {
    const msg = evt.message as
      | {
          content?: unknown;
          model?: string;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
        }
      | undefined;

    const tool = findToolUse(msg?.content);
    const text = extractTextFromContent(msg?.content);

    let kind: ParsedJsonlLine["kind"] = "assistant";
    let summary = "(assistant)";
    let toolName: string | null = null;
    if (tool) {
      kind = "tool_use";
      toolName = tool.name;
      summary = describeToolInput(tool.name, tool.input);
    } else if (text) {
      summary = truncate(text, 100);
    }

    let tokens: ParsedJsonlLine["tokens"] = null;
    if (msg?.usage) {
      tokens = {
        input: msg.usage.input_tokens ?? 0,
        output: msg.usage.output_tokens ?? 0,
        cacheCreate: msg.usage.cache_creation_input_tokens ?? 0,
        cacheRead: msg.usage.cache_read_input_tokens ?? 0,
      };
    }

    return {
      ts,
      kind,
      summary,
      toolName,
      tokens,
      model: msg?.model ?? null,
      sessionId,
      cwd,
    };
  }

  if (type === "tool_result" || type === "system" || type === "summary") {
    return {
      ts,
      kind: type as ParsedJsonlLine["kind"],
      summary: "",
      toolName: null,
      tokens: null,
      model: null,
      sessionId,
      cwd,
    };
  }

  return null;
}
