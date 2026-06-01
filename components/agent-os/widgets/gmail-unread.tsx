"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Settings } from "lucide-react";

interface GmailResponse {
  configured: boolean;
  unread?: number;
  recent?: Array<{ from: string; subject: string; ts: number }>;
  error?: string;
  setupHint?: string;
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

export function GmailUnreadWidget() {
  const [data, setData] = useState<GmailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/widgets/gmail", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as GmailResponse;
        if (mounted) setData(j);
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
          <Mail className="h-3.5 w-3.5 text-rose-500" />
          Gmail
          {data && data.configured && data.unread !== undefined && (
            <span className="ml-auto rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-500">
              {data.unread} unread
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !data || !data.configured ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Settings className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>Not configured yet.</p>
            </div>
            <p className="text-[11px] leading-snug">
              Set <code className="font-mono">GMAIL_APP_PASSWORD</code> and{" "}
              <code className="font-mono">GMAIL_USER</code> in{" "}
              <code className="font-mono">.env.local</code> to enable. Uses IMAP
              via app password (less setup than OAuth).
            </p>
          </div>
        ) : data.error ? (
          <p className="text-xs text-rose-500">{data.error}</p>
        ) : (
          <ul className="space-y-1">
            {data.recent?.slice(0, 3).map((m, i) => (
              <li key={i} className="text-xs">
                <p className="truncate font-medium">{m.subject}</p>
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="truncate">{m.from}</span>
                  <span>·</span>
                  <span>{fmtAgo(m.ts)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
