import { describe, expect, it } from "vitest";
import { parseJsonlLine } from "./jsonl-parser";

describe("parseJsonlLine", () => {
  it("parses a valid user line without throwing", () => {
    const line = JSON.stringify({
      type: "user",
      sessionId: "abc-123",
      cwd: "/Users/foo/project",
      timestamp: "2026-01-01T00:00:00.000Z",
      message: { content: "hello there" },
    });

    const result = parseJsonlLine(line);

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("user");
    expect(result?.summary).toBe("hello there");
    expect(result?.sessionId).toBe("abc-123");
    expect(result?.cwd).toBe("/Users/foo/project");
  });

  it("parses a valid assistant line with a tool_use block without throwing", () => {
    const line = JSON.stringify({
      type: "assistant",
      sessionId: "abc-123",
      message: {
        model: "claude-sonnet-4-6",
        content: [{ type: "tool_use", name: "Bash", input: { command: "ls -la" } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    });

    const result = parseJsonlLine(line);

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("tool_use");
    expect(result?.toolName).toBe("Bash");
    expect(result?.model).toBe("claude-sonnet-4-6");
    expect(result?.tokens).toEqual({
      input: 10,
      output: 5,
      cacheCreate: 0,
      cacheRead: 0,
    });
  });

  it("returns null for an invalid/malformed JSON line", () => {
    expect(parseJsonlLine("{not valid json")).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(parseJsonlLine("   ")).toBeNull();
  });

  it("returns null for an unrecognized event type", () => {
    const line = JSON.stringify({ type: "unknown_type" });
    expect(parseJsonlLine(line)).toBeNull();
  });
});
