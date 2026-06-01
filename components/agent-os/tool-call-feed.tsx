"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionEvent } from "@/lib/agent-os/types";

interface FeedItem extends SessionEvent {
  projectName: string;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

function kindColor(kind: SessionEvent["kind"]): string {
  switch (kind) {
    case "tool_use":
      return "text-amber-500";
    case "assistant":
      return "text-emerald-500";
    case "user":
      return "text-sky-500";
    default:
      return "text-muted-foreground";
  }
}

export function ToolCallFeed({ items }: { items: FeedItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Radio className="h-3.5 w-3.5 text-emerald-500" />
          Live activity
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {items.length} events
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            Waiting for events. Open a Claude Code session in any terminal.
          </p>
        ) : (
          <ul className="space-y-1 font-mono text-[11px] max-h-[360px] overflow-y-auto">
            {items.map((it, i) => (
              <li
                key={`${it.sessionId}-${it.ts}-${i}`}
                className="grid grid-cols-[auto_auto_1fr] gap-2 items-baseline"
              >
                <span className="text-muted-foreground tabular-nums">
                  {fmtTime(it.ts)}
                </span>
                <span className="text-foreground/70 truncate max-w-[100px]">
                  [{it.projectName}]
                </span>
                <span className={cn("truncate", kindColor(it.kind))}>
                  {it.toolName ? `${it.toolName}: ` : ""}
                  {it.summary}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
