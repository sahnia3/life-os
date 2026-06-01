import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DailyLog {
  filename: string;
  title: string;
  mtimeMs: number;
  excerpt: string;
  compiled: boolean;
}

const VAULT = path.join(os.homedir(), "Desktop", "obsidian", "my working");
const DAILY_LOGS = path.join(VAULT, "daily-logs");

function parseFrontmatter(raw: string): {
  fm: Record<string, string>;
  body: string;
} {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([^:]+):\s*(.*)$/.exec(line.trim());
    if (kv) fm[kv[1].trim()] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(20, parseInt(url.searchParams.get("limit") ?? "5", 10))
  );

  if (!fs.existsSync(DAILY_LOGS))
    return NextResponse.json({ logs: [], vaultMissing: true });

  const files = fs
    .readdirSync(DAILY_LOGS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const fp = path.join(DAILY_LOGS, f);
      const stat = fs.statSync(fp);
      return { f, fp, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);

  const logs: DailyLog[] = [];
  for (const { f, fp, mtimeMs } of files) {
    try {
      const raw = fs.readFileSync(fp, "utf8");
      const { fm, body } = parseFrontmatter(raw);
      const titleMatch = /^#\s+(.+)$/m.exec(body);
      const title = titleMatch ? titleMatch[1].trim() : f.replace(/\.md$/, "");
      const firstParagraph = body
        .replace(/^#\s+.+$/m, "")
        .trim()
        .split("\n\n")[0]
        ?.replace(/[#*_`]/g, "")
        .trim()
        .slice(0, 200) ?? "";
      logs.push({
        filename: f,
        title,
        mtimeMs,
        excerpt: firstParagraph,
        compiled: fm.compiled === "true",
      });
    } catch {
      // skip
    }
  }

  return NextResponse.json({ logs });
}
