'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useScanResultsState, VulnerabilityFinding } from '@/app/cedar-os/scanState';
import { scannerApi, ScanStatus } from '@/lib/scannerApi';
import { useScanResultsPolling } from '@/hooks/useScanResultsPolling';
import { ScanConfig } from '@/components/security/ScanConfigDialog';

export interface ScanManagerState {
  // Scan execution state
  isScanning: boolean;
  activeScanId: string | null;
  currentScanStatus: ScanStatus | null;

  // Database scan selection
  scans: any[];
  selectedScanId: string | null;
  isLoadingScans: boolean;

  // Dialog state
  showScanDialog: boolean;
}

export interface ScanManagerActions {
  // Dialog controls
  openScanDialog: () => void;
  closeScanDialog: () => void;

  // Scan execution
  startScan: (config: ScanConfig) => Promise<void>;

  // Database scan selection
  selectScan: (scanId: string | null) => void;
  refreshScans: () => Promise<void>;

  // Results management
  clearResults: () => void;
}

export interface UseScanManagerReturn extends ScanManagerState, ScanManagerActions {
  // Computed values
  hasCompletedResults: boolean;
  isRunning: boolean;
}

/**
 * useScanManager - Centralized hook for managing security scan state
 *
 * This hook encapsulates all scan-related logic including:
 * - Starting new scans
 * - Polling for scan progress
 * - Loading scans from database
 * - Managing scan results state
 *
 * Usage:
 * ```tsx
 * const {
 *   isScanning,
 *   currentScanStatus,
 *   openScanDialog,
 *   startScan,
 *   ...
 * } = useScanManager();
 * ```
 */
export function useScanManager(): UseScanManagerReturn {
  const { scanResults, setScanResults } = useScanResultsState();

  // Scan execution state
  const [isScanning, setIsScanning] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [currentScanStatus, setCurrentScanStatus] = useState<ScanStatus | null>(null);

  // Database scan state
  const [scans, setScans] = useState<any[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [isLoadingScans, setIsLoadingScans] = useState(true);

  // Dialog state
  const [showScanDialog, setShowScanDialog] = useState(false);

  // Store API base URL for completion callback
  const apiBaseUrlRef = useRef<string>('');

  // Handle scan completion
  const handleScanCompleted = useCallback(async (scanId: string, findings: any[]) => {
    console.log('[useScanManager] Scan completed:', scanId, 'findings:', findings.length);

    setScanResults({
      scanId,
      findings,
      scanDate: new Date().toISOString(),
      apiBaseUrl: apiBaseUrlRef.current,
      status: 'completed',
      summary: {
        total: findings.length,
        critical: findings.filter((f: VulnerabilityFinding) => f.severity === 'Critical').length,
        high: findings.filter((f: VulnerabilityFinding) => f.severity === 'High').length,
        medium: findings.filter((f: VulnerabilityFinding) => f.severity === 'Medium').length,
        low: findings.filter((f: VulnerabilityFinding) => f.severity === 'Low').length,
      },
      groupedByEndpoint: findings.reduce((acc, finding) => {
        const key = `${finding.method} ${finding.endpoint}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(finding);
        return acc;
      }, {} as Record<string, VulnerabilityFinding[]>),
    });

    setIsScanning(false);
    setActiveScanId(null);
  }, [setScanResults]);

  // Handle scan failure
  const handleScanFailed = useCallback((message: string) => {
    console.error('[useScanManager] Scan failed:', message);
    setIsScanning(false);
    setActiveScanId(null);
    setScanResults(null);
  }, [setScanResults]);

  // Poll scan status
  const { status: pollingStatus } = useScanResultsPolling({
    scanId: activeScanId,
    enabled: !!activeScanId && scanResults?.status === 'running',
    onCompleted: handleScanCompleted,
    onFailed: handleScanFailed,
  });

  // Update currentScanStatus from polling hook
  useEffect(() => {
    if (pollingStatus) {
      setCurrentScanStatus(pollingStatus);
    }
  }, [pollingStatus]);

  // Fetch scans from database on mount
  const refreshScans = useCallback(async () => {
    setIsLoadingScans(true);
    try {
      const response = await scannerApi.listScans(10, 0);
      setScans(response.scans);
    } catch (error) {
      console.error('[useScanManager] Error fetching scans:', error);
    } finally {
      setIsLoadingScans(false);
    }
  }, []);

  useEffect(() => {
    refreshScans();
  }, [refreshScans]);

  // Load findings when a scan is selected from database
  useEffect(() => {
    if (!selectedScanId) return;

    const fetchFindings = async () => {
      try {
        const scan = scans.find(s => s.scan_id === selectedScanId);

        if (scan && scan.status !== 'completed') {
          console.warn(`[useScanManager] Scan ${selectedScanId} is not completed (status: ${scan.status})`);
          return;
        }

        const response = await scannerApi.getFindings(selectedScanId);
        const findings = response.findings || [];

        const vulnerabilityFindings: VulnerabilityFinding[] = findings
          .filter((f: any) => f != null)
          .map((f: any) => ({
            id: f.id || `${f.endpoint || ''}-${f.rule || ''}` || `finding-${Math.random()}`,
            title: f.title || 'Untitled Finding',
            severity: (f.severity || 'Low') as 'Critical' | 'High' | 'Medium' | 'Low',
            endpoint: f.endpoint || '/',
            method: f.method || 'GET',
            description: f.description || '',
            rule: f.rule || '',
            score: f.score || 0,
            scanner: f.scanner || 'unknown',
            scanner_description: f.scanner_description || f.scanner || 'unknown',
            evidence: f.evidence || {},
          }));

        setScanResults({
          scanId: selectedScanId,
          findings: vulnerabilityFindings,
          scanDate: scan?.created_at || new Date().toISOString(),
          apiBaseUrl: scan?.server_url || '',
          status: 'completed',
          summary: {
            total: vulnerabilityFindings.length,
            critical: vulnerabilityFindings.filter(f => f.severity === 'Critical').length,
            high: vulnerabilityFindings.filter(f => f.severity === 'High').length,
            medium: vulnerabilityFindings.filter(f => f.severity === 'Medium').length,
            low: vulnerabilityFindings.filter(f => f.severity === 'Low').length,
          },
          groupedByEndpoint: vulnerabilityFindings.reduce((acc, finding) => {
            const key = `${finding.method} ${finding.endpoint}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(finding);
            return acc;
          }, {} as Record<string, VulnerabilityFinding[]>),
        });
      } catch (error) {
        console.error('[useScanManager] Error fetching findings:', error);
      }
    };

    fetchFindings();
  }, [selectedScanId, scans, setScanResults]);

  // Start a new scan
  const startScan = useCallback(async (config: ScanConfig) => {
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
        rps: config.rps,
        maxRequests: config.maxRequests,
      });

      if (!response.scan_id) {
        throw new Error('Scan started but no scan_id was returned');
      }

      console.log('[useScanManager] Scan started:', response.scan_id);
      setActiveScanId(response.scan_id);
      apiBaseUrlRef.current = config.serverUrl;

      setScanResults({
        scanId: response.scan_id,
        findings: [],
        scanDate: new Date().toISOString(),
        apiBaseUrl: config.serverUrl,
        status: 'running',
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
        groupedByEndpoint: {},
      });

      // Refresh scans list after starting
      await refreshScans();
    } catch (error) {
      console.error('[useScanManager] Failed to start scan:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(errorMessage);
    }
  }, [setScanResults, refreshScans]);

  // Clear results
  const clearResults = useCallback(() => {
    setScanResults(null);
    setActiveScanId(null);
    setSelectedScanId(null);
    setCurrentScanStatus(null);
  }, [setScanResults]);

  // Dialog controls
  const openScanDialog = useCallback(() => setShowScanDialog(true), []);
  const closeScanDialog = useCallback(() => setShowScanDialog(false), []);

  // Select scan from database
  const selectScan = useCallback((scanId: string | null) => {
    setSelectedScanId(scanId);
  }, []);

  return {
    // State
    isScanning,
    activeScanId,
    currentScanStatus,
    scans,
    selectedScanId,
    isLoadingScans,
    showScanDialog,

    // Computed values
    hasCompletedResults: scanResults?.status === 'completed',
    isRunning: scanResults?.status === 'running',

    // Actions
    openScanDialog,
    closeScanDialog,
    startScan,
    selectScan,
    refreshScans,
    clearResults,
  };
}
