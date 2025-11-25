// Hook for polling scan results with proper authentication
import { useEffect, useRef, useState } from 'react';
import { scannerApi, ScanStatus, Finding } from '@/lib/scannerApi';

interface UseScanResultsPollingProps {
  scanId: string | null;
  enabled: boolean;
  onCompleted?: (scanId: string, findings: Finding[]) => void;
  onFailed?: (message: string) => void;
  pollInterval?: number; // milliseconds
}

export function useScanResultsPolling({
  scanId,
  enabled,
  onCompleted,
  onFailed,
  pollInterval = 2000, // default 2 seconds
}: UseScanResultsPollingProps) {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);
  
  // Store callbacks in refs to prevent effect restarts when callbacks change
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);
  
  // Track previous values to detect actual changes
  const prevScanIdRef = useRef<string | null>(null);
  const prevEnabledRef = useRef<boolean>(false);

  // Update callback refs when they change (without triggering effect restart)
  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onFailedRef.current = onFailed;
  }, [onCompleted, onFailed]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Don't poll if disabled or no scanId
    if (!enabled || !scanId) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      isPollingRef.current = false;
      prevScanIdRef.current = scanId;
      prevEnabledRef.current = enabled;
      return;
    }

    // Check if scanId or enabled actually changed
    const scanIdChanged = prevScanIdRef.current !== scanId;
    const enabledChanged = prevEnabledRef.current !== enabled;
    
    // If scanId or enabled changed while polling, stop the old poll
    if ((scanIdChanged || enabledChanged) && isPollingRef.current && pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
      isPollingRef.current = false;
    }
    
    // Update previous values
    prevScanIdRef.current = scanId;
    prevEnabledRef.current = enabled;

    // If polling is already active and nothing actually changed, don't restart
    // (the polling loop will continue via setTimeout)
    if (isPollingRef.current && !scanIdChanged && !enabledChanged) {
      return;
    }

    const pollStatus = async () => {
      if (!scanId) return;

      try {
        isPollingRef.current = true;
        console.log('[useScanResultsPolling] Polling scan status for:', scanId);

        // Get scan status (this will auto-authenticate via ensureScannerAuth)
        const scanStatus = await scannerApi.getScanStatus(scanId);
        console.log('[useScanResultsPolling] Received status:', scanStatus.status, 'progress:', scanStatus.progress);
        console.log('[useScanResultsPolling] Full status object:', JSON.stringify(scanStatus, null, 2));

        setStatus(scanStatus);
        console.log('[useScanResultsPolling] Updated state with progress:', scanStatus.progress);
        setError(null);

        // Check if status changed from running to completed
        const statusChanged = lastStatusRef.current && lastStatusRef.current !== scanStatus.status;
        lastStatusRef.current = scanStatus.status;

        // If scan is completed or failed, fetch findings and call completion handler
        if (scanStatus.status === 'completed') {
          console.log('[useScanResultsPolling] Scan completed, fetching findings...');

          try {
            const findingsResponse = await scannerApi.getFindings(scanId);
            console.log('[useScanResultsPolling] Retrieved', findingsResponse.findings.length, 'findings');

            // Call completion callback using ref
            if (onCompletedRef.current) {
              onCompletedRef.current(scanId, findingsResponse.findings);
            }

            // Stop polling
            if (pollTimeoutRef.current) {
              clearTimeout(pollTimeoutRef.current);
              pollTimeoutRef.current = null;
            }
            isPollingRef.current = false;
          } catch (findingsError) {
            console.error('[useScanResultsPolling] Error fetching findings:', findingsError);
            const errorMessage = findingsError instanceof Error ? findingsError.message : 'Failed to fetch findings';
            setError(errorMessage);
            if (onFailedRef.current) {
              onFailedRef.current(errorMessage);
            }
            isPollingRef.current = false;
          }
        } else if (scanStatus.status === 'failed') {
          console.error('[useScanResultsPolling] Scan failed:', scanStatus.error || 'Unknown error');
          const errorMessage = scanStatus.error || 'Scan failed';
          setError(errorMessage);

          if (onFailedRef.current) {
            onFailedRef.current(errorMessage);
          }

          // Stop polling
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
          }
          isPollingRef.current = false;
        } else if (scanStatus.status === 'running' || scanStatus.status === 'pending') {
          // Continue polling
          pollTimeoutRef.current = setTimeout(pollStatus, pollInterval);
        }
      } catch (error) {
        console.error('[useScanResultsPolling] Error polling scan status:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to poll scan status';
        setError(errorMessage);

        // If it's a 404 error, the scan doesn't exist - stop polling and call onFailed
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          if (onFailedRef.current) {
            onFailedRef.current(errorMessage);
          }
          // Stop polling
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
          }
          isPollingRef.current = false;
        } else {
          // For other errors, retry after a delay
          pollTimeoutRef.current = setTimeout(pollStatus, pollInterval);
        }
      } finally {
        // Only set to false if we're not scheduling another poll
        if (!pollTimeoutRef.current) {
          isPollingRef.current = false;
        }
      }
    };

    // Start polling (we've already ensured we're not in a conflicting state)
    pollStatus();

    // Cleanup function
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [scanId, enabled, pollInterval]);

  return {
    status,
    error,
    isPolling: enabled && status?.status === 'running',
  };
}
