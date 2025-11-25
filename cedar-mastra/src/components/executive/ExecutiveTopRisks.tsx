"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCircle, Calendar, Shield, Globe } from "lucide-react";
import { cedar, cedarPayloadShapes } from "@/lib/cedar/actions";
import { getSeverityColor, Severity } from "@/lib/utils/severity";
import { useFindingActions } from "@/lib/cedar/useFindingActions";

interface TopRisk {
  id: string;
  title: string;
  systems: string[];
  severity: string;
  exploitPresent: boolean;
  internetFacing: boolean;
  isNewOrRegressed: string;
  recommendedAction: string;
  owner: string;
  eta: string;
  relatedBreachIds: string[];
}

interface ExecutiveTopRisksProps {
  risks: TopRisk[];
  onAddToReport?: (label: string, payload: any) => void;
}

export const ExecutiveTopRisks = ({ risks, onAddToReport }: ExecutiveTopRisksProps) => {
  const { addCustomToChat } = useFindingActions();

  const handleAddToChat = (risk: TopRisk) => {
    const payload = cedarPayloadShapes.execTopRisk(risk);
    const label = `Risk: ${risk.title.substring(0, 50)}...`;

    addCustomToChat(`risk-${risk.id}`, payload, label, risk.severity);
  };

  const handleAddTop3ToChat = () => {
    const top3 = risks.slice(0, 3);

    top3.forEach(risk => {
      const payload = cedarPayloadShapes.execTopRisk(risk);
      const label = `Risk: ${risk.title.substring(0, 50)}...`;

      addCustomToChat(`risk-${risk.id}`, payload, label, risk.severity);
    });
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Top 5 Business Risks</h3>
        <Button size="sm" variant="outline" onClick={handleAddTop3ToChat}>
          <Plus className="h-3 w-3 mr-1" />
          Add top 3 to Chat
        </Button>
      </div>

      <div className="space-y-4">
        {risks.map((risk, index) => (
          <Card key={risk.id} className="p-4 bg-muted/20 border-border hover:bg-muted/30 transition-colors">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl font-bold text-primary">#{index + 1}</span>
                    <h4 className="text-sm font-semibold text-foreground line-clamp-2">
                      {risk.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge className={getSeverityColor(risk.severity as Severity)}>
                      {risk.severity}
                    </Badge>
                    {risk.exploitPresent && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Public exploit
                      </Badge>
                    )}
                    {risk.internetFacing && (
                      <Badge variant="outline" className="flex items-center gap-1 border-primary text-primary">
                        <Globe className="h-3 w-3" />
                        Internet-facing
                      </Badge>
                    )}
                    {risk.isNewOrRegressed !== "-" && (
                      <Badge variant="outline" className="border-destructive/60 text-destructive font-semibold">
                        {risk.isNewOrRegressed}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[80px]">Systems:</span>
                  <span>{risk.systems.join(", ")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[80px]">Action:</span>
                  <span>{risk.recommendedAction}</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <UserCircle className="h-4 w-4" />
                    <span className="font-medium">{risk.owner}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>ETA: {formatDate(risk.eta)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cedar.workflow.assignOwner({ id: risk.id, owner: risk.owner })}
                >
                  Assign owner
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cedar.workflow.setDue({ id: risk.id, eta: risk.eta })}
                >
                  Set due date
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddToChat(risk)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add to Chat
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};
