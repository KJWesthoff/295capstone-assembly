"use client";

import { useState } from "react";
import { ExecutiveKPICards } from "./ExecutiveKPICards";
import { ExecutiveTrendChart } from "./ExecutiveTrendChart";
import { ExecutiveTopRisks } from "./ExecutiveTopRisks";
import { ExecutiveComplianceSnapshot } from "./ExecutiveComplianceSnapshot";
import { ExecutiveOwnershipTable } from "./ExecutiveOwnershipTable";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { executivePresets } from "@/config/chatPresets";
import { BoardBriefWizard } from "./BoardBriefWizard";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
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
      <DashboardHeader
        title="Risk & Compliance Overview"
        description="Current security posture, trends, and prioritized business risks"
        action={
          <Button onClick={() => setWizardOpen(true)} size="lg">
            <FileText className="h-4 w-4 mr-2" />
            Generate Board Brief
          </Button>
        }
      />

      <ExecutiveKPICards summary={mockExecSummary} onAddToReport={addCardToReport} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ExecutiveTrendChart trend={mockExecTrend} />
        </div>
        <div className="lg:col-span-5">
          <ExecutiveTrendChart trend={mockExecTrend} isSLA />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ExecutiveTopRisks risks={risks} onAddToReport={addCardToReport} />
        </div>
        <div className="lg:col-span-4">
          <ExecutiveComplianceSnapshot compliance={mockExecCompliance} onAddToReport={addCardToReport} />
        </div>
      </div>

      <ExecutiveOwnershipTable owners={owners} onAddToReport={addCardToReport} />

      <ChatPresets
        presets={executivePresets}
        title="Quick AI Actions (Executive)"
        gridCols={{ base: 1, md: 2, lg: 4 }}
        variant="card-wrapped"
      />

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
