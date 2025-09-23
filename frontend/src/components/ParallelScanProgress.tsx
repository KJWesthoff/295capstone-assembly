import React from 'react';
import { ScanStatus, ChunkStatus } from '../api/scannerApi';
import './ParallelScanProgress.css';

interface ParallelScanProgressProps {
  scanStatus: ScanStatus;
}

const ParallelScanProgress: React.FC<ParallelScanProgressProps> = ({ scanStatus }) => {
  if (!scanStatus.parallel_mode) {
    // Single container scan - show simple progress
    return (
      <div className="single-scan-progress">
        <div className="scan-phase">
          <h4>🔍 {scanStatus.current_phase || 'Running security scan'}</h4>
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
        </div>
      </div>
    );
  }

  // Parallel scan - show detailed chunk progress
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'running';
      default: return 'pending';
    }
  };

  return (
    <div className="parallel-scan-progress">
      <div className="scan-overview">
        <h3>🔄 Parallel Security Scan</h3>
        <div className="overview-stats">
          <div className="stat-item">
            <span className="stat-label">Phase:</span>
            <span className="stat-value">{scanStatus.current_phase}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Containers:</span>
            <span className="stat-value">{scanStatus.total_chunks}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed:</span>
            <span className="stat-value">{scanStatus.completed_chunks || 0}/{scanStatus.total_chunks}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Findings:</span>
            <span className="stat-value">{scanStatus.findings_count}</span>
          </div>
        </div>
        
        <div className="overall-progress">
          <div className="progress-bar large">
            <div 
              className="progress-fill" 
              style={{ width: `${scanStatus.progress}%` }}
            ></div>
          </div>
          <span className="progress-text">{scanStatus.progress}%</span>
        </div>
      </div>

      {scanStatus.chunk_status && scanStatus.chunk_status.length > 0 && (
        <div className="chunks-grid">
          <h4>Scanner Containers</h4>
          <div className="chunks-list">
            {scanStatus.chunk_status.map((chunk: ChunkStatus, index: number) => (
              <div key={chunk.chunk_id} className={`chunk-item ${getStatusColor(chunk.status)}`}>
                <div className="chunk-header">
                  <div className="scanner-info">
                    <span className="scanner-icon">{getScannerIcon(chunk.scanner)}</span>
                    <span className="scanner-name">{getScannerDisplayName(chunk.scanner)}</span>
                    <span className="chunk-id">#{chunk.chunk_id}</span>
                  </div>
                  <span className="status-icon">{getStatusIcon(chunk.status)}</span>
                </div>

                <div className="scanner-details">
                  <div className="detail-item">
                    <span className="detail-label">Scanner Engine:</span>
                    <span className="detail-value">{getScannerDisplayName(chunk.scanner)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Target Endpoints:</span>
                    <span className="detail-value">{chunk.endpoints_count} endpoint{chunk.endpoints_count !== 1 ? 's' : ''}</span>
                  </div>
                  {chunk.endpoints && chunk.endpoints.length > 0 && (
                    <div className="endpoints-list">
                      <span className="detail-label">Endpoints:</span>
                      <div className="endpoint-tags">
                        {chunk.endpoints.map((endpoint, idx) => (
                          <span key={idx} className="endpoint-tag">{endpoint}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {chunk.current_endpoint && (
                  <div className="current-endpoint">
                    <span className="endpoint-label">Currently scanning:</span>
                    <span className="endpoint-path">{chunk.current_endpoint}</span>
                  </div>
                )}
                
                <div className="chunk-progress">
                  <div className="progress-bar small">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${chunk.progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-percentage">{chunk.progress}%</span>
                </div>
                
                <div className="chunk-status">
                  <span className={`status-badge ${getStatusColor(chunk.status)}`}>
                    {chunk.status}
                  </span>
                  {chunk.error && (
                    <span className="chunk-error" title={chunk.error}>
                      ⚠️ Error
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParallelScanProgress;