"use client";

import { useState, useMemo, useEffect } from "react";
import { DeveloperFindingsTable } from "./DeveloperFindingsTable";
import { DeveloperDetailsDrawer } from "./DeveloperDetailsDrawer";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { developerPresets } from "@/config/chatPresets";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
import { mockFindings } from "@/data/mockFindings";
import type { Finding } from "@/types/finding";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";
import { scannerApi } from "@/lib/scannerApi";

interface DeveloperViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const DeveloperView = ({ selectedFindings, onSelectionChange }: DeveloperViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanFindings, setScanFindings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch recent scans on mount
  useEffect(() => {
    const fetchScans = async () => {
      try {
        const response = await scannerApi.listScans(10, 0);
        setScans(response.scans);

        // Auto-select the most recent completed scan
        const mostRecent = response.scans.find(s => s.status === 'completed');
        if (mostRecent) {
          setSelectedScanId(mostRecent.scan_id);
        }
      } catch (error) {
        console.error('Error fetching scans:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScans();
  }, []);

  // Fetch findings when selected scan changes
  useEffect(() => {
    if (!selectedScanId) return;

    const fetchFindings = async () => {
      try {
        const response = await scannerApi.getFindings(selectedScanId);
        setScanFindings(response.findings || []);
      } catch (error) {
        console.error('Error fetching findings:', error);
        setScanFindings([]);
      }
    };

    fetchFindings();
  }, [selectedScanId]);

  // Transform scanner findings to Finding type for display
  const actualFindings: Finding[] = useMemo(() => {
    if (!scanFindings || scanFindings.length === 0) return mockFindings;

    return scanFindings.map((f: any) => ({
      id: f.id || `${f.endpoint}-${f.rule}`,
      title: f.title,
      severity: f.severity as 'Critical' | 'High' | 'Medium' | 'Low',
      endpoint: f.endpoint,
      method: f.method,
      description: f.description,
      recommendation: f.recommendation || 'No recommendation available',
      impact: f.impact || f.description,
      scanner: f.scanner || 'unknown',
      evidence: f.evidence || {},
    }));
  }, [scanFindings]);

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(actualFindings);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Developer Dashboard"
        description="Fast-track vulnerabilities to safe PRs with staged remediation plans"
      />

      {/* Scan Selector */}
      {scans.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <label htmlFor="scan-select" className="block text-sm font-medium text-foreground mb-2">
            Select Scan
          </label>
          <select
            id="scan-select"
            value={selectedScanId || ''}
            onChange={(e) => setSelectedScanId(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {scans.map((scan) => (
              <option key={scan.scan_id} value={scan.scan_id}>
                {new Date(scan.created_at).toLocaleString()} - {scan.server_url} ({scan.status}) - {scan.findings_count} findings
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading scans...
        </div>
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
