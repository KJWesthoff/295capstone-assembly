// Scan Results State Management for Cedar
// Manages vulnerability findings and makes them accessible to the AI agent

import React from 'react';
import { useCedarState, useRegisterState } from 'cedar-os';
import type { Finding } from '@/types/finding';

// Legacy type alias for backwards compatibility with executive-kpi-calculator
// The Finding type from scanner-transform.ts is the source of truth
export type VulnerabilityFinding = Finding;

export interface ScanResultsState {
  scanId: string;
  findings: Finding[];
  scanDate: string;
  apiBaseUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  groupedByEndpoint: Record<string, Finding[]>;
}

/**
 * Hook to manage scan results state in Cedar
 * Similar to useRoadmapState but for security vulnerabilities
 */
export function useScanResultsState() {
  // Always start with null to prevent hydration mismatches
  // We'll load from localStorage after mount
  const [scanResults, setScanResults] = useCedarState<ScanResultsState | null>({
    stateKey: 'scanResults',
    initialValue: null, // Always null initially to prevent hydration errors
    description: 'API security scan results with vulnerability findings',
  });

  // Load from localStorage after mount (client-side only)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('scanResults');
      if (stored) {
        const parsed = JSON.parse(stored);
        setScanResults(parsed);
      }
    } catch (error) {
      console.error('Failed to load scan results from localStorage:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - setScanResults is stable from useCedarState

  // Register state with custom setters for AI agent to manipulate
  useRegisterState({
    value: scanResults,
    setValue: setScanResults,
    key: 'scanResults',
    description: 'Complete scan results including all vulnerability findings and metadata',
    stateSetters: {
      loadScanResults: {
        name: 'loadScanResults',
        description: 'Load scan results from the scanner service',
        execute: async (currentState, setValue, args: { scanId: string }) => {
          const { scanId } = args;

          try {
            const scannerUrl = process.env.NEXT_PUBLIC_SCANNER_SERVICE_URL ?? 'http://localhost:8000';
            const response = await fetch(`${scannerUrl}/api/scan/${scanId}/findings`);
            const data = await response.json();

            // API returns enriched Finding[] with OWASP/CWE/NIST from scanner-transform.ts
            const findings: Finding[] = data.findings || [];

            const groupedByEndpoint: Record<string, Finding[]> = {};
            findings.forEach(finding => {
              const key = `${finding.endpoint.method} ${finding.endpoint.path}`;
              if (!groupedByEndpoint[key]) {
                groupedByEndpoint[key] = [];
              }
              groupedByEndpoint[key].push(finding);
            });

            const summary = {
              total: findings.length,
              critical: findings.filter(f => f.severity === 'Critical').length,
              high: findings.filter(f => f.severity === 'High').length,
              medium: findings.filter(f => f.severity === 'Medium').length,
              low: findings.filter(f => f.severity === 'Low').length,
            };

            setValue({
              scanId,
              findings,
              scanDate: new Date().toISOString(),
              apiBaseUrl: data.api_base_url || 'Unknown',
              status: 'completed',
              summary,
              groupedByEndpoint,
            });
          } catch (error) {
            console.error('Failed to load scan results:', error);
            throw error;
          }
        },
      },

      filterBySeverity: {
        name: 'filterBySeverity',
        description: 'Filter findings by severity level',
        execute: (currentState, setValue, args: { severity: string }) => {
          const state = currentState as ScanResultsState;
          if (!state) return;

          const filtered = state.findings.filter(
            f => f.severity.toLowerCase() === args.severity.toLowerCase()
          );

          const groupedByEndpoint: Record<string, Finding[]> = {};
          filtered.forEach(finding => {
            const key = `${finding.endpoint.method} ${finding.endpoint.path}`;
            if (!groupedByEndpoint[key]) {
              groupedByEndpoint[key] = [];
            }
            groupedByEndpoint[key].push(finding);
          });

          setValue({
            ...state,
            findings: filtered,
            groupedByEndpoint,
            summary: {
              ...state.summary,
              total: filtered.length,
            },
          });
        },
      },

      addFindingNote: {
        name: 'addFindingNote',
        description: 'Add a note or comment to a specific finding',
        execute: (currentState, setValue, args: { findingId: string; note: string }) => {
          const state = currentState as ScanResultsState;
          if (!state) return;

          const updatedFindings = state.findings.map(finding => {
            if (finding.id === args.findingId) {
              return {
                ...finding,
                evidence: {
                  ...finding.evidence,
                  notes: [...(finding.evidence?.notes || []), args.note],
                },
              };
            }
            return finding;
          });

          setValue({
            ...state,
            findings: updatedFindings,
          });
        },
      },
    },
  });

  // Wrapper to persist to localStorage whenever scan results change
  const setScanResultsWithPersistence = React.useCallback((newState: ScanResultsState | null) => {
    setScanResults(newState);
    if (typeof window !== 'undefined') {
      if (newState) {
        localStorage.setItem('scanResults', JSON.stringify(newState));
      } else {
        localStorage.removeItem('scanResults');
      }
    }
  }, [setScanResults]);

  return {
    scanResults,
    setScanResults: setScanResultsWithPersistence,
  };
}

/**
 * Helper function to get severity color class
 */
export function getSeverityColor(severity: string): string {
  const colors = {
    critical: 'bg-critical text-white',
    high: 'bg-high text-white',
    medium: 'bg-medium text-foreground font-semibold',
    low: 'bg-low text-white',
  };
  return colors[severity.toLowerCase() as keyof typeof colors] || 'bg-gray-500 text-white';
}

/**
 * Helper function to format finding for display
 */
export function formatFindingForChat(finding: Finding): string {
  return `🔴 **${finding.severity}**: ${finding.summaryHumanReadable || finding.owasp}
- **Endpoint**: ${finding.endpoint.method} ${finding.endpoint.path}
- **Scanners**: ${finding.scanners.join(', ')}
- **OWASP**: ${finding.owasp}
- **CWE**: ${finding.cwe.join(', ')}`;
}





