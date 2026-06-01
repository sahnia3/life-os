"use client";

import { useState } from "react";
import { Camera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnapshotResult {
  ok: boolean;
  count: number;
  results: Array<{
    sessionId: string;
    projectName: string;
    ok: boolean;
    filepath?: string;
    error?: string;
  }>;
}

export function QuickActions() {
  const [snapshotting, setSnapshotting] = useState(false);
  const [lastResult, setLastResult] = useState<SnapshotResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function snapshotAll() {
    setSnapshotting(true);
    setError(null);
    try {
      const r = await fetch("/api/agent-os/snapshot-all", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setLastResult(j);
        setTimeout(() => setLastResult(null), 8000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "snapshot failed");
    } finally {
      setSnapshotting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={snapshotAll}
        disabled={snapshotting}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted",
          snapshotting && "opacity-50"
        )}
        title="Generate handoff recap for every active session"
      >
        {snapshotting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Camera className="h-3 w-3" />
        )}
        Snapshot all
      </button>

      {lastResult && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          {lastResult.count} snapshot{lastResult.count === 1 ? "" : "s"} saved
        </span>
      )}

      {error && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-500">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      )}
    </div>
  );
}
