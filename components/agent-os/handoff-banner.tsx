"use client";

import { useState } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import type { SessionMeta } from "@/lib/agent-os/types";
import { cn } from "@/lib/utils";

export function HandoffBanner({ sessions }: { sessions: SessionMeta[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const filling = sessions.filter(
    (s) =>
      s.contextPct !== null &&
      s.contextPct >= 80 &&
      s.status !== "stale" &&
      !dismissed.has(s.sessionId)
  );

  if (filling.length === 0) return null;

  return (
    <div className="space-y-2">
      {filling.map((s) => (
        <div
          key={s.sessionId}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
          )}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              <span className="font-mono">{s.projectName}</span> context at{" "}
              {s.contextPct!.toFixed(0)}% — handoff ready
            </p>
            <p className="text-xs text-muted-foreground">
              Wrapper script will spawn a fresh session with primed context on
              graceful exit. Or preview manually below.
            </p>
          </div>
          <a
            href={`/agent-os/handoff/${s.sessionId}`}
            className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-500/30 dark:text-amber-300"
          >
            Preview
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() =>
              setDismissed((prev) => new Set(prev).add(s.sessionId))
            }
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
