"use client";

import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { cedarEstimateTokens } from "@/lib/cedar/actions";

export interface ChatPreset {
  icon: LucideIcon;
  label: string;
  description: string;
  instruction?: string;  // Used by developer & executive
  prompt?: string;       // Used by analyst
}

export interface ChatPresetsProps {
  presets: ChatPreset[];
  title?: string;
  subtitle?: string;
  gridCols?: {
    base?: number;
    md?: number;
    lg?: number;
  };
  variant?: 'default' | 'compact' | 'card-wrapped';
  className?: string;
}

export const ChatPresets = ({
  presets,
  title = "Quick AI Actions",
  subtitle,
  gridCols = { base: 1, md: 2, lg: 6 },
  variant = 'default',
  className = ""
}: ChatPresetsProps) => {
  const { addItem } = useContextBasket();

  const handlePresetClick = (preset: ChatPreset) => {
    // Support both instruction and prompt fields for compatibility
    const payload = preset.instruction
      ? { instruction: preset.instruction }
      : { prompt: preset.prompt };

    const tokens = cedarEstimateTokens(payload);

    addItem({
      type: "report",
      label: preset.label,
      data: payload,
      tokens,
    });

    toast.success(`Added "${preset.label}" preset to Context Basket (≈${tokens} tokens)`);
  };

  // Build grid class using conditional logic (Tailwind requires full class names)
  const getGridClass = () => {
    const { base = 1, md = 2, lg = 6 } = gridCols;

    // Base columns
    let baseClass = 'grid-cols-1';
    if (base === 2) baseClass = 'grid-cols-2';

    // MD columns
    let mdClass = 'md:grid-cols-2';
    if (md === 1) mdClass = 'md:grid-cols-1';
    if (md === 3) mdClass = 'md:grid-cols-3';
    if (md === 4) mdClass = 'md:grid-cols-4';

    // LG columns
    let lgClass = 'lg:grid-cols-6';
    if (lg === 1) lgClass = 'lg:grid-cols-1';
    if (lg === 2) lgClass = 'lg:grid-cols-2';
    if (lg === 3) lgClass = 'lg:grid-cols-3';
    if (lg === 4) lgClass = 'lg:grid-cols-4';
    if (lg === 5) lgClass = 'lg:grid-cols-5';

    return `grid ${baseClass} ${mdClass} ${lgClass} gap-3`;
  };

  const content = (
    <>
      {(title || subtitle) && (
        <div className={variant === 'card-wrapped' ? "mb-3" : "mb-4"}>
          {title && (
            <h3 className={variant === 'card-wrapped'
              ? "text-sm font-semibold text-foreground uppercase tracking-wide"
              : "text-lg font-semibold text-foreground mb-1"
            }>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      <div className={getGridClass()}>
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <Card
              key={preset.label}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-border"
              onClick={() => handlePresetClick(preset)}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-primary/10 text-primary flex-shrink-0">
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
    </>
  );

  if (variant === 'card-wrapped') {
    return (
      <Card className={`p-6 bg-card border-border ${className}`}>
        {content}
      </Card>
    );
  }

  return <div className={`space-y-${variant === 'compact' ? '3' : '4'} ${className}`}>{content}</div>;
};
