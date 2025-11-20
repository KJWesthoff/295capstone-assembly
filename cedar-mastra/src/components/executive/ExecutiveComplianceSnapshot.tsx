"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { cedar, cedarPayloadShapes, cedarEstimateTokens } from "@/lib/cedar/actions";
import { useCedarActions } from "@/lib/cedar/hooks";

interface ExecutiveComplianceSnapshotProps {
  compliance: {
    owaspCounts: Record<string, number>;
    cweCounts: Record<string, number>;
    nistCsf: Record<string, number>;
    nist80053: Record<string, number>;
  };
  onAddToReport?: (label: string, payload: any) => void;
}

export const ExecutiveComplianceSnapshot = ({ compliance, onAddToReport }: ExecutiveComplianceSnapshotProps) => {
  const { addToContext } = useCedarActions();

  const handleAddToChat = () => {
    const payload = cedarPayloadShapes.execCompliance(compliance);
    const label = "Compliance Snapshot";

    addToContext(
      "exec-compliance",
      payload,
      label,
      "hsl(210 100% 19%)" // UC Berkeley Blue from brand colors
    );
  };

  const getHealthIndicator = (count: number) => {
    if (count === 0) return <CheckCircle className="h-4 w-4 text-success" />;
    if (count <= 3) return <AlertCircle className="h-4 w-4 text-[hsl(var(--chart-3))]" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getHealthColor = (count: number) => {
    if (count === 0) return "text-success";
    if (count <= 3) return "text-[hsl(var(--chart-3))]";
    return "text-destructive";
  };

  return (
    <Card className="p-6 bg-card border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Compliance Snapshot</h3>

      <div className="space-y-6">
        {/* OWASP Summary */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            OWASP API Top 10
            <Badge variant="outline" className="text-xs">
              {Object.values(compliance.owaspCounts).reduce((a, b) => a + b, 0)} findings
            </Badge>
          </h4>
          <div className="space-y-1">
            {Object.entries(compliance.owaspCounts).slice(0, 3).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate flex-1">{key.split("—")[0]}</span>
                <div className="flex items-center gap-1">
                  {getHealthIndicator(count)}
                  <span className={`font-semibold ${getHealthColor(count)}`}>{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CWE Summary */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            CWE Top 25
            <Badge variant="outline" className="text-xs">
              {Object.values(compliance.cweCounts).reduce((a, b) => a + b, 0)} findings
            </Badge>
          </h4>
          <div className="space-y-1">
            {Object.entries(compliance.cweCounts).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{key}</span>
                <div className="flex items-center gap-1">
                  {getHealthIndicator(count)}
                  <span className={`font-semibold ${getHealthColor(count)}`}>{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NIST CSF */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">NIST Cybersecurity Framework</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(compliance.nistCsf).map(([func, count]) => (
              <div key={func} className="flex items-center gap-2">
                {getHealthIndicator(count)}
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">{func}</div>
                  <div className={`text-xs font-semibold ${getHealthColor(count)}`}>{count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NIST 800-53 */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">NIST 800-53 Families</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(compliance.nist80053).map(([family, count]) => (
              <Badge key={family} variant="outline" className="text-xs">
                {family}: <span className={`ml-1 font-semibold ${getHealthColor(count)}`}>{count}</span>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="mt-6 w-full"
        onClick={handleAddToChat}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Compliance to Chat
      </Button>
    </Card>
  );
};
