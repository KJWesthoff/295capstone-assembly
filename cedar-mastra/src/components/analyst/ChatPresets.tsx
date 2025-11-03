"use client";

import { MessageSquare, TrendingUp, Shield, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { cedarEstimateTokens } from "@/lib/cedar/actions";

const presets = [
  {
    icon: MessageSquare,
    label: "Validate Finding",
    description: "Summarize evidence and assess exploitability",
    prompt:
      "Validate the selected finding: summarize evidence and tell me if it's likely exploitable. If uncertain, list missing proof.",
  },
  {
    icon: TrendingUp,
    label: "Prioritize Queue",
    description: "Rank by exploitability × data sensitivity",
    prompt:
      "Prioritize the current queue by exploitability × data sensitivity; give me the top 10 with reasons.",
  },
  {
    icon: Shield,
    label: "Map to NIST",
    description: "Map findings to NIST CSF and 800-53",
    prompt:
      "Map these findings to NIST CSF and 800-53 families and propose policy guardrails.",
  },
  {
    icon: GitMerge,
    label: "Similar Cases",
    description: "Find historical fixes and solutions",
    prompt:
      "Show me similar historical findings we fixed and what worked (link prior tickets/PRs).",
  },
];

export const ChatPresets = () => {
  const { addItem } = useContextBasket();

  const handlePresetClick = (preset: typeof presets[0]) => {
    const payload = { prompt: preset.prompt };
    const tokenEstimate = cedarEstimateTokens(payload);
    addItem({
      type: "report",
      label: preset.label,
      data: payload,
      tokens: tokenEstimate,
    });
    toast.success(`Added "${preset.label}" preset to Context Basket`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-serif font-semibold text-foreground mb-1">
          Quick AI Actions
        </h3>
        <p className="text-sm text-muted-foreground">
          Pre-configured prompts for common security analyst workflows
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <Card
              key={preset.label}
              className="p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handlePresetClick(preset)}
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h4 className="font-semibold text-sm text-foreground">{preset.label}</h4>
              </div>
              <p className="text-xs text-muted-foreground">{preset.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
