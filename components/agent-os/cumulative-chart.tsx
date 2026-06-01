"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";

interface HistoryResp {
  days: number;
  projects: string[];
  series: Array<Record<string, number | string>>;
  p95Daily: number;
  grand: {
    input: number;
    output: number;
    cache_create: number;
    cache_read: number;
    events: number;
  };
}

const COLORS = [
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#0ea5e9",
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

export function CumulativeChart() {
  const [data, setData] = useState<HistoryResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch("/api/agent-os/tokens/history?days=7", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = (await r.json()) as HistoryResp;
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

  const topProjects = useMemo(() => {
    if (!data) return [] as string[];
    const totals = new Map<string, number>();
    for (const point of data.series) {
      for (const p of data.projects) {
        const v = point[p];
        if (typeof v === "number") {
          totals.set(p, (totals.get(p) ?? 0) + v);
        }
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([p]) => p);
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
          7-day token consumption
          {data && (
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">
              {formatTokens(
                data.grand.input +
                  data.grand.output +
                  data.grand.cache_create
              )}{" "}
              effective · {data.grand.events.toLocaleString()} events
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !data || data.series.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Not enough history yet.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.series}
                margin={{ top: 4, right: 12, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(127,127,127,0.18)"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  stroke="rgba(127,127,127,0.5)"
                />
                <YAxis
                  tickFormatter={(v) => formatTokens(v as number)}
                  tick={{ fontSize: 10 }}
                  stroke="rgba(127,127,127,0.5)"
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid rgba(127,127,127,0.3)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v) => formatTokens(v as number)}
                />
                {topProjects.map((p, i) => (
                  <Area
                    key={p}
                    type="monotone"
                    dataKey={p}
                    stackId="1"
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.5}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {data && data.p95Daily > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            7-day p95 daily: {formatTokens(data.p95Daily)} tokens. Adjust the
            burndown cap estimate based on this.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
