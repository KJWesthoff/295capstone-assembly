import { useCallback, useEffect, useRef, useState } from 'react';
import { scannerApi, ScanStatus } from '@/lib/scannerApi';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface UseScanResultsPollingOptions {
  scanId: string | null;
  enabled?: boolean;
  onCompleted: (scanId: string, findings: any[]) => Promise<void> | void;
  onFailed?: (message: string) => void;
}

export function useScanResultsPolling({ scanId, enabled = true, onCompleted, onFailed }: UseScanResultsPollingOptions) {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFinishedRef = useRef(false);

  // Use refs to avoid adding callbacks to useEffect dependencies
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef = useRef(onFailed);

  // Update refs when callbacks change
  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onFailedRef.current = onFailed;
  }, [onCompleted, onFailed]);

  const fetchFindingsWithRetry = useCallback(async (targetScanId: string, expectedCount: number) => {
    // Only retry if we expect findings but got none
    // If expectedCount is 0, just fetch once
    const maxAttempts = expectedCount > 0 ? 5 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await scannerApi.getFindings(targetScanId);
        const findings = response.findings ?? [];
        const hasFindings = findings.length > 0;
        const isFinalAttempt = attempt === maxAttempts;

        // Accept findings if:
        // 1. We have findings
        // 2. We don't expect any (expectedCount = 0)
        // 3. This is the final attempt
        if (hasFindings || expectedCount === 0 || isFinalAttempt) {
          if (expectedCount > 0 && findings.length === 0) {
            console.warn(`⚠️ Scan ${targetScanId} expected ${expectedCount} findings but got 0 after ${attempt} attempts`);
          } else if (findings.length > 0) {
            console.log(`✅ Fetched ${findings.length} findings for scan ${targetScanId}`);
          }
          return findings;
        }

        console.warn(`Scan ${targetScanId} findings not ready yet (attempt ${attempt}/${maxAttempts}). Retrying...`);
      } catch (attemptError) {
        if (attempt === maxAttempts) {
          throw attemptError;
        }
        console.error(`Attempt ${attempt} to fetch findings failed:`, attemptError);
      }

      // Wait before retrying (exponential backoff, max 6 seconds)
      await delay(Math.min(1500 * attempt, 6000));
    }

    return [];
  }, []);

  useEffect(() => {
    if (!scanId || !enabled) {
      setStatus(null);
      setIsPolling(false);
      setError(null);
      isFinishedRef.current = false;
      return;
    }

    let isCancelled = false;
    isFinishedRef.current = false;
    setIsPolling(true);
    setError(null);

    const poll = async () => {
      try {
        const nextStatus = await scannerApi.getScanStatus(scanId);
        if (isCancelled) return;

        setStatus(nextStatus);

        if (nextStatus.status === 'completed' && !isFinishedRef.current) {
          console.log(`[useScanResultsPolling] ✅ Scan completed, triggering onCompleted callback`);
          isFinishedRef.current = true;
          try {
            const expectedCount = nextStatus.findings_count ?? 0;
            console.log(`[useScanResultsPolling] Fetching findings (expected: ${expectedCount})...`);
            const findings = await fetchFindingsWithRetry(scanId, expectedCount);
            console.log(`[useScanResultsPolling] Got ${findings.length} findings, calling onCompleted...`);
            if (!isCancelled) {
              console.log(`[useScanResultsPolling] About to call onCompletedRef.current with scanId:`, scanId);
              const result = onCompletedRef.current(scanId, findings);
              console.log(`[useScanResultsPolling] onCompleted returned:`, result);
              await result;
              console.log(`[useScanResultsPolling] onCompleted finished successfully`);
              setIsPolling(false);
            }
          } catch (completionError) {
            console.error(`[useScanResultsPolling] ❌ Error in completion handler:`, completionError);
            const message = completionError instanceof Error ? completionError.message : String(completionError);
            if (!isCancelled) {
              setError(message);
              onFailedRef.current?.(message);
              setIsPolling(false);
            }
          }
        } else if (nextStatus.status === 'failed' && !isFinishedRef.current) {
          isFinishedRef.current = true;
          const message = nextStatus.error || 'Scan failed';
          setError(message);
          onFailedRef.current?.(message);
          setIsPolling(false);
        }
      } catch (pollError) {
        if (isCancelled) return;
        const message = pollError instanceof Error ? pollError.message : String(pollError);
        setError(message);
      }
    };

    poll();
    // Poll every 5 seconds (was 3 seconds - reduced load)
    const intervalId = setInterval(poll, 5000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [scanId, enabled, fetchFindingsWithRetry]); // Callbacks handled via refs

  return {
    status,
    isPolling,
    error,
  };
}
