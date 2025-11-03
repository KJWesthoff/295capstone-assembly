"use client";

import { useState } from "react";
import { DeveloperFindingsTable } from "./DeveloperFindingsTable";
import { DeveloperDetailsDrawer } from "./DeveloperDetailsDrawer";
import { ChatPresets } from "./ChatPresets";
import { mockFindings } from "@/data/mockFindings";
import type { Finding } from "@/types/finding";

export const DeveloperView = () => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

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
        findings={mockFindings}
        onSelectFinding={setSelectedFinding}
      />

      <DeveloperDetailsDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
};
