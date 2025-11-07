// Scan Results State Management for Cedar
// Manages vulnerability findings and makes them accessible to the AI agent

import { useCedarState, useRegisterState } from 'cedar-os';

export interface VulnerabilityFinding {
  id: string;
  rule: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  score: number;
  endpoint: string;
  method: string;
  description: string;
  scanner: string;
  scanner_description: string;
  evidence?: Record<string, any>;
}

export interface ScanResultsState {
  scanId: string;
  findings: VulnerabilityFinding[];
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
  groupedByEndpoint: Record<string, VulnerabilityFinding[]>;
}

/**
 * Hook to manage scan results state in Cedar
 * Similar to useRoadmapState but for security vulnerabilities
 */
export function useScanResultsState() {
  // Load initial value from localStorage if available
  const getInitialValue = (): ScanResultsState | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('scanResults');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const [scanResults, setScanResults] = useCedarState<ScanResultsState | null>({
    stateKey: 'scanResults',
    initialValue: getInitialValue(),
    description: 'API security scan results with vulnerability findings',
  });

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
            // Fetch from your existing scanner API
            const response = await fetch(`http://localhost:8000/api/scan/${scanId}/findings`);
            const data = await response.json();
            
            // Transform to our state format
            const findings: VulnerabilityFinding[] = data.findings.map((f: any) => ({
              id: f.id || `${f.endpoint}-${f.rule}`,
              rule: f.rule,
              title: f.title,
              severity: f.severity,
              score: f.score,
              endpoint: f.endpoint,
              method: f.method,
              description: f.description,
              scanner: f.scanner || 'unknown',
              scanner_description: f.scanner_description || '',
              evidence: f.evidence || {},
            }));

            // Group by endpoint
            const groupedByEndpoint: Record<string, VulnerabilityFinding[]> = {};
            findings.forEach(finding => {
              const key = `${finding.method} ${finding.endpoint}`;
              if (!groupedByEndpoint[key]) {
                groupedByEndpoint[key] = [];
              }
              groupedByEndpoint[key].push(finding);
            });

            // Calculate summary
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

          // Update with filtered results
          const groupedByEndpoint: Record<string, VulnerabilityFinding[]> = {};
          filtered.forEach(finding => {
            const key = `${finding.method} ${finding.endpoint}`;
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
  const setScanResultsWithPersistence = (newState: ScanResultsState | null) => {
    setScanResults(newState);
    if (typeof window !== 'undefined') {
      if (newState) {
        localStorage.setItem('scanResults', JSON.stringify(newState));
      } else {
        localStorage.removeItem('scanResults');
      }
    }
  };

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
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-gray-900',
    low: 'bg-blue-500 text-white',
  };
  return colors[severity.toLowerCase() as keyof typeof colors] || 'bg-gray-500 text-white';
}

/**
 * Helper function to format finding for display
 */
export function formatFindingForChat(finding: VulnerabilityFinding): string {
  return `🔴 **${finding.severity}**: ${finding.title}
- **Endpoint**: ${finding.method} ${finding.endpoint}
- **Scanner**: ${finding.scanner}
- **Description**: ${finding.description}`;
}





