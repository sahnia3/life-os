"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckCircle2 } from "lucide-react";

interface DailyLog {
  filename: string;
  title: string;
  mtimeMs: number;
  excerpt: string;
  compiled: boolean;
}

function fmtDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 86_400_000) return "today";
  if (diff < 2 * 86_400_000) return "yesterday";
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ObsidianLogsWidget() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/widgets/obsidian?limit=5", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { logs: DailyLog[] };
        if (mounted) setLogs(j.logs);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 5 * 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen className="h-3.5 w-3.5 text-violet-500" />
          Obsidian daily logs
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {logs.length} recent
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No daily logs found in vault.
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.filename}
                className="rounded-md border border-border/60 px-2 py-1.5 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-medium">
                    {log.title}
                  </span>
                  {log.compiled && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {fmtDate(log.mtimeMs)}
                  </span>
                </div>
                {log.excerpt && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                    {log.excerpt}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
