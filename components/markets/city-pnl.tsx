"use client";

import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CityPnl as CityPnlData } from "@/lib/hooks/use-pipeline";

export function CityPnl({ data }: { data: CityPnlData[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" />
            City P&L
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No city data yet</p>
        </CardContent>
      </Card>
    );
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-amber-500" />
          City P&L
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {data.length} cities
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((city) => {
          const pct = (Math.abs(city.pnl) / maxAbs) * 100;
          const positive = city.pnl >= 0;
          return (
            <div key={city.city}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium">{city.city}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {city.wins}/{city.trades} W
                  </span>
                  <span className={`font-medium ${positive ? "text-emerald-500" : "text-destructive"}`}>
                    {positive ? "+" : ""}${city.pnl.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${positive ? "bg-emerald-500" : "bg-destructive"}`}
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
