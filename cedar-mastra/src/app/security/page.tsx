'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScanResultsState, getSeverityColor, VulnerabilityFinding } from '@/app/cedar-os/scanState';
import { FloatingCedarChat } from '@/app/cedar-os/components/chatComponents/FloatingCedarChat';
import { useCedarStore } from 'cedar-os';
import { ScanConfigDialog, ScanConfig } from '@/components/security/ScanConfigDialog';
import { scannerApi, ScanStatus } from '@/lib/scannerApi';
import { useSecurityContext } from '@/app/cedar-os/context';

export default function SecurityDashboardPage() {
  const router = useRouter();
  const { scanResults, setScanResults } = useScanResultsState();
  const addContextEntry = useCedarStore(s => s.addContextEntry);

  // Subscribe scan results to agent context - only call once at component level
  useSecurityContext();

  const [showScanDialog, setShowScanDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [currentScanStatus, setCurrentScanStatus] = useState<ScanStatus | null>(null);

  // Severity filters
  const [severityFilters, setSeverityFilters] = useState<Set<string>>(new Set(['Critical', 'High', 'Medium', 'Low']));

  // Track which findings have been added to context
  const [addedFindings, setAddedFindings] = useState<Set<string>>(new Set());

  // Track if component has mounted (prevents hydration errors)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper functions for filtering
  const toggleSeverityFilter = (severity: string) => {
    const newFilters = new Set(severityFilters);
    if (newFilters.has(severity)) {
      newFilters.delete(severity);
    } else {
      newFilters.add(severity);
    }
    setSeverityFilters(newFilters);
  };

  const resetFilters = () => {
    setSeverityFilters(new Set(['Critical', 'High', 'Medium', 'Low']));
  };

  // Get filtered findings
  const getFilteredFindings = () => {
    if (!scanResults) return [];
    return scanResults.findings.filter(f => severityFilters.has(f.severity));
  };

  const filteredFindings = getFilteredFindings();

  // Poll scan status if there's an active scan
  useEffect(() => {
    if (!activeScanId || scanResults?.status === 'completed') return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await scannerApi.getScanStatus(activeScanId);

        // Debug: Log the chunk_status data
        if (status.chunk_status) {
          console.log('Chunk status data:', status.chunk_status.map((chunk: any) => ({
            id: chunk.chunk_id,
            progress: chunk.progress,
            status: chunk.status,
            scanner: chunk.scanner,
            endpoints_count: chunk.endpoints_count,
            total_endpoints: chunk.total_endpoints,
            scanned_endpoints: chunk.scanned_endpoints?.length
          })));
        }

        setCurrentScanStatus(status);

        if (status.status === 'completed') {
          // Load findings
          const findings = await scannerApi.getFindings(activeScanId);
          loadScanResults(activeScanId, findings.findings);
          setIsScanning(false);
          setCurrentScanStatus(null);
          clearInterval(pollInterval);

          // Navigate to role-specific dashboard after scan completes
          const userRole = localStorage.getItem('userRole') || 'dashboard';
          const routeMap: Record<string, string> = {
            'executive': '/executive',
            'security': '/dashboard',
            'developer': '/developer',
            'dashboard': '/dashboard' // fallback
          };
          router.push(routeMap[userRole] || '/dashboard');
        } else if (status.status === 'failed') {
          alert('Scan failed: ' + (status.error || 'Unknown error'));
          setIsScanning(false);
          setCurrentScanStatus(null);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling scan status:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [activeScanId, scanResults?.status]);

  const loadScanResults = (scanId: string, findings: any[]) => {
    // Reset added findings when loading new scan results
    setAddedFindings(new Set());

    // Debug: Log raw findings from API
    console.log('Raw findings from scanner API:', JSON.stringify(findings, null, 2));

    // Transform findings to our state format
    const transformedFindings: VulnerabilityFinding[] = findings.map((f: any, index: number) => ({
      id: `${scanId}-${f.endpoint || 'unknown'}-${f.rule || 'unknown'}-${index}`,
      rule: f.rule || 'Unknown',
      title: f.title || 'Unknown Issue',
      severity: f.severity || 'Low',
      score: f.score || 0,
      endpoint: f.endpoint || 'Unknown',
      method: f.method || 'GET',
      description: f.description || 'No description available',
      scanner: f.scanner || 'unknown',
      scanner_description: f.scanner_description || '',
      evidence: f.evidence || {},
    }));

    // Group by endpoint
    const groupedByEndpoint: Record<string, VulnerabilityFinding[]> = {};
    transformedFindings.forEach(finding => {
      const key = `${finding.method} ${finding.endpoint}`;
      if (!groupedByEndpoint[key]) {
        groupedByEndpoint[key] = [];
      }
      groupedByEndpoint[key].push(finding);
    });

    // Calculate summary
    const summary = {
      total: transformedFindings.length,
      critical: transformedFindings.filter(f => f.severity === 'Critical').length,
      high: transformedFindings.filter(f => f.severity === 'High').length,
      medium: transformedFindings.filter(f => f.severity === 'Medium').length,
      low: transformedFindings.filter(f => f.severity === 'Low').length,
    };

    setScanResults({
      scanId,
      findings: transformedFindings,
      scanDate: new Date().toISOString(),
      apiBaseUrl: 'Unknown', // Will be updated when we get scan details
      status: 'completed',
      summary,
      groupedByEndpoint,
    });

    // Note: We don't add individual findings to context automatically anymore
    // The useSecurityContext hook will add just the summary
    // Users can manually add specific findings they want to discuss
  };

  const handleAddToContext = (finding: VulnerabilityFinding) => {
    try {
      if (!finding || !finding.id) {
        console.error('Invalid finding object:', finding);
        alert('Error: Invalid vulnerability data');
        return;
      }

      console.log('Adding to context:', finding);

      // Create a more concise label with severity indicator
      const severityIcon = finding.severity === 'Critical' ? '🔴' :
                           finding.severity === 'High' ? '🟠' :
                           finding.severity === 'Medium' ? '🟡' : '🔵';

      addContextEntry(finding.id, {
        id: finding.id,
        source: 'manual',
        data: finding,
        metadata: {
          label: `${severityIcon} ${finding.title}`,
          icon: '🔍',
          severity: finding.severity,
          color: finding.severity === 'Critical' ? '#EF4444' :
                 finding.severity === 'High' ? '#F97316' :
                 finding.severity === 'Medium' ? '#EAB308' : '#3B82F6',
          showInChat: true,
        },
      });

      // Mark this finding as added
      setAddedFindings(prev => {
        const newSet = new Set(prev);
        newSet.add(finding.id);
        console.log('✅ Updated addedFindings. Now contains:', Array.from(newSet));
        return newSet;
      });
    } catch (error) {
      console.error('Failed to add to context:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Failed to add to context: ' + errorMessage);
    }
  };

  const handleAddAllToContext = (findings: VulnerabilityFinding[]) => {
    try {
      console.log(`Adding ${findings.length} findings to context`);

      findings.forEach(finding => {
        if (!finding || !finding.id) {
          console.error('Invalid finding object:', finding);
          return;
        }

        console.log('Adding to context:', finding);

        // Create a more concise label with severity indicator
        const severityIcon = finding.severity === 'Critical' ? '🔴' :
                             finding.severity === 'High' ? '🟠' :
                             finding.severity === 'Medium' ? '🟡' : '🔵';

        addContextEntry(finding.id, {
          id: finding.id,
          source: 'manual',
          data: finding,
          metadata: {
            label: `${severityIcon} ${finding.title}`,
            icon: '🔍',
            severity: finding.severity,
            color: finding.severity === 'Critical' ? '#EF4444' :
                   finding.severity === 'High' ? '#F97316' :
                   finding.severity === 'Medium' ? '#EAB308' : '#3B82F6',
            showInChat: true,
            order: finding.severity === 'Critical' ? 1 :
                   finding.severity === 'High' ? 2 :
                   finding.severity === 'Medium' ? 3 : 4,
          },
        });
      });

      // Mark all findings as added
      const findingIds = findings.map(f => f.id).filter(Boolean);
      setAddedFindings(prev => new Set([...prev, ...findingIds]));

      console.log('Successfully added all findings to context');
    } catch (error) {
      console.error('Failed to add to context:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Failed to add to context: ' + errorMessage);
    }
  };

  const handleRunScan = () => {
    setShowScanDialog(true);
  };

  const handleScanSubmit = async (config: ScanConfig) => {
    setIsScanning(true);
    setShowScanDialog(false);

    try {
      const response = await scannerApi.startScan({
        serverUrl: config.serverUrl,
        specUrl: config.specUrl,
        specFile: config.specFile,
        scanners: config.scanners,
        dangerous: config.dangerous,
        fuzzAuth: config.fuzzAuth,
      });

      setActiveScanId(response.scan_id);
      
      // Show scanning state
      setScanResults({
        scanId: response.scan_id,
        findings: [],
        scanDate: new Date().toISOString(),
        apiBaseUrl: config.serverUrl,
        status: 'running',
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
        groupedByEndpoint: {},
      });

      // No need to add scan start to context - the summary will be added automatically when complete
    } catch (error) {
      console.error('Failed to start scan:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : JSON.stringify(error);
      alert('Failed to start scan: ' + errorMessage);
      setIsScanning(false);
    }
  };

  // Render everything in one return with conditional content
  return (
    <>
      {(!scanResults || scanResults.status === 'running') ? (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              🛡️ API Security Dashboard
            </h1>
            <p className="text-gray-400">
              AI-powered vulnerability analysis with actionable remediation guidance
            </p>
          </header>

          {scanResults?.status === 'running' ? (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <div className="mb-6 text-center">
                <div className="text-6xl mb-4 animate-pulse">🔄</div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Security Scan in Progress
                </h2>
                <p className="text-gray-400 mb-4">
                  Analyzing your API for vulnerabilities...
                </p>
              </div>

              {/* Progress Bar */}
              {currentScanStatus && (
                <div className="space-y-6">
                  {/* Overall Progress */}
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white font-semibold">
                        {currentScanStatus.current_phase || 'Scanning'}
                      </div>
                      <div className="text-blue-400 font-bold">
                        {currentScanStatus.progress}%
                      </div>
                    </div>

                    <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden mb-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${currentScanStatus.progress}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {currentScanStatus.current_probe && (
                        <div>
                          <span className="text-gray-400">Current Probe:</span>
                          <div className="text-white font-medium">{currentScanStatus.current_probe}</div>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">Findings:</span>
                        <div className="text-white font-medium">{currentScanStatus.findings_count}</div>
                      </div>
                      {currentScanStatus.parallel_mode && currentScanStatus.total_chunks && (
                        <div>
                          <span className="text-gray-400">Containers:</span>
                          <div className="text-white font-medium">
                            {currentScanStatus.completed_chunks || 0} / {currentScanStatus.total_chunks}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scanner Containers Details */}
                  {currentScanStatus.chunk_status && currentScanStatus.chunk_status.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                        Scanner Containers
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentScanStatus.chunk_status.filter(chunk => chunk && chunk.chunk_id !== undefined).map((chunk) => {
                          const getScannerIcon = (scanner?: string) => {
                            switch (scanner?.toLowerCase()) {
                              case 'ventiapi': return '🔍';
                              case 'zap': return '🕷️';
                              default: return '🛡️';
                            }
                          };

                          const getScannerDisplayName = (scanner?: string) => {
                            switch (scanner?.toLowerCase()) {
                              case 'ventiapi': return 'VentiAPI';
                              case 'zap': return 'OWASP ZAP';
                              default: return scanner || 'Unknown';
                            }
                          };

                          const getStatusIcon = (status: string) => {
                            switch (status) {
                              case 'preparing': return '⏳';
                              case 'starting': return '🚀';
                              case 'running': return '⚡';
                              case 'completed': return '✅';
                              case 'failed': return '❌';
                              default: return '⏳';
                            }
                          };

                          const getStatusColor = (status: string) => {
                            switch (status) {
                              case 'completed': return 'bg-green-900 bg-opacity-30 border-green-600';
                              case 'failed': return 'bg-red-900 bg-opacity-30 border-red-600';
                              case 'running': return 'bg-blue-900 bg-opacity-30 border-blue-600';
                              default: return 'bg-yellow-900 bg-opacity-30 border-yellow-600';
                            }
                          };

                          // Calculate actual progress based on scanned endpoints if progress is low
                          const calculateProgress = () => {
                            // If status is completed, return 100
                            if (chunk.status === 'completed') return 100;

                            // If chunk.progress exists and is reasonable, use it
                            if (chunk.progress && chunk.progress > 5) {
                              return chunk.progress;
                            }

                            // Otherwise calculate from scanned endpoints
                            const scannedCount = chunk.scanned_endpoints?.length || 0;
                            const totalCount = chunk.total_endpoints || chunk.endpoints_count || 1;

                            if (scannedCount > 0 && totalCount > 0) {
                              return Math.round((scannedCount / totalCount) * 100);
                            }

                            return chunk.progress || 0;
                          };

                          const actualProgress = calculateProgress();

                          return (
                            <div
                              key={chunk.chunk_id}
                              className={`bg-gray-700 rounded-lg p-4 border ${getStatusColor(chunk.status)}`}
                            >
                              {/* Chunk Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{getScannerIcon(chunk.scanner)}</span>
                                  <span className="text-white font-semibold">
                                    {getScannerDisplayName(chunk.scanner)}
                                  </span>
                                  <span className="text-xs text-gray-400 font-mono">
                                    #{chunk.chunk_id}
                                  </span>
                                </div>
                                <span className="text-lg">{getStatusIcon(chunk.status)}</span>
                              </div>

                              {/* Scanner Details */}
                              <div className="bg-gray-800 rounded p-3 mb-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Scanner Engine:</span>
                                  <span className="text-white font-medium">
                                    {getScannerDisplayName(chunk.scanner)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Scan Type:</span>
                                  <span className="text-white font-medium">
                                    {chunk.scan_type || 'endpoint_based'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total Endpoints:</span>
                                  <span className="text-white font-medium">
                                    {chunk.total_endpoints || chunk.endpoints_count} endpoint{(chunk.total_endpoints || chunk.endpoints_count) !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Debug info for progress */}
                              {actualProgress <= 5 && chunk.status === 'running' && (
                                <div className="mb-2 p-2 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded text-xs">
                                  <div className="text-yellow-300">Debug: Low progress detected</div>
                                  <div className="text-yellow-200 font-mono">
                                    Raw: {chunk.progress}%, Calculated: {actualProgress}%
                                  </div>
                                  <div className="text-yellow-200 font-mono">
                                    Scanned: {chunk.scanned_endpoints?.length || 0} / {chunk.total_endpoints || chunk.endpoints_count || 0}
                                  </div>
                                </div>
                              )}

                              {/* Scanned Endpoints */}
                              {chunk.scanned_endpoints && chunk.scanned_endpoints.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-xs text-gray-400 mb-2">
                                    Scanned Endpoints ({chunk.scanned_endpoints.length}/{chunk.total_endpoints || chunk.endpoints_count}):
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {chunk.scanned_endpoints.map((endpoint, idx) => (
                                      <span
                                        key={idx}
                                        className="bg-blue-900 bg-opacity-40 text-blue-300 px-2 py-1 rounded text-xs font-mono border border-blue-700"
                                      >
                                        {endpoint}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Currently Scanning */}
                              {chunk.current_endpoint && (
                                <div className="mb-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded p-2">
                                  <div className="text-xs text-blue-300 font-semibold mb-1">
                                    Currently scanning:
                                  </div>
                                  <div className="text-white font-mono text-sm">
                                    {chunk.current_endpoint}
                                  </div>
                                </div>
                              )}

                              {/* Progress Bar */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-600 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-500 ease-out"
                                    style={{ width: `${actualProgress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 min-w-[40px] text-right">
                                  {actualProgress}%
                                </span>
                              </div>

                              {/* Status Badge */}
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-gray-800 text-gray-300">
                                  {chunk.status}
                                </span>
                                {chunk.error && (
                                  <span className="text-xs text-red-400" title={chunk.error}>
                                    ⚠️ Error
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Scan ID */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Scan ID: {scanResults.scanId}</span>
                    </div>
                  </div>
                </div>
              )}

              {!currentScanStatus && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Scan ID: {scanResults.scanId}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <div className="mb-6">
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  No Scan Results Yet
                </h2>
                <p className="text-gray-400 mb-6">
                  Run a security scan to analyze your API for vulnerabilities
                </p>
              </div>

              <button
                onClick={handleRunScan}
                disabled={isScanning}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScanning ? 'Starting Scan...' : 'Run Security Scan'}
              </button>

              <div className="mt-8 text-sm text-gray-500">
                <p>Or use your existing scanner interface at:</p>
                <a 
                  href="http://localhost:3000" 
                  className="text-blue-400 hover:text-blue-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  http://localhost:3000
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-3">
                🛡️ Security Scan Results
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2">
                  <div className="text-xs text-gray-400 mb-1">Scan ID</div>
                  <div className="font-mono text-sm text-blue-400 flex items-center gap-2">
                    {scanResults.scanId}
                    <button
                      onClick={() => navigator.clipboard.writeText(scanResults.scanId)}
                      className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      title="Copy Scan ID"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => {
                        addContextEntry(`scan-id-${scanResults.scanId}`, {
                          id: `scan-id-${scanResults.scanId}`,
                          source: 'manual',
                          data: { scanId: scanResults.scanId },
                          metadata: {
                            label: `🔍 Scan ${scanResults.scanId.slice(0, 8)}...`,
                            icon: '🔍',
                            color: '#3B82F6',
                            showInChat: true,
                          },
                        });
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-colors"
                      title="Add Scan ID to Cedar Context"
                    >
                      + Add to Context
                    </button>
                  </div>
                </div>
                <div className="text-gray-400 text-sm">
                  <span className="text-gray-500">API:</span> {scanResults.apiBaseUrl}
                </div>
                <div className="text-gray-400 text-sm">
                  <span className="text-gray-500">Date:</span> {new Date(scanResults.scanDate).toLocaleString()}
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg">
                <p className="text-xs text-blue-300">
                  💬 <strong>Tip:</strong> Click "+ Add to Context" above, then ask the AI assistant: "Analyze this scan" or "Give me a security report"
                </p>
              </div>
            </div>
            <button
              onClick={handleRunScan}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors ml-4"
            >
              New Scan
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-3xl font-bold text-white mb-2">
              {scanResults.summary.total}
            </div>
            <div className="text-gray-400 text-sm">Total Issues</div>
          </div>
          <div className="bg-red-900 bg-opacity-30 rounded-lg p-6 border border-red-700">
            <div className="text-3xl font-bold text-red-400 mb-2">
              {scanResults.summary.critical}
            </div>
            <div className="text-red-300 text-sm">Critical</div>
          </div>
          <div className="bg-orange-900 bg-opacity-30 rounded-lg p-6 border border-orange-700">
            <div className="text-3xl font-bold text-orange-400 mb-2">
              {scanResults.summary.high}
            </div>
            <div className="text-orange-300 text-sm">High</div>
          </div>
          <div className="bg-yellow-900 bg-opacity-30 rounded-lg p-6 border border-yellow-700">
            <div className="text-3xl font-bold text-yellow-400 mb-2">
              {scanResults.summary.medium}
            </div>
            <div className="text-yellow-300 text-sm">Medium</div>
          </div>
          <div className="bg-blue-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
            <div className="text-3xl font-bold text-blue-400 mb-2">
              {scanResults.summary.low}
            </div>
            <div className="text-blue-300 text-sm">Low</div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Filter Checkboxes */}
            <div className="flex items-center gap-4">
              <span className="text-white font-semibold text-sm">Filter by Severity:</span>
              {['Critical', 'High', 'Medium', 'Low'].map((severity) => {
                const isActive = severityFilters.has(severity);
                const colorClasses = {
                  Critical: 'bg-red-900 bg-opacity-30 border-red-600 text-red-300',
                  High: 'bg-orange-900 bg-opacity-30 border-orange-600 text-orange-300',
                  Medium: 'bg-yellow-900 bg-opacity-30 border-yellow-600 text-yellow-300',
                  Low: 'bg-blue-900 bg-opacity-30 border-blue-600 text-blue-300',
                };

                return (
                  <label
                    key={severity}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                      isActive
                        ? colorClasses[severity as keyof typeof colorClasses]
                        : 'bg-gray-700 border-gray-600 text-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleSeverityFilter(severity)}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm font-medium">{severity}</span>
                  </label>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors border border-gray-600"
              >
                Reset Filters
              </button>
              <button
                onClick={() => handleAddAllToContext(filteredFindings)}
                disabled={filteredFindings.length === 0}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                title="Add all filtered vulnerabilities to chat"
              >
                <span>💬</span>
                <span>Add all filtered to chat ({filteredFindings.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Vulnerabilities by Endpoint */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            Vulnerabilities by Endpoint (Sorted by Severity)
          </h2>

          {Object.entries(scanResults.groupedByEndpoint)
            .map(([endpoint, findings]) => [endpoint, findings.filter(f => severityFilters.has(f.severity))] as const)
            .filter(([, filteredEndpointFindings]) => filteredEndpointFindings.length > 0)
            .sort(([, findingsA], [, findingsB]) => {
              // Severity ranking: Critical > High > Medium > Low
              const severityRank = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };

              // Get highest severity from each endpoint
              const maxSeverityA = Math.max(...findingsA.map(f => severityRank[f.severity] || 0));
              const maxSeverityB = Math.max(...findingsB.map(f => severityRank[f.severity] || 0));

              // Sort descending (highest severity first)
              return maxSeverityB - maxSeverityA;
            })
            .map(([endpoint, findings]) => (
            <div key={endpoint} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              {/* Endpoint Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                    {findings[0].method}
                  </span>
                  <h3 className="text-xl font-semibold text-white">
                    {findings[0].endpoint}
                  </h3>
                  <span className="text-gray-400 text-sm">
                    {findings.length} finding{findings.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {findings.length > 1 && (
                    <button
                      onClick={() => handleAddAllToContext(findings)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1"
                      title="Add all findings to chat context"
                    >
                      <span>+</span>
                      <span>Add All ({findings.length})</span>
                    </button>
                  )}
                  {(() => {
                    // Find highest severity
                    const severities = findings.map(f => f.severity);
                    const highestSeverity = severities.includes('Critical') ? 'Critical'
                      : severities.includes('High') ? 'High'
                      : severities.includes('Medium') ? 'Medium'
                      : 'Low';
                    return (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(highestSeverity)}`}>
                        {highestSeverity.toUpperCase()}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-3">
                {findings.map((finding) => (
                  <VulnerabilityCard
                    key={finding.id}
                    finding={finding}
                    onAddToContext={() => handleAddToContext(finding)}
                    isAdded={addedFindings.has(finding.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
      )}

      {/* Scan Config Dialog - Always rendered */}
      <ScanConfigDialog
        isOpen={showScanDialog}
        onClose={() => setShowScanDialog(false)}
        onSubmit={handleScanSubmit}
        isLoading={isScanning}
      />

      {/* Page-specific Cedar Chat - only render after mount to prevent hydration errors */}
      {mounted && (
        <FloatingCedarChat
          side="right"
          title="🤖 Security Analyst AI"
          collapsedLabel={scanResults?.status === 'completed' ? "💬 Ask about vulnerabilities..." : "💬 Ask about security..."}
        />
      )}
    </>
  );
}

// Vulnerability Card Component
function VulnerabilityCard({
  finding,
  onAddToContext,
  isAdded,
}: {
  finding: VulnerabilityFinding;
  onAddToContext: () => void;
  isAdded: boolean;
}) {
  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(finding.severity)}`}>
              {finding.severity.toUpperCase()}
            </span>
            <h4 className="text-white font-semibold">{finding.title}</h4>
          </div>

          <p className="text-gray-300 text-sm mb-3">
            {finding.description}
          </p>

          <div className="mt-3 pt-3 border-t border-gray-600 space-y-2 text-sm">
            <div className="text-gray-400">
              <strong className="text-gray-300">Rule:</strong> {finding.rule}
            </div>
            <div className="text-gray-400">
              <strong className="text-gray-300">Score:</strong> {finding.score}
            </div>
            <div className="text-gray-400">
              <strong className="text-gray-300">Scanner:</strong> {finding.scanner_description}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => {
            console.log('🔘 Add button clicked for finding:', finding.id);
            onAddToContext();
          }}
          disabled={isAdded}
          className={`w-8 h-8 text-white text-lg font-bold rounded-full transition-all flex items-center justify-center ${
            isAdded
              ? 'bg-green-600 cursor-default'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
          title={isAdded ? 'Added to chat context' : 'Add to chat context'}
        >
          {isAdded ? '✓' : '+'}
        </button>
      </div>
    </div>
  );
}

