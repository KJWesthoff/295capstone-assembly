"use client";

import { useState, useMemo } from "react";
import { DeveloperFindingsTable } from "./DeveloperFindingsTable";
import { DeveloperDetailsDrawer } from "./DeveloperDetailsDrawer";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { developerPresets } from "@/config/chatPresets";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
import type { Finding } from "@/types/finding";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";
import { useScanManager } from "@/hooks/useScanManager";
import { ScanLauncher, ScanProgressTracker } from "@/components/scanner";
import { ScanSelector } from "@/components/shared/ScanSelector";
import { useScanResultsState } from "@/app/cedar-os/scanState";

interface DeveloperViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const DeveloperView = ({ selectedFindings, onSelectionChange }: DeveloperViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Get findings from Cedar state (populated by ScanSelector)
  const { scanResults } = useScanResultsState();

  // Use scan manager only for ScanLauncher
  const {
    isScanning,
    currentScanStatus,
    activeScanId,
    startScan,
  } = useScanManager();

  // Transform Cedar findings to Finding type for display
  const actualFindings: Finding[] = useMemo(() => {
    if (!scanResults?.findings || scanResults.findings.length === 0) return [];

    return scanResults.findings.map((f: any) => ({
      id: f.id || `${f.endpoint}-${f.rule}`,
      title: f.title,
      severity: f.severity as 'Critical' | 'High' | 'Medium' | 'Low',
      endpoint: {
        method: f.method || 'GET',
        path: f.endpoint || '/',
        service: f.scanner || 'unknown',
      },
      description: f.description,
      recommendation: f.recommendation || 'No recommendation available',
      impact: f.impact || f.description,
      scanner: f.scanner || 'unknown',
      evidence: f.evidence || {},
      // Add default values for missing fields
      cvss: f.score || 0,
      exploitSignal: 0,
      exploitPresent: false,
      owasp: f.rule || '',
      cwe: [],
      cve: [],
      scanners: [f.scanner || 'unknown'],
      status: 'New' as const,
      evidenceId: f.id || '',
      exposure: 0,
      recencyTrend: 0,
      blastRadius: 0,
      priorityScore: 0,
      firstSeen: f.created_at || new Date().toISOString(),
      lastSeen: f.created_at || new Date().toISOString(),
      owner: '',
      slaDue: '',
      flags: {
        isNew: true,
        isRegressed: false,
        isResolved: false,
      },
    }));
  }, [scanResults]);

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(actualFindings);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Developer Dashboard"
        description="Fast-track vulnerabilities to safe PRs with staged remediation plans"
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
