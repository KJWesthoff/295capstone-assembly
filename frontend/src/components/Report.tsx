import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { scannerApi, Finding } from '../api/scannerApi';
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
      return data && (data.status === 'completed' || data.status === 'failed') ? false : 2000;
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
        <h3>Scan in Progress</h3>
        <div className="progress-info">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${scanStatus.progress}%` }}
            ></div>
          </div>
          <p>Progress: {scanStatus.progress}%</p>
          {scanStatus.current_probe && (
            <p>Current probe: {scanStatus.current_probe}</p>
          )}
          <p>Findings so far: {scanStatus.findings_count}</p>
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

  const summary = {
    total: findingsData?.total || 0,
    critical: getSeverityCount('critical'),
    high: getSeverityCount('high'),
    medium: getSeverityCount('medium'),
    low: getSeverityCount('low')
  };
  const getSeverityClass = (severity: string) => {
    return `severity-${severity}`;
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
                  <h4>{vuln.type}</h4>
                  <span className="endpoint">{vuln.endpoint}</span>
                </div>
                <p className="vulnerability-description">{vuln.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Report;