"use client";

import { useState } from "react";
import { mockFindings } from "@/data/mockFindings";
import { Finding } from "@/types/finding";
import { FindingsTable } from "./FindingsTable";
import { FindingDetailsDrawer } from "./FindingDetailsDrawer";
import { DiffViewModal } from "./DiffViewModal";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { analystPresets } from "@/config/chatPresets";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";

interface SecurityAnalystViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const SecurityAnalystView = ({ selectedFindings, onSelectionChange }: SecurityAnalystViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(mockFindings);

  // Calculate diff counts from mock data
  const diffCounts = {
    new: mockFindings.filter(f => f.flags.isNew).length,
    regressed: mockFindings.filter(f => f.flags.isRegressed).length,
    resolved: mockFindings.filter(f => f.flags.isResolved).length,
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Deduped Findings"
        description="Prioritized by exploitability, CVSS, exposure, and recency. Click any row for full details."
        size="md"
      />

      <FindingsTable
        findings={mockFindings}
        onRowClick={setSelectedFinding}
        onOpenDiff={() => setShowDiffModal(true)}
        diffCounts={diffCounts}
        selectedFindings={selectedFindings}
        onSelectionChange={onSelectionChange}
      />

      <ChatPresets
        presets={analystPresets}
        title="Quick AI Actions"
        subtitle="Pre-configured prompts for common security analyst workflows"
        gridCols={{ base: 1, md: 2, lg: 4 }}
      />

      <FindingDetailsDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />

      <DiffViewModal
        open={showDiffModal}
        onOpenChange={setShowDiffModal}
        findings={mockFindings}
      />
    </div>
  );
};
