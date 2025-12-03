"use client";

import { useState, useEffect } from 'react';
import { useScanResultsState } from '@/app/cedar-os/scanState';
import { useCedarStore } from 'cedar-os';
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { scannerApi } from '@/lib/scannerApi';

interface Scan {
  scan_id: string;
  created_at: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_findings?: number;
  critical_count?: number;
  high_count?: number;
}

interface ScanSelectorProps {
  onScanLoaded?: (scanId: string) => void;
}

export function ScanSelector({ onScanLoaded }: ScanSelectorProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingScans, setLoadingScans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string>('');

  const { scanResults, setScanResults } = useScanResultsState();
  const addContextEntry = useCedarStore(s => s.addContextEntry);

  // Fetch list of available scans
  useEffect(() => {
    fetchScans();

    // Check localStorage for last scan ID
    const lastScanId = localStorage.getItem('lastScanId');
    if (lastScanId) {
      setSelectedScanId(lastScanId);
    }
  }, []);

  const fetchScans = async () => {
    setLoadingScans(true);
    setError(null);

    try {
      // Use authenticated API client
      const data = await scannerApi.listScans(20, 0);
      setScans(data.scans || []);
    } catch (err) {
      console.error('Error fetching scans:', err);

      // Fallback: If API call fails, check localStorage
      const storedScanId = localStorage.getItem('lastScanId');
      if (storedScanId) {
        setScans([{
          scan_id: storedScanId,
          created_at: new Date().toISOString(),
          status: 'completed',
        }]);
        setError('Using cached scan ID. Full scan history not available yet.');
      } else {
        setError('No scans available. Run a scan from the /security page first.');
      }
    } finally {
      setLoadingScans(false);
    }
  };

  const loadScan = async (scanId: string) => {
    if (!scanId) {
      setError('Please select a scan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use authenticated API client
      const data = await scannerApi.getFindings(scanId);

      // Transform to our state format
      const findings = data.findings.map((f: any, index: number) => ({
        id: f.id || `${scanId}-${index}`,
        rule: f.rule,
        title: f.title,
        severity: f.severity,
        score: f.score,
        endpoint: f.endpoint,
        method: f.method,
        description: f.description,
        scanner: f.scanner || 'ventiapi',
        scanner_description: f.scanner_description || '',
        evidence: f.evidence || {},
        exploit_available: f.exploit_available,
      }));

      // Group by endpoint
      const groupedByEndpoint: Record<string, any[]> = {};
      findings.forEach((finding: any) => {
        const key = `${finding.method} ${finding.endpoint}`;
        if (!groupedByEndpoint[key]) {
          groupedByEndpoint[key] = [];
        }
        groupedByEndpoint[key].push(finding);
      });

      // Calculate summary
      const summary = {
        total: findings.length,
        critical: findings.filter((f: any) => f.severity === 'Critical').length,
        high: findings.filter((f: any) => f.severity === 'High').length,
        medium: findings.filter((f: any) => f.severity === 'Medium').length,
        low: findings.filter((f: any) => f.severity === 'Low').length,
      };

      const scanState = {
        scanId,
        findings,
        scanDate: data.scan_date || new Date().toISOString(),
        apiBaseUrl: data.api_base_url || 'Unknown',
        status: 'completed' as const,
        summary,
        groupedByEndpoint,
      };

      setScanResults(scanState);
      localStorage.setItem('lastScanId', scanId);

      // Auto-add scan ID to Cedar context
      addContextEntry(`scan-${scanId}`, {
        id: `scan-${scanId}`,
        source: 'manual',
        data: {
          scanId,
          summary,
          scanDate: scanState.scanDate,
        },
        metadata: {
          label: `🔍 Scan ${scanId.slice(0, 8)}...`,
          icon: '🔍',
          color: '#3B82F6',
          showInChat: true,
        },
      });

      onScanLoaded?.(scanId);
    } catch (err) {
      console.error('Error loading scan:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scan results');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadClick = () => {
    if (selectedScanId) {
      loadScan(selectedScanId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Scan Selection</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {scanResults
              ? `Currently viewing: ${scanResults.scanId.slice(0, 12)}... (${scanResults.summary.total} findings)`
              : 'Select a scan to view results'}
          </p>
        </div>
        <button
          onClick={fetchScans}
          disabled={loadingScans}
          className="p-2 hover:bg-accent rounded-md transition-colors"
          title="Refresh scan list"
        >
          <RefreshCw className={`h-4 w-4 ${loadingScans ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={selectedScanId}
          onChange={(e) => setSelectedScanId(e.target.value)}
          className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={loading || loadingScans}
        >
          <option value="">-- Select a scan --</option>
          {scans.map((scan) => (
            <option key={scan.scan_id} value={scan.scan_id}>
              {scan.scan_id.slice(0, 12)}... - {formatDate(scan.created_at)}
              {scan.total_findings !== undefined && ` (${scan.total_findings} findings)`}
            </option>
          ))}
        </select>

        <button
          onClick={handleLoadClick}
          disabled={!selectedScanId || loading}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>Load Scan</>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-xs text-destructive">{error}</p>
          {error.includes('Run a scan') && (
            <a
              href="/security"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Go to Security page to run a scan →
            </a>
          )}
        </div>
      )}

      {scanResults && !loading && (
        <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-md">
          <div className="flex items-center gap-2 text-xs text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Scan loaded successfully: {scanResults.summary.total} findings
              ({scanResults.summary.critical} critical, {scanResults.summary.high} high)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
