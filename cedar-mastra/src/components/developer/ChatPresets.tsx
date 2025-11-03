"use client";

import { Sparkles, Shield, FileCode, GitPullRequest, CheckCircle, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { cedarEstimateTokens } from "@/lib/cedar/actions";

const presets = [
  {
    icon: FileCode,
    label: "Generate Fix PR",
    description: "Minimal code diff + unit tests for selected finding",
    instruction: "Generate minimal, safe code diff + unit/integration tests + PR body referencing CVE/CWE/OWASP. Include 48h hot patch and guardrail rule.",
  },
  {
    icon: Shield,
    label: "Hot Patch Now",
    description: "48-hour mitigation + long-term fix",
    instruction: "Produce a 48-hour mitigation (gateway/header/rate limiting) with rollback steps; confirm non-breaking.",
  },
  {
    icon: Sparkles,
    label: "Write Tests",
    description: "Unit + integration tests",
    instruction: "Generate unit and integration tests that fail before and pass after the proposed fix, for the selected framework.",
  },
  {
    icon: BookOpen,
    label: "Explain for Junior",
    description: "Tutorial: why vulnerable, do/don't",
    instruction: "Explain the issue to a junior developer with two Do's and two Don'ts to prevent regressions.",
  },
  {
    icon: CheckCircle,
    label: "Create Policy Rule",
    description: "Lint/policy to block regressions",
    instruction: "Propose a lint/policy rule (ESLint/Flake8/Conftest/OPA) to prevent this class of issues; include a code example.",
  },
  {
    icon: GitPullRequest,
    label: "Deprecation Notice",
    description: "Client comms for API changes",
    instruction: "Draft a client-facing deprecation/change notice for this endpoint; include versioning strategy and migration steps.",
  },
];

export const ChatPresets = () => {
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Quick AI Actions (CedarOS)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
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
    </div>
  );
};
