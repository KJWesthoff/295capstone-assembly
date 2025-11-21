'use client';

import React from 'react';

interface Scan {
  scan_id: string;
  status: string;
  server_url: string;
  created_at: string;
  findings_count?: number;
}

interface ScanSelectorProps {
  /** List of available scans from database */
  scans: Scan[];
  /** Currently selected scan ID */
  selectedScanId: string | null;
  /** Callback when a scan is selected */
  onSelectScan: (scanId: string | null) => void;
  /** Whether scans are being loaded */
  isLoading?: boolean;
  /** Callback to refresh the scans list */
  onRefresh?: () => void;
  /** Custom class name */
  className?: string;
  /** Label text */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Show as compact inline element */
  compact?: boolean;
}

/**
 * ScanSelector - Dropdown to select existing scans from the database
 *
 * Features:
 * - Dropdown list of recent scans
 * - Shows scan date, target URL, status, and findings count
 * - Loading state indicator
 * - Optional refresh button
 * - Compact mode for embedding in headers
 *
 * Usage:
 * ```tsx
 * const { scans, selectedScanId, selectScan, isLoadingScans, refreshScans } = useScanManager();
 *
 * <ScanSelector
 *   scans={scans}
 *   selectedScanId={selectedScanId}
 *   onSelectScan={selectScan}
 *   isLoading={isLoadingScans}
 *   onRefresh={refreshScans}
 * />
 * ```
 */
export function ScanSelector({
  scans,
  selectedScanId,
  onSelectScan,
  isLoading = false,
  onRefresh,
  className = '',
  label = 'Select a scan:',
  placeholder = 'Select a scan from database...',
  compact = false,
}: ScanSelectorProps) {
  const formatScanOption = (scan: Scan): string => {
    const date = new Date(scan.created_at).toLocaleString();
    const url = scan.server_url.length > 40
      ? scan.server_url.substring(0, 40) + '...'
      : scan.server_url;
    const findings = scan.findings_count ?? 0;
    const status = scan.status;

    return `${date} - ${url} (${status}) - ${findings} findings`;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-600',
      running: 'bg-blue-600',
      failed: 'bg-red-600',
      pending: 'bg-yellow-600',
    };
    return colors[status] || 'bg-gray-600';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <select
          value={selectedScanId || ''}
          onChange={(e) => onSelectScan(e.target.value || null)}
          disabled={isLoading}
          className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">{isLoading ? 'Loading...' : placeholder}</option>
          {scans.map((scan) => (
            <option key={scan.scan_id} value={scan.scan_id}>
              {formatScanOption(scan)}
            </option>
          ))}
        </select>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh scans list"
          >
            <RefreshIcon className={isLoading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-white">
          {label}
        </label>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      <select
        value={selectedScanId || ''}
        onChange={(e) => onSelectScan(e.target.value || null)}
        disabled={isLoading}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="">{isLoading ? 'Loading scans...' : placeholder}</option>
        {scans.map((scan) => (
          <option key={scan.scan_id} value={scan.scan_id}>
            {formatScanOption(scan)}
          </option>
        ))}
      </select>

      {isLoading && (
        <div className="text-center py-2 text-gray-400 text-sm flex items-center justify-center gap-2">
          <LoadingSpinner />
          Loading scans...
        </div>
      )}

      {!isLoading && scans.length === 0 && (
        <div className="text-center py-2 text-gray-500 text-sm">
          No scans found. Run a security scan to get started.
        </div>
      )}

      {/* Selected scan preview */}
      {selectedScanId && !isLoading && (
        <SelectedScanPreview
          scan={scans.find(s => s.scan_id === selectedScanId)}
        />
      )}
    </div>
  );
}

/**
 * Preview card for the selected scan
 */
function SelectedScanPreview({ scan }: { scan?: Scan }) {
  if (!scan) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-blue-400';
      case 'failed': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  return (
    <div className="bg-gray-700 rounded-md p-3 border border-gray-600">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate" title={scan.server_url}>
            {scan.server_url}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(scan.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-semibold uppercase ${getStatusColor(scan.status)}`}>
            {scan.status}
          </span>
          <span className="text-sm font-bold text-white">
            {scan.findings_count ?? 0} findings
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Refresh icon SVG
 */
function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

/**
 * Simple loading spinner
 */
function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default ScanSelector;
