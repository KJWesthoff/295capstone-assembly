'use client';

import React, { useState } from 'react';
import { ScanConfigDialog, ScanConfig } from '@/components/security/ScanConfigDialog';

interface ScanLauncherProps {
  /** Callback when scan is submitted */
  onStartScan: (config: ScanConfig) => Promise<void>;
  /** Whether a scan is currently in progress */
  isScanning?: boolean;
  /** Custom button text */
  buttonText?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'compact';
  /** Custom class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * ScanLauncher - Button + Dialog combo for starting new security scans
 *
 * This component bundles the scan trigger button with the configuration dialog.
 * It handles showing/hiding the dialog and error handling.
 *
 * Usage:
 * ```tsx
 * const { startScan, isScanning } = useScanManager();
 *
 * <ScanLauncher
 *   onStartScan={startScan}
 *   isScanning={isScanning}
 * />
 * ```
 */
export function ScanLauncher({
  onStartScan,
  isScanning = false,
  buttonText = 'Run Security Scan',
  variant = 'primary',
  className = '',
  disabled = false,
}: ScanLauncherProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenDialog = () => {
    setError(null);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    if (!isScanning) {
      setShowDialog(false);
    }
  };

  const handleSubmit = async (config: ScanConfig) => {
    setError(null);
    try {
      await onStartScan(config);
      setShowDialog(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      // Keep dialog open so user can see the error
    }
  };

  const buttonClasses = {
    primary: 'bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-8 rounded-lg transition-colors',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors',
    compact: 'bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-md text-sm transition-colors',
  };

  return (
    <>
      <button
        onClick={handleOpenDialog}
        disabled={disabled || isScanning}
        className={`${buttonClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isScanning ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner />
            Starting Scan...
          </span>
        ) : (
          buttonText
        )}
      </button>

      <ScanConfigDialog
        isOpen={showDialog}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        isLoading={isScanning}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold mb-1">Failed to start scan</div>
              <div className="text-sm text-red-200">{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
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

export default ScanLauncher;
