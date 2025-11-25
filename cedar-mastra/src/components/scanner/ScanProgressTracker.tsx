'use client';

import React from 'react';
import { ScanStatus, ChunkStatus } from '@/lib/scannerApi';

interface ScanProgressTrackerProps {
  /** Current scan status from the scanner API */
  scanStatus: ScanStatus | null;
  /** Scan ID to display */
  scanId?: string;
  /** Callback when scan completes - used to navigate to results */
  onViewResults?: () => void;
  /** Whether to show the "View Results" button when scan completes */
  showViewResultsButton?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Compact mode for embedding in smaller spaces */
  compact?: boolean;
}

/**
 * ScanProgressTracker - Displays real-time scan progress with scanner container details
 *
 * Features:
 * - Overall progress bar with percentage
 * - Current phase and probe information
 * - Findings count during scan
 * - Per-scanner container status cards
 * - Scanned endpoints list
 * - View Results button on completion
 *
 * Usage:
 * ```tsx
 * <ScanProgressTracker
 *   scanStatus={currentScanStatus}
 *   scanId={activeScanId}
 *   onViewResults={() => router.push('/developer')}
 * />
 * ```
 */
export function ScanProgressTracker({
  scanStatus,
  scanId,
  onViewResults,
  showViewResultsButton = true,
  className = '',
  compact = false,
}: ScanProgressTrackerProps) {
  if (!scanStatus && !scanId) {
    return (
      <div className={`text-center text-gray-400 ${className}`}>
        <LoadingSpinner />
        <span className="ml-2">Waiting for scan to start...</span>
      </div>
    );
  }

  const isComplete = scanStatus?.progress === 100;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Progress Section */}
      <div className="bg-gray-700 rounded-lg p-4 md:p-6 border border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white font-semibold">
            {scanStatus?.current_phase || 'Scanning'}
          </div>
          <div className="text-blue-400 font-bold">
            {scanStatus?.progress ?? 0}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden mb-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-500 ease-out rounded-full"
            style={{ width: `${scanStatus?.progress ?? 0}%` }}
          />
        </div>

        {/* Stats Grid */}
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-4 text-sm`}>
          {scanStatus?.current_probe && (
            <div>
              <span className="text-gray-400">Current Probe:</span>
              <div className="text-white font-medium truncate">{scanStatus.current_probe}</div>
            </div>
          )}
          <div>
            <span className="text-gray-400">Findings:</span>
            <div className="text-white font-medium">{scanStatus?.findings_count ?? 0}</div>
          </div>
          {scanStatus?.parallel_mode && scanStatus?.total_chunks && (
            <div>
              <span className="text-gray-400">Containers:</span>
              <div className="text-white font-medium">
                {scanStatus.completed_chunks ?? 0} / {scanStatus.total_chunks}
              </div>
            </div>
          )}
        </div>

        {/* View Results Button */}
        {isComplete && showViewResultsButton && onViewResults && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="flex items-center justify-between">
              <div className="text-green-400 font-semibold flex items-center gap-2">
                <span className="text-xl">✅</span>
                <span>Scan Complete! Found {scanStatus.findings_count} vulnerabilities</span>
              </div>
              <button
                onClick={onViewResults}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                View Results →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Containers Section */}
      {!compact && scanStatus?.chunk_status && scanStatus.chunk_status.length > 0 && (
        <ScannerContainersGrid chunks={scanStatus.chunk_status} />
      )}

      {/* Scan ID Footer */}
      {scanId && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-400">
            {!isComplete && <LoadingSpinner size="sm" />}
            <span>Scan ID: {scanId}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Grid of scanner container status cards
 */
function ScannerContainersGrid({ chunks }: { chunks: ChunkStatus[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
        Scanner Containers
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chunks
          .filter(chunk => chunk && chunk.chunk_id !== undefined)
          .map(chunk => (
            <ScannerContainerCard key={chunk.chunk_id} chunk={chunk} />
          ))}
      </div>
    </div>
  );
}

/**
 * Individual scanner container status card
 */
function ScannerContainerCard({ chunk }: { chunk: ChunkStatus }) {
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

  const calculateProgress = () => {
    if (chunk.status === 'completed') return 100;
    if (chunk.progress && chunk.progress > 5) return chunk.progress;

    const scannedCount = chunk.scanned_endpoints?.length || 0;
    const totalCount = chunk.total_endpoints || chunk.endpoints_count || 1;

    if (scannedCount > 0 && totalCount > 0) {
      return Math.round((scannedCount / totalCount) * 100);
    }

    return chunk.progress || 0;
  };

  const actualProgress = calculateProgress();

  return (
    <div className={`bg-gray-700 rounded-lg p-4 border ${getStatusColor(chunk.status)}`}>
      {/* Header */}
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
}

/**
 * Simple loading spinner component
 */
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <svg className={`animate-spin ${sizeClasses} inline-block`} viewBox="0 0 24 24">
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

export default ScanProgressTracker;
