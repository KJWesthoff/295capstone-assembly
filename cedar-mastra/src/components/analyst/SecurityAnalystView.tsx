"use client";

import { useState } from "react";
import { mockFindings } from "@/data/mockFindings";
import { Finding } from "@/types/finding";
import { FindingsTable } from "./FindingsTable";
import { FindingDetailsDrawer } from "./FindingDetailsDrawer";
import { DiffViewModal } from "./DiffViewModal";
import { ChatPresets } from "./ChatPresets";

interface SecurityAnalystViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const SecurityAnalystView = ({ selectedFindings, onSelectionChange }: SecurityAnalystViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Calculate diff counts from mock data
  const diffCounts = {
    new: mockFindings.filter(f => f.flags.isNew).length,
    regressed: mockFindings.filter(f => f.flags.isRegressed).length,
    resolved: mockFindings.filter(f => f.flags.isResolved).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-semibold text-foreground mb-2">
          Deduped Findings
        </h2>
        <p className="text-sm text-muted-foreground">
          Prioritized by exploitability, CVSS, exposure, and recency. Click any row for full details.
        </p>
      </div>

      <FindingsTable
        findings={mockFindings}
        onRowClick={setSelectedFinding}
        onOpenDiff={() => setShowDiffModal(true)}
        diffCounts={diffCounts}
        selectedFindings={selectedFindings}
        onSelectionChange={onSelectionChange}
      />

      <ChatPresets />

      <FindingDetailsDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />

      <DiffViewModal
        open={showDiffModal}
        onOpenChange={setShowDiffModal}
        findings={mockFindings}
      />
    </div>
  );
};
