/**
 * Scanner Components
 *
 * Reusable components for security scanning functionality.
 * These components can be embedded in any dashboard view.
 *
 * Components:
 * - ScanLauncher: Button + dialog to start new scans
 * - ScanProgressTracker: Real-time scan progress display
 * - ScanSelector: Dropdown to select existing scans from DB
 *
 * Hook:
 * - useScanManager: Centralized scan state management
 *
 * Usage Example:
 * ```tsx
 * import {
 *   ScanLauncher,
 *   ScanProgressTracker,
 *   ScanSelector,
 * } from '@/components/scanner';
 * import { useScanManager } from '@/hooks/useScanManager';
 *
 * function MyDashboard() {
 *   const {
 *     isScanning,
 *     currentScanStatus,
 *     scans,
 *     selectedScanId,
 *     startScan,
 *     selectScan,
 *     isLoadingScans,
 *     refreshScans,
 *     isRunning,
 *   } = useScanManager();
 *
 *   return (
 *     <div>
 *       <ScanLauncher
 *         onStartScan={startScan}
 *         isScanning={isScanning}
 *       />
 *
 *       {isRunning && (
 *         <ScanProgressTracker
 *           scanStatus={currentScanStatus}
 *           scanId={activeScanId}
 *         />
 *       )}
 *
 *       <ScanSelector
 *         scans={scans}
 *         selectedScanId={selectedScanId}
 *         onSelectScan={selectScan}
 *         isLoading={isLoadingScans}
 *         onRefresh={refreshScans}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

export { ScanLauncher } from './ScanLauncher';
export { ScanProgressTracker } from './ScanProgressTracker';
export { ScanSelector } from './ScanSelector';

// Re-export types from ScanConfigDialog for convenience
export type { ScanConfig } from '@/components/security/ScanConfigDialog';
