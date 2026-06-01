"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { BrierPoint } from "@/lib/hooks/use-pipeline";

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { city: string; pnl: number; edgeClaimed: number; win: boolean; cumPnl: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-medium">{d.city}</p>
      <p className={d.pnl >= 0 ? "text-emerald-500" : "text-destructive"}>
        {d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}
      </p>
      <p className="text-muted-foreground">Edge: {(d.edgeClaimed * 100).toFixed(1)}%</p>
      <p className="text-muted-foreground">Cumulative: ${d.cumPnl.toFixed(2)}</p>
    </div>
  );
}

export function BrierTrend({ data }: { data: BrierPoint[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-500" />
            P&L Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No resolved trades yet</p>
        </CardContent>
      </Card>
    );
  }

  // Cumulative P&L computed functionally (no render-scope reassignment).
  // Accumulate raw pnl; round only for display.
  const chartData = data.map((d, i) => {
    const cumPnl = data.slice(0, i + 1).reduce((sum, p) => sum + p.pnl, 0);
    return {
      idx: i + 1,
      cumPnl: parseFloat(cumPnl.toFixed(2)),
      pnl: d.pnl,
      win: d.win,
      city: d.city,
      edgeClaimed: d.edgeClaimed,
    };
  });

  const finalPnl = chartData[chartData.length - 1]?.cumPnl ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-500" />
          P&L Trend
          <span className={`text-xs font-normal ml-auto ${finalPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {finalPnl >= 0 ? "+" : ""}${finalPnl.toFixed(2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={finalPnl >= 0 ? "var(--color-emerald-500, #10b981)" : "var(--color-destructive, #ef4444)"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={finalPnl >= 0 ? "var(--color-emerald-500, #10b981)" : "var(--color-destructive, #ef4444)"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="idx" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
              <ReferenceLine y={0} stroke="var(--color-border, #e5e7eb)" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke={finalPnl >= 0 ? "var(--color-emerald-500, #10b981)" : "var(--color-destructive, #ef4444)"}
                strokeWidth={2}
                fill="url(#pnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
