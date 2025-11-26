"use client";

import { useState } from "react";
import { Finding } from "@/types/finding";
import { FindingsTable } from "./FindingsTable";
import { FindingDetailsDrawer } from "./FindingDetailsDrawer";
import { DiffViewModal } from "./DiffViewModal";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { analystPresets } from "@/config/chatPresets";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";
import { useScanResultsState } from "@/app/cedar-os/scanState";
import { transformVulnerabilityFindings } from "@/lib/transformFindings";
import { useScanManager } from "@/hooks/useScanManager";
import { ScanLauncher, ScanProgressTracker } from "@/components/scanner";
import { ScanSelector } from "@/components/shared/ScanSelector";

interface SecurityAnalystViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const SecurityAnalystView = ({ selectedFindings, onSelectionChange }: SecurityAnalystViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Use scan manager only for ScanLauncher
  const {
    isScanning,
    currentScanStatus,
    activeScanId,
    startScan,
  } = useScanManager();

  // Get actual scan results from Cedar state
  const { scanResults } = useScanResultsState();

  // Transform scanner results to Finding type for display
  // If no scan results, show empty array (no mock data)
  const actualFindings: Finding[] = scanResults?.findings
    ? transformVulnerabilityFindings(scanResults.findings)
    : [];

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(actualFindings);

  // Calculate diff counts from actual findings
  const diffCounts = {
    new: findings.filter(f => f.flags?.isNew).length,
    regressed: findings.filter(f => f.flags?.isRegressed).length,
    resolved: findings.filter(f => f.flags?.isResolved).length,
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Deduped Findings"
        description="Prioritized by exploitability, CVSS, exposure, and recency. Click any row for full details."
        size="md"
      />

      {/* Scanner Controls */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <ScanSelector />
          </div>
          <ScanLauncher
            onStartScan={startScan}
            isScanning={isScanning}
            variant="secondary"
          />
        </div>
      </div>

      {/* Scan Progress Tracker */}
      {isScanning && currentScanStatus && (
        <ScanProgressTracker
          scanStatus={currentScanStatus}
          scanId={activeScanId ?? undefined}
        />
      )}

      <ChatPresets
        presets={analystPresets}
        title="Quick AI Actions"
        subtitle="Pre-configured prompts for common security analyst workflows"
        gridCols={{ base: 1, md: 2, lg: 4 }}
      />
      
      <FindingsTable
        findings={findings}
        onRowClick={setSelectedFinding}
        onOpenDiff={() => setShowDiffModal(true)}
        diffCounts={diffCounts}
        selectedFindings={selectedFindings}
        onSelectionChange={onSelectionChange}
      />

      <FindingDetailsDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />

      <DiffViewModal
        open={showDiffModal}
        onOpenChange={setShowDiffModal}
        findings={findings}
      />
    </div>
  );
};
