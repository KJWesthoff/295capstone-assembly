"use client";

import { Card } from "@/components/ui/card";
import { FileText, Target, Shield, AlertTriangle } from "lucide-react";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { cedarEstimateTokens } from "@/lib/cedar/actions";
import { toast } from "sonner";

const presets = [
  {
    icon: FileText,
    label: "Board update",
    description: "150-word executive summary with key risks and 2 actions",
    instruction: "Using execSummary, trend, top three risks, and compliance: write a 150-word board summary with two prioritized actions, owners, and dates. Keep it non-technical.",
  },
  {
    icon: Target,
    label: "2 actions this week",
    description: "Highest impact actions by exploitability & exposure",
    instruction: "If we can do only two things this week, which give the largest risk reduction and why? Tie to exploitability and exposure; include owners and ETAs.",
  },
  {
    icon: Shield,
    label: "NIST posture",
    description: "CSF status and shortest path to green",
    instruction: "Summarize our NIST CSF posture (Identify/Protect/Detect/Respond/Recover) and propose the shortest path to green.",
  },
  {
    icon: AlertTriangle,
    label: "Impact estimate",
    description: "Business impact if top risk is exploited",
    instruction: "Estimate business impact if the top risk is exploited. Use analogous breach cases when relevant.",
  },
];

export const ExecutiveChatPresets = () => {
  const { addItem } = useContextBasket();

  const handlePresetClick = (preset: typeof presets[0]) => {
    const tokens = cedarEstimateTokens({ instruction: preset.instruction });
    addItem({
      type: "report",
      label: preset.label,
      data: { instruction: preset.instruction },
      tokens,
    });
    toast.success(`Added "${preset.label}" preset to Context Basket (≈${tokens} tokens)`);
  };

  return (
    <Card className="p-6 bg-card border-border">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">Quick AI Actions (Executive)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <Card
              key={preset.label}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-border"
              onClick={() => handlePresetClick(preset)}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{preset.label}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
};
