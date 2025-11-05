"use client";

import { useState } from "react";
import { ExecutiveKPICards } from "./ExecutiveKPICards";
import { ExecutiveTrendChart } from "./ExecutiveTrendChart";
import { ExecutiveTopRisks } from "./ExecutiveTopRisks";
import { ExecutiveComplianceSnapshot } from "./ExecutiveComplianceSnapshot";
import { ExecutiveOwnershipTable } from "./ExecutiveOwnershipTable";
import { ExecutiveChatPresets } from "./ExecutiveChatPresets";
import { BoardBriefWizard } from "./BoardBriefWizard";
import { useExecutiveReportBridge } from "@/hooks/useExecutiveReportBridge";
import { useRegisterExecutiveData } from "@/lib/cedar/useRegisterExecutiveData";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import {
  mockExecSummary,
  mockExecTrend,
  mockExecTopRisks,
  mockExecCompliance,
  mockExecSlaOwners,
} from "@/data/mockExecutiveData";

export const ExecutiveView = () => {
  const [wizardOpen, setWizardOpen] = useState(false);

  // Register executive data with Cedar for @mention functionality
  const { risks, owners } = useRegisterExecutiveData(mockExecTopRisks, mockExecSlaOwners);

  const { addCardToReport, setReportMeta, reportItems, reportMeta } = useExecutiveReportBridge({
    kpis: mockExecSummary,
    topRiskCards: risks,
    complianceSnapshot: mockExecCompliance,
    ownershipRows: owners
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Risk & Compliance Overview</h2>
          <p className="text-muted-foreground mt-1">
            Current security posture, trends, and prioritized business risks
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="lg">
          <FileText className="h-4 w-4 mr-2" />
          Generate Board Brief
        </Button>
      </div>

      <ExecutiveKPICards summary={mockExecSummary} onAddToReport={addCardToReport} />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <ExecutiveTrendChart trend={mockExecTrend} />
        </div>
        <div className="col-span-5">
          <ExecutiveTrendChart trend={mockExecTrend} isSLA />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <ExecutiveTopRisks risks={risks} onAddToReport={addCardToReport} />
        </div>
        <div className="col-span-4">
          <ExecutiveComplianceSnapshot compliance={mockExecCompliance} onAddToReport={addCardToReport} />
        </div>
      </div>

      <ExecutiveOwnershipTable owners={owners} onAddToReport={addCardToReport} />

      <ExecutiveChatPresets />

      <BoardBriefWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        reportMeta={reportMeta}
        setReportMeta={setReportMeta}
        reportItems={reportItems}
      />
    </div>
  );
};
