"use client";

import { useState, useMemo } from "react";
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
  // Memoize to prevent infinite re-renders when scanResults reference changes but content is the same
  const actualFindings: Finding[] = useMemo(() => {
    if (!scanResults?.findings) return mockFindings;
    return transformVulnerabilityFindings(scanResults.findings);
  }, [scanResults?.scanId]); // ONLY depend on scanId, not the findings array

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
