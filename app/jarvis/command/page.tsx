"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radar, Send, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

export default function JarvisCommandPage() {
  const [state, setState] = useState<JarvisState | null>(null);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/jarvis/state", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as JarvisState;
        if (mounted) setState(j);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  async function submitCommand() {
    const trimmed = command.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/jarvis/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });
      if (r.ok) {
        const j = (await r.json()) as JarvisState;
        setState(j);
        setCommand("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-bg flex items-center justify-center flex-shrink-0">
              <Radar style={{ height: "18px", width: "18px" }} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">JARVIS</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Command center
              </p>
            </div>
          </div>
          {state && (
            <Badge variant="outline" className="capitalize">
              {state.mode}
            </Badge>
          )}
        </div>

        {/* Command input */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Issue a command…"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCommand();
                }}
                disabled={sending}
              />
              <Button
                onClick={() => void submitCommand()}
                disabled={!command.trim() || sending}
                className="gap-1.5"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Log */}
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : !state || state.log.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-2xl gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Radar className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                No commands yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Issue a command to get started
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {state.log.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm font-mono">{entry.text}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
