"use client";

import { useState } from "react";
import { DeveloperFindingsTable } from "./DeveloperFindingsTable";
import { DeveloperDetailsDrawer } from "./DeveloperDetailsDrawer";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { developerPresets } from "@/config/chatPresets";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
import { mockFindings } from "@/data/mockFindings";
import type { Finding } from "@/types/finding";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";
import { useScanResultsState } from "@/app/cedar-os/scanState";
import { transformVulnerabilityFindings } from "@/lib/transformFindings";

interface DeveloperViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const DeveloperView = ({ selectedFindings, onSelectionChange }: DeveloperViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Get actual scan results from Cedar state
  const { scanResults } = useScanResultsState();

  // Transform scanner results to Finding type for display
  const actualFindings: Finding[] = scanResults?.findings
    ? transformVulnerabilityFindings(scanResults.findings)
    : mockFindings;

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(actualFindings);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Developer Dashboard"
        description="Fast-track vulnerabilities to safe PRs with staged remediation plans"
      />

      <ChatPresets presets={developerPresets} />

      <DeveloperFindingsTable
        findings={findings}
        onSelectFinding={setSelectedFinding}
        selectedFindings={selectedFindings}
        onSelectionChange={onSelectionChange}
      />

      <DeveloperDetailsDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
};
