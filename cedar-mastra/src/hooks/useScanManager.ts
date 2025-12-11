'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useScanResultsState } from '@/app/cedar-os/scanState';
import type { Finding } from '@/types/finding';
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
  // Findings are already enriched Finding[] from the polling hook (via API route + scanner-transform.ts)
  const handleScanCompleted = useCallback(async (scanId: string, findings: Finding[]) => {
    console.log('[useScanManager] Scan completed:', scanId, 'findings:', findings.length);

    setScanResults({
      scanId,
      findings,
      scanDate: new Date().toISOString(),
      apiBaseUrl: apiBaseUrlRef.current,
      status: 'completed',
      summary: {
        total: findings.length,
        critical: findings.filter((f: Finding) => f.severity === 'Critical').length,
        high: findings.filter((f: Finding) => f.severity === 'High').length,
        medium: findings.filter((f: Finding) => f.severity === 'Medium').length,
        low: findings.filter((f: Finding) => f.severity === 'Low').length,
      },
      groupedByEndpoint: findings.reduce((acc, finding) => {
        const key = `${finding.endpoint.method} ${finding.endpoint.path}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(finding);
        return acc;
      }, {} as Record<string, Finding[]>),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

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

        // API returns enriched Finding[] with OWASP/CWE/NIST mappings from scanner-transform.ts
        const response = await scannerApi.getFindings(selectedScanId);
        const findings: Finding[] = response.findings || [];

        setScanResults({
          scanId: selectedScanId,
          findings,
          scanDate: scan?.created_at || new Date().toISOString(),
          apiBaseUrl: scan?.server_url || '',
          status: 'completed',
          summary: {
            total: findings.length,
            critical: findings.filter(f => f.severity === 'Critical').length,
            high: findings.filter(f => f.severity === 'High').length,
            medium: findings.filter(f => f.severity === 'Medium').length,
            low: findings.filter(f => f.severity === 'Low').length,
          },
          groupedByEndpoint: findings.reduce((acc, finding) => {
            const key = `${finding.endpoint.method} ${finding.endpoint.path}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(finding);
            return acc;
          }, {} as Record<string, Finding[]>),
        });
      } catch (error) {
        console.error('[useScanManager] Error fetching findings:', error);
      }
    };

    fetchFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScanId]); // Only re-fetch when scan selection changes

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
