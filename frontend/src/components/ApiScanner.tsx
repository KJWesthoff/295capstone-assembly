import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { scannerApi } from '../api/scannerApi';
import './ApiScanner.css';

interface ApiScannerProps {
  onScanStarted: (scanId: string) => void;
}

const ApiScanner: React.FC<ApiScannerProps> = ({ onScanStarted }) => {
  const [url, setUrl] = useState('');
  const [apiSpec, setApiSpec] = useState('');
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [useFile, setUseFile] = useState(false);
  const [selectedScanner, setSelectedScanner] = useState('venti-api');
  const [maxRequests, setMaxRequests] = useState(100);
  const [requestsPerSecond, setRequestsPerSecond] = useState(1.0);
  const [dangerousMode, setDangerousMode] = useState(false);
  const [fuzzAuth, setFuzzAuth] = useState(false);

  // Fetch available scanners
  const { data: scannersData, isLoading: scannersLoading } = useQuery({
    queryKey: ['scanners'],
    queryFn: scannerApi.getAvailableScanners,
  });

  const startScanMutation = useMutation({
    mutationFn: ({ request, file }: { request: any; file?: File }) => 
      scannerApi.startScan(request, file),
    onSuccess: (data) => {
      onScanStarted(data.scan_id);
      // Keep form values populated for convenience
      // User can manually clear or start a new scan if needed
    },
    onError: (error) => {
      console.error('Failed to start scan:', error);
      alert('Failed to start scan. Please try again.');
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSpecFile(file);
      setUseFile(true);
    }
  };

  const handleNewScan = () => {
    setUrl('');
    setApiSpec('');
    setSpecFile(null);
    setUseFile(false);
    setSelectedScanner('venti-api');
    setMaxRequests(100);
    setRequestsPerSecond(1.0);
    setDangerousMode(false);
    setFuzzAuth(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!url) {
      alert('Please provide an API base URL');
      return;
    }

    if (!useFile && !apiSpec) {
      alert('Please provide an API specification or upload a file');
      return;
    }

    if (useFile && !specFile) {
      alert('Please select a spec file');
      return;
    }

    const request = {
      server_url: url,
      target_url: url,
      ...(useFile ? {} : { spec_url: apiSpec }),
      scanner_type: selectedScanner,
      requests_per_second: requestsPerSecond,
      max_requests: maxRequests,
      dangerous_mode: dangerousMode,
      fuzz_auth: fuzzAuth
    };

    startScanMutation.mutate({ 
      request, 
      file: useFile ? specFile! : undefined 
    });
  };

  return (
    <div className="api-scanner">
      <div className="scanner-card">
        <h2>Configure API Scan</h2>
        <form onSubmit={handleSubmit} className="scanner-form">
          <div className="form-group">
            <label htmlFor="api-url">API Base URL</label>
            <input
              id="api-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com"
              required
              disabled={startScanMutation.isPending}
            />
          </div>

          <div className="form-group">
            <label htmlFor="scanner-type">Scanner Type</label>
            <select
              id="scanner-type"
              value={selectedScanner}
              onChange={(e) => setSelectedScanner(e.target.value)}
              disabled={startScanMutation.isPending || scannersLoading}
            >
              {scannersLoading ? (
                <option>Loading scanners...</option>
              ) : (
                scannersData?.scanners.map((scanner) => (
                  <option key={scanner.type} value={scanner.type}>
                    {scanner.display_name || scanner.name} 
                    {scanner.healthy !== undefined && !scanner.healthy && ' (Offline)'}
                  </option>
                ))
              )}
            </select>
            {scannersData && scannersData.scanners.find(s => s.type === selectedScanner)?.capabilities && (
              <div className="scanner-info">
                <small>
                  {scannersData.scanners.find(s => s.type === selectedScanner)?.capabilities?.description}
                </small>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>API Specification Method</label>
            <div className="method-selection">
              <label>
                <input
                  type="radio"
                  checked={!useFile}
                  onChange={() => setUseFile(false)}
                  disabled={startScanMutation.isPending}
                />
                Paste Specification
              </label>
              <label>
                <input
                  type="radio"
                  checked={useFile}
                  onChange={() => setUseFile(true)}
                  disabled={startScanMutation.isPending}
                />
                Upload File
              </label>
            </div>
          </div>

          {useFile ? (
            <div className="form-group">
              <label htmlFor="spec-file">Upload OpenAPI/Swagger File</label>
              <input
                id="spec-file"
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
                disabled={startScanMutation.isPending}
              />
              {specFile && (
                <span className="file-name">Selected: {specFile.name}</span>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="api-spec">API Specification</label>
              <textarea
                id="api-spec"
                value={apiSpec}
                onChange={(e) => setApiSpec(e.target.value)}
                placeholder="Paste your OpenAPI/Swagger specification here..."
                rows={8}
                disabled={startScanMutation.isPending}
              />
            </div>
          )}

          <div className="form-group advanced-options">
            <h3>Advanced Options</h3>
            <div className="options-grid">
              <div className="option-item">
                <label htmlFor="max-requests">Max Requests</label>
                <input
                  id="max-requests"
                  type="number"
                  value={maxRequests}
                  onChange={(e) => setMaxRequests(parseInt(e.target.value))}
                  min="1"
                  max="10000"
                  disabled={startScanMutation.isPending}
                />
              </div>
              <div className="option-item">
                <label htmlFor="requests-per-second">Requests/Second</label>
                <input
                  id="requests-per-second"
                  type="number"
                  value={requestsPerSecond}
                  onChange={(e) => setRequestsPerSecond(parseFloat(e.target.value))}
                  min="0.1"
                  max="10"
                  step="0.1"
                  disabled={startScanMutation.isPending}
                />
              </div>
            </div>
            <div className="checkbox-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fuzzAuth}
                  onChange={(e) => setFuzzAuth(e.target.checked)}
                  disabled={startScanMutation.isPending}
                />
                Enable Authentication Fuzzing
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={dangerousMode}
                  onChange={(e) => setDangerousMode(e.target.checked)}
                  disabled={startScanMutation.isPending}
                />
                Enable Dangerous Mode (Admin Only)
              </label>
            </div>
          </div>

          <div className="button-group">
            <button
              type="submit"
              className={`scan-button ${startScanMutation.isPending ? 'loading' : ''}`}
              disabled={!url || (!useFile && !apiSpec) || (useFile && !specFile) || startScanMutation.isPending}
            >
              {startScanMutation.isPending ? (
                <>
                  <div className="spinner"></div>
                  Starting Scan...
                </>
              ) : (
                'Start Security Scan'
              )}
            </button>
            
            <button
              type="button"
              className="new-scan-button"
              onClick={handleNewScan}
              disabled={startScanMutation.isPending}
            >
              New Scan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiScanner;