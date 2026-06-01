"use client";

import { Crosshair, Thermometer, ExternalLink, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Position {
  id: number;
  timestamp: string;
  marketId: string | null;
  marketQuestion: string | null;
  side: string;
  amount: number;
  price: number | null;
  estimatedProb: number | null;
  edge: number | null;
  sharesReceived: number | null;
  maxPayout: number | null;
}

function parseCity(question: string | null) {
  if (!question) return null;
  const match = question.match(/temperature in (\w[\w\s]*?) (?:be|on)/i);
  return match ? match[1].trim() : null;
}

function parseBucket(question: string | null): { value: number; unit: string } | null {
  if (!question) return null;
  const match = question.match(/(\d+)\s*°?\s*([CF])/i);
  if (!match) return null;
  return { value: parseInt(match[1]), unit: match[2].toUpperCase() === "F" ? "°F" : "°C" };
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function OpenPositions({ positions }: { positions: Position[] }) {
  if (!positions.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No open positions</p>
        </CardContent>
      </Card>
    );
  }

  const totalInvested = positions.reduce((s, p) => s + p.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          Open Positions
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {positions.length} position{positions.length !== 1 ? "s" : ""} &middot; ${totalInvested.toFixed(2)} deployed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {positions.map((pos) => {
            const city = parseCity(pos.marketQuestion);
            const bucket = parseBucket(pos.marketQuestion);
            const maxPayout = pos.maxPayout ?? (pos.sharesReceived ? pos.sharesReceived / 1e6 : null);
            const roi = maxPayout && pos.amount > 0 ? ((maxPayout - pos.amount) / pos.amount * 100) : null;

            return (
              <div
                key={pos.id}
                className="p-4 rounded-xl border border-border hover:border-primary/20 hover:bg-accent/30 transition-colors"
              >
                {/* City header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {city && (
                      <Badge variant="outline" className="text-[10px] h-5 border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5">
                        <Thermometer className="h-2.5 w-2.5 mr-0.5" />
                        {city}
                      </Badge>
                    )}
                    {bucket && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        {bucket.value}{bucket.unit}
                      </Badge>
                    )}
                    <Badge
                      variant={pos.side.includes("NO") ? "destructive" : "default"}
                      className="text-[10px] h-5"
                    >
                      {pos.side}
                    </Badge>
                  </div>
                </div>

                {/* Market question */}
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-snug">
                  {pos.marketQuestion || "Unknown Market"}
                </p>

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invested</span>
                    <span className="font-medium">${pos.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entry</span>
                    <span className="font-medium">{pos.price ? `${(pos.price * 100).toFixed(0)}%` : "—"}</span>
                  </div>
                  {pos.edge && pos.edge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Edge</span>
                      <span className="font-medium text-emerald-500">{(pos.edge * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {maxPayout && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payout</span>
                      <span className="font-medium">${maxPayout.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* ROI bar */}
                {roi !== null && roi > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-2.5 w-2.5" />
                        Potential ROI
                      </span>
                      <span className="font-medium text-emerald-500">+{roi.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(roi, 300) / 3}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer: time + link */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">{formatTime(pos.timestamp)}</span>
                  {pos.marketId && (
                    <a
                      href={`https://polymarket.com/event/${pos.marketId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Polymarket
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
