"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Preview {
  sessionId: string;
  cwd: string;
  projectName: string;
  recap: string;
}

export default function HandoffPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<{ filepath: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch(`/api/agent-os/handoff/${sessionId}/preview`, {
          cache: "no-store",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (mounted) setError(j.error ?? `HTTP ${r.status}`);
          return;
        }
        const j = (await r.json()) as Preview;
        if (mounted) setData(j);
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "load failed");
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  async function execute() {
    setExecuting(true);
    try {
      const r = await fetch(`/api/agent-os/handoff/${sessionId}/execute`, {
        method: "POST",
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? `HTTP ${r.status}`);
      } else {
        setExecuted({ filepath: j.filepath });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "execute failed");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
      <Link
        href="/agent-os"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Agent OS
      </Link>

      <header>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Session handoff
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate a recap file the wrapper script can read to spawn a fresh
          session with primed context.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" />
          <p>{error}</p>
        </div>
      )}

      {!data && !error && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Generating recap...
        </p>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="font-mono">{data.projectName}</span>
                <button
                  onClick={execute}
                  disabled={executing || !!executed}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                    executed
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-foreground text-background hover:opacity-90",
                    executing && "opacity-50"
                  )}
                >
                  {executing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : executed ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : null}
                  {executed
                    ? "Recap written"
                    : executing
                    ? "Writing..."
                    : "Write recap file"}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="font-mono text-muted-foreground">
                cwd: {data.cwd}
              </p>
              {executed && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs">
                  <p className="font-medium">
                    Recap written to{" "}
                    <code className="font-mono">{executed.filepath}</code>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    If the source terminal runs <code>claude-os</code> (Phase 4
                    wrapper), exit that session and the wrapper will spawn a
                    fresh one with this recap as system prompt. Otherwise{" "}
                    <code>cat</code> this file and paste into a new session.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recap preview</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed font-mono">
                {data.recap}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
