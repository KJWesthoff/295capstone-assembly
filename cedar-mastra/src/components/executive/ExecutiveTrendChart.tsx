"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { cedar, cedarPayloadShapes, cedarEstimateTokens } from "@/lib/cedar/actions";
import { toast } from "sonner";

interface ExecutiveTrendChartProps {
  trend: {
    window: string;
    deltaPct: number;
    points: number[];
  };
  isSLA?: boolean;
}

export const ExecutiveTrendChart = ({ trend, isSLA = false }: ExecutiveTrendChartProps) => {
  const { addItem } = useContextBasket();

  const handleAddToChat = () => {
    const payload = isSLA
      ? { pastSlaPct: 28, mttrMedian: 12, mttrP95: 45 }
      : cedarPayloadShapes.execTrend(trend);
    const tokens = cedarEstimateTokens(payload);
    addItem({
      type: "report",
      label: isSLA ? "SLA Health" : "Risk Trend",
      data: payload,
      tokens,
    });
    toast.success(`${isSLA ? "SLA data" : "Trend data"} added to Context Basket (≈${tokens} tokens)`);
  };

  if (isSLA) {
    return (
      <Card className="p-6 bg-card border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">SLA Health</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">On Track</span>
              <span className="text-sm font-semibold text-foreground">72%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success" style={{ width: "72%" }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Critical Past SLA</span>
              <span className="text-sm font-semibold text-destructive">1</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-destructive" style={{ width: "8%" }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">High Past SLA</span>
              <span className="text-sm font-semibold text-[hsl(var(--chart-1))]">3</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[hsl(var(--chart-1))]" style={{ width: "20%" }} />
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="mt-4 w-full"
          onClick={handleAddToChat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add SLA to Chat
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Risk Trend (30 days)</h3>
        <div className={`flex items-center gap-1 text-sm font-semibold ${trend.deltaPct < 0 ? "text-success" : "text-destructive"}`}>
          {trend.deltaPct < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          {Math.abs(trend.deltaPct)}%
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="relative h-24 mb-4">
        <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
          <polyline
            points={trend.points
              .map((val, i) => `${(i / (trend.points.length - 1)) * 100},${30 - (val / 10) * 30}`)
              .join(" ")}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          <polyline
            points={`0,30 ${trend.points
              .map((val, i) => `${(i / (trend.points.length - 1)) * 100},${30 - (val / 10) * 30}`)
              .join(" ")} 100,30`}
            fill="url(#gradient)"
            opacity="0.2"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
        <div>
          <div className="text-2xl font-bold text-foreground">{trend.points[0].toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">30d ago</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{trend.points[Math.floor(trend.points.length / 2)].toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">15d ago</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{trend.points[trend.points.length - 1].toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">Today</div>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="mt-4 w-full"
        onClick={handleAddToChat}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Trend to Chat
      </Button>
    </Card>
  );
};
