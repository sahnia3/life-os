import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface JarvisLogEntry {
  id: string;
  text: string;
  createdAt: number;
}

interface JarvisState {
  mode: "idle" | "listening" | "executing";
  lastCommand: string | null;
  log: JarvisLogEntry[];
}

const state: JarvisState = {
  mode: "idle",
  lastCommand: null,
  log: [],
};

export async function GET() {
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { command?: string };
  const command = body.command?.trim();
  if (!command) {
    return NextResponse.json({ error: "command is required" }, { status: 400 });
  }

  state.mode = "executing";
  state.lastCommand = command;
  state.log = [
    { id: Date.now().toString(), text: command, createdAt: Date.now() },
    ...state.log,
  ].slice(0, 50);
  state.mode = "idle";

  return NextResponse.json(state);
}
