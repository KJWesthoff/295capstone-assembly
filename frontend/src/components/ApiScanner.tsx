import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  const [dangerous, setDangerous] = useState(false);
  const [fuzzAuth, setFuzzAuth] = useState(false);

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
      ...(useFile ? {} : { spec_url: apiSpec }),
      rps: 1.0,
      max_requests: 100,
      dangerous: dangerous,
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

          <div className="form-group">
            <label>Advanced Security Testing Options</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={dangerous}
                  onChange={(e) => setDangerous(e.target.checked)}
                  disabled={startScanMutation.isPending}
                />
                <span className="checkbox-text">
                  <strong>Dangerous Tests</strong>
                  <span className="checkbox-description">
                    Enable destructive/invasive security tests that may modify data
                  </span>
                </span>
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fuzzAuth}
                  onChange={(e) => setFuzzAuth(e.target.checked)}
                  disabled={startScanMutation.isPending}
                />
                <span className="checkbox-text">
                  <strong>Authentication Fuzzing</strong>
                  <span className="checkbox-description">
                    Test authentication mechanisms with various attack vectors
                  </span>
                </span>
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