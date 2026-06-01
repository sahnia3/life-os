"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Snapshot {
  walletUsd: number | null;
  positions: number;
  lastCycleAt: number | null;
  lastCycleStatus: string | null;
  recentTrades: Array<{
    market: string;
    side: string;
    size: number;
    price: number;
    ts: number;
  }>;
  portfolioStale: boolean;
  portfolioMtimeMs: number | null;
  dbExists: boolean;
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

export function PolymarketWidget() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/widgets/polymarket", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as Snapshot;
        if (mounted) setData(j);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
          Polymarket bot
          {data?.portfolioStale && (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !data ? (
          <p className="text-xs text-muted-foreground">No data</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Wallet
                </p>
                <p className="font-mono text-sm font-semibold">
                  ${data.walletUsd?.toFixed(2) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Positions
                </p>
                <p className="font-mono text-sm font-semibold">
                  {data.positions}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Last cycle
                </p>
                <p
                  className={cn(
                    "font-mono text-xs font-semibold",
                    data.lastCycleStatus === "success" && "text-emerald-500",
                    data.lastCycleStatus === "failed" && "text-rose-500"
                  )}
                >
                  {data.lastCycleAt ? fmtAgo(data.lastCycleAt) : "—"}
                </p>
              </div>
            </div>

            {data.portfolioStale && (
              <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">
                Portfolio JSON is &gt;24h stale — values may not reflect live state.
              </p>
            )}

            {data.recentTrades.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Recent trades
                </p>
                <ul className="space-y-1 font-mono text-[11px]">
                  {data.recentTrades.slice(0, 3).map((t, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 truncate"
                    >
                      <span
                        className={cn(
                          "rounded px-1 text-[10px]",
                          t.side === "BUY"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        )}
                      >
                        {t.side}
                      </span>
                      <span className="flex-1 truncate text-foreground/80">
                        {t.market}
                      </span>
                      <span className="text-muted-foreground">
                        @{t.price.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
