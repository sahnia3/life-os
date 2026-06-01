import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  scheduleHint: string | null;
  disabled: boolean;
  body: string;
}

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

function extractScheduleHint(desc: string): string | null {
  const lower = desc.toLowerCase();
  if (lower.includes("fires at")) {
    const m = /fires at ([^—)]+?)(?:[—)]|$)/i.exec(desc);
    if (m) return m[1].trim();
  }
  if (/every (\d+)\s*(min|hour|day|week)/i.test(desc)) {
    return RegExp.lastMatch.trim();
  }
  return null;
}

export async function GET() {
  const dir = path.join(os.homedir(), ".claude", "scheduled-tasks");
  if (!fs.existsSync(dir)) return NextResponse.json({ tasks: [] });

  const tasks: ScheduledTask[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(dir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(skillPath, "utf8");
    } catch {
      continue;
    }
    const { fm, body } = parseFrontmatter(raw);
    const desc = fm.description ?? "";
    tasks.push({
      id: entry.name,
      name: fm.name ?? entry.name,
      description: desc,
      scheduleHint: extractScheduleHint(desc),
      disabled: /DO NOT RUN|permanently disabled|disabled/i.test(body),
      body: body.slice(0, 400),
    });
  }

  tasks.sort((a, b) => {
    if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ tasks });
}
