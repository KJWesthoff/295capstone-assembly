"use client";

import { useState } from "react";
import { DeveloperFindingsTable } from "./DeveloperFindingsTable";
import { DeveloperDetailsDrawer } from "./DeveloperDetailsDrawer";
import { ChatPresets } from "./ChatPresets";
import { mockFindings } from "@/data/mockFindings";
import type { Finding } from "@/types/finding";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";

interface DeveloperViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const DeveloperView = ({ selectedFindings, onSelectionChange }: DeveloperViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(mockFindings);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-foreground">Developer Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Fast-track vulnerabilities to safe PRs with staged remediation plans
          </p>
        </div>
      </div>

      <ChatPresets />

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
