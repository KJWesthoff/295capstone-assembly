"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cedar, cedarPayloadShapes, cedarEstimateTokens } from "@/lib/cedar/actions";
import { useCedarActions } from "@/lib/cedar/hooks";

interface ExecutiveKPICardsProps {
  summary: {
    riskScore: number;
    critical: number;
    high: number;
    pastSlaPct: number;
    mttrMedian: number;
    mttrP95: number;
    publicExploitCount: number;
    internetFacingCount: number;
  };
  onAddToReport?: (label: string, payload: any) => void;
}

export const ExecutiveKPICards = ({ summary, onAddToReport }: ExecutiveKPICardsProps) => {
  const { addToContext } = useCedarActions();

  const handleAddToChat = () => {
    const payload = cedarPayloadShapes.execSummary(summary);
    const label = "Executive Summary KPIs";

    addToContext(
      "exec-kpi-summary",
      payload,
      label,
      "hsl(210 100% 19%)" // UC Berkeley Blue from brand colors
    );
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return "text-destructive";
    if (score >= 6) return "text-[hsl(var(--chart-1))]";
    if (score >= 4) return "text-[hsl(var(--chart-3))]";
    return "text-success";
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Overall Risk Score */}
        <Card className="p-6 bg-card border-border hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Overall Risk
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Info className="h-4 w-4 text-muted-foreground" /></span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Weighted score: 40% CVSS + 25% Exploitability (Exploit-DB) + 15% OWASP Weight + 10% Exposure + 5% Recency + 5% Blast Radius
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        <div className={`text-4xl font-bold ${getRiskColor(summary.riskScore)}`}>
          {summary.riskScore.toFixed(1)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Out of 10</p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 w-full"
          onClick={handleAddToChat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to Chat
        </Button>
      </Card>

      {/* Critical / High */}
      <Card className="p-6 bg-card border-border hover:shadow-md transition-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Critical / High
        </h3>
        <div className="text-4xl font-bold text-foreground">
          {summary.critical} <span className="text-2xl text-muted-foreground">/</span> {summary.high}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Active findings</p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 w-full"
          onClick={handleAddToChat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to Chat
        </Button>
      </Card>

      {/* % Past SLA */}
      <Card className="p-6 bg-card border-border hover:shadow-md transition-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          % Past SLA
        </h3>
        <div className="text-4xl font-bold text-destructive">
          {summary.pastSlaPct}%
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          MTTR {summary.mttrMedian}d (p95 {summary.mttrP95}d)
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 w-full"
          onClick={handleAddToChat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to Chat
        </Button>
      </Card>

      {/* Public Exploits */}
      <Card className="p-6 bg-card border-border hover:shadow-md transition-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Public Exploits
        </h3>
        <div className="text-4xl font-bold text-destructive">
          {summary.publicExploitCount}
        </div>
        <p className="text-xs text-muted-foreground mt-1">With POC available</p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 w-full"
          onClick={handleAddToChat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to Chat
        </Button>
      </Card>

      {/* Internet-Facing Affected */}
      <Card className="p-6 bg-card border-border hover:shadow-md transition-shadow">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Internet-Facing
        </h3>
        <div className="text-4xl font-bold text-[hsl(var(--chart-1))]">
          {summary.internetFacingCount}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Endpoints affected</p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 w-full"
          onClick={handleAddToChat}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add to Chat
        </Button>
      </Card>
      </div>
    </TooltipProvider>
  );
};
