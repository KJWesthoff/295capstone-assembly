"use client";

import React, { ReactNode } from "react";
import { Info, Filter, TrendingDown, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface SeverityTooltipProps {
  severity: string;
  children: ReactNode;
  onFilterBySeverity?: () => void;
  onExplainSeverity?: () => void;
  onShowRemediation?: () => void;
}

/**
 * Enhanced tooltip for severity badges that provides quick actions
 * Uses native Radix UI Tooltip (not TooltipMenuSpell as that's for text selection)
 */
export const SeverityTooltip: React.FC<SeverityTooltipProps> = ({
  severity,
  children,
  onFilterBySeverity,
  onExplainSeverity,
  onShowRemediation,
}) => {
  const getSeverityDescription = (sev: string): string => {
    switch (sev) {
      case "Critical":
        return "Immediate action required. Actively exploitable with severe impact.";
      case "High":
        return "High priority. Significant security risk that should be addressed quickly.";
      case "Medium":
        return "Moderate priority. Should be remediated in regular security updates.";
      case "Low":
        return "Low priority. Address when resources permit.";
      default:
        return "Security finding detected.";
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case "Critical":
      case "High":
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case "Medium":
        return <Info className="h-3 w-3 text-yellow-500" />;
      default:
        return <Info className="h-3 w-3 text-blue-500" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2">
              {getSeverityIcon(severity)}
              <h4 className="font-semibold text-sm">{severity} Severity</h4>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground">
              {getSeverityDescription(severity)}
            </p>

            {/* Quick actions */}
            <div className="flex gap-1.5 pt-1">
              {onExplainSeverity && (
                <button
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExplainSeverity();
                  }}
                >
                  <Info className="h-3 w-3" />
                  Why?
                </button>
              )}

              {onShowRemediation && (
                <button
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowRemediation();
                  }}
                >
                  <TrendingDown className="h-3 w-3" />
                  Fix It
                </button>
              )}

              {onFilterBySeverity && (
                <button
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFilterBySeverity();
                  }}
                >
                  <Filter className="h-3 w-3" />
                  Filter
                </button>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
