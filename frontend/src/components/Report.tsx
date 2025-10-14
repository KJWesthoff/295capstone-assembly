import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { scannerApi, Finding } from '../api/scannerApi';
import ParallelScanProgress from './ParallelScanProgress';
import './Report.css';

interface ReportProps {
  scanId: string;
}

const Report: React.FC<ReportProps> = ({ scanId }) => {
  const { data: scanStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['scan-status', scanId],
    queryFn: () => scannerApi.getScanStatus(scanId),
    refetchInterval: (query) => {
      // Stop polling when scan is completed or failed
      const data = query.state.data;
      const shouldStop = data && (data.status === 'completed' || data.status === 'failed');
      if (data?.status !== 'completed' && data?.status !== 'failed') {
        const phase = data?.current_phase || 'initializing';
        const progress = data?.progress ?? 0;
        console.log(`[Scan ${scanId.slice(0,8)}] ${phase} - ${progress}%`);
      }
      return shouldStop ? false : 2000;
    },
    enabled: !!scanId
  });

  const { data: findingsData, isLoading: findingsLoading } = useQuery({
    queryKey: ['findings', scanId],
    queryFn: () => scannerApi.getFindings(scanId),
    enabled: !!scanId && scanStatus?.status === 'completed'
  });

  if (statusLoading) {
    return (
      <div className="report loading">
        <div className="loading-spinner"></div>
        <p>Loading scan status...</p>
      </div>
    );
  }

  if (!scanStatus) {
    return <div className="report error">Failed to load scan status</div>;
  }

  if (scanStatus.status === 'failed') {
    return (
      <div className="report error">
        <h3>Scan Failed</h3>
        <p>{scanStatus.error || 'Unknown error occurred'}</p>
      </div>
    );
  }

  if (scanStatus.status === 'pending' || scanStatus.status === 'running') {
    return (
      <div className="report scanning">
        <h3>🔍 Security Scan in Progress</h3>
        <ParallelScanProgress scanStatus={scanStatus} />
        
        {scanStatus.findings_count > 0 && (
          <div className="findings-preview">
            <h4>⚠️ Findings detected so far: {scanStatus.findings_count}</h4>
            <p>Detailed results will be available when the scan completes.</p>
          </div>
        )}
        
        <div className="scan-info">
          <p><strong>Scan ID:</strong> {scanId}</p>
          <p><strong>Started:</strong> {new Date(scanStatus.created_at).toLocaleString()}</p>
          {scanStatus.parallel_mode && (
            <p><strong>Mode:</strong> Parallel scanning with {scanStatus.total_chunks} containers</p>
          )}
        </div>
      </div>
    );
  }

  if (findingsLoading) {
    return (
      <div className="report loading">
        <div className="loading-spinner"></div>
        <p>Loading scan results...</p>
      </div>
    );
  }

  const getSeverityCount = (severity: string) => {
    if (!findingsData?.findings) return 0;
    return findingsData.findings.filter((f: Finding) => f.severity === severity).length;
  };

  const getScannerSummary = () => {
    if (!findingsData?.findings) return {};
    
    const scannerCounts: Record<string, { count: number; description: string }> = {};
    
    findingsData.findings.forEach((finding: Finding) => {
      const scanner = finding.scanner || 'unknown';
      if (!scannerCounts[scanner]) {
        scannerCounts[scanner] = {
          count: 0,
          description: finding.scanner_description || 'Unknown Scanner'
        };
      }
      scannerCounts[scanner].count++;
    });
    
    return scannerCounts;
  };

  const summary = {
    total: findingsData?.total || 0,
    critical: getSeverityCount('Critical'),
    high: getSeverityCount('High'),
    medium: getSeverityCount('Medium'),
    low: getSeverityCount('Low')
  };
  const getSeverityClass = (severity: string) => {
    return `severity-${severity.toLowerCase()}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const downloadReport = async () => {
    try {
      const htmlReport = await scannerApi.getReport(scanId);
      const dataUri = 'data:text/html;charset=utf-8,'+ encodeURIComponent(htmlReport);
      
      const exportFileDefaultName = `api-security-report-${scanId}.html`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('Failed to download report');
    }
  };

  return (
    <div className="report">
      <div className="report-header">
        <h2>Security Scan Report</h2>
        <div className="report-meta">
          <div className="meta-item">
            <strong>Scan ID:</strong> {scanId}
          </div>
          <div className="meta-item">
            <strong>Scan Date:</strong> {new Date(scanStatus.created_at).toLocaleString()}
          </div>
          <div className="meta-item">
            <strong>Status:</strong> {scanStatus.status}
          </div>
          {scanStatus.status === 'completed' && (
            <button onClick={downloadReport} className="download-btn">
              Download HTML Report
            </button>
          )}
        </div>
      </div>

      <div className="report-summary">
        <h3>Summary</h3>
        <div className="summary-grid">
          <div className="summary-item total">
            <div className="summary-number">{summary.total}</div>
            <div className="summary-label">Total Issues</div>
          </div>
          <div className="summary-item critical">
            <div className="summary-number">{summary.critical}</div>
            <div className="summary-label">Critical</div>
          </div>
          <div className="summary-item high">
            <div className="summary-number">{summary.high}</div>
            <div className="summary-label">High</div>
          </div>
          <div className="summary-item medium">
            <div className="summary-number">{summary.medium}</div>
            <div className="summary-label">Medium</div>
          </div>
          <div className="summary-item low">
            <div className="summary-number">{summary.low}</div>
            <div className="summary-label">Low</div>
          </div>
        </div>
      </div>

      {Object.keys(getScannerSummary()).length > 0 && (
        <div className="scanner-summary">
          <h3>Findings by Scanner</h3>
          <div className="scanner-summary-grid">
            {Object.entries(getScannerSummary()).map(([scanner, data]) => (
              <div key={scanner} className={`scanner-summary-item scanner-${scanner}`}>
                <div className="scanner-icon">
                  {scanner === 'ventiapi' ? '🔍' : scanner === 'zap' ? '🕷️' : '🛡️'}
                </div>
                <div className="scanner-info">
                  <div className="scanner-name">
                    {scanner === 'ventiapi' ? 'VentiAPI' : scanner === 'zap' ? 'OWASP ZAP' : scanner.toUpperCase()}
                  </div>
                  <div className="scanner-findings">{data.count} finding{data.count !== 1 ? 's' : ''}</div>
                  <div className="scanner-description">{data.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="vulnerabilities">
        <h3>Vulnerabilities Details</h3>
        {!findingsData?.findings || findingsData.findings.length === 0 ? (
          <div className="no-vulnerabilities">
            <div className="success-icon">✅</div>
            <p>No security vulnerabilities found!</p>
          </div>
        ) : (
          <div className="vulnerabilities-list">
            {findingsData.findings.map((vuln: Finding, index: number) => (
              <div key={index} className={`vulnerability-item ${getSeverityClass(vuln.severity)}`}>
                <div className="vulnerability-header">
                  <span className={`severity-badge ${getSeverityClass(vuln.severity)}`}>
                    {vuln.severity.toUpperCase()}
                  </span>
                  <h4>{vuln.title}</h4>
                  <span className="endpoint">{vuln.method} {vuln.endpoint}</span>
                  {vuln.scanner && (
                    <span className={`scanner-badge scanner-${vuln.scanner}`}>
                      {vuln.scanner === 'ventiapi' ? '🔍 VentiAPI' : vuln.scanner === 'zap' ? '🕷️ ZAP' : `🛡️ ${vuln.scanner}`}
                    </span>
                  )}
                </div>
                <p className="vulnerability-description">{vuln.description}</p>
                {vuln.scanner_description && (
                  <div className="scanner-attribution">
                    <strong>Identified by:</strong> {vuln.scanner_description}
                  </div>
                )}
                {vuln.rule && (
                  <div className="vulnerability-rule">
                    <strong>Rule:</strong> {vuln.rule} | <strong>Score:</strong> {vuln.score}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Report;