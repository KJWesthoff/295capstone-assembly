'use client';

import React, { useState } from 'react';

interface ScanConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: ScanConfig) => void;
  isLoading?: boolean;
}

export interface ScanConfig {
  serverUrl: string;
  specUrl?: string;
  specFile?: File;
  scanners: string[];
  dangerous: boolean;
  fuzzAuth: boolean;
  useFile: boolean;
}

const AVAILABLE_SCANNERS = [
  {
    id: 'ventiapi',
    name: 'VentiAPI',
    description: 'OWASP API Security Top 10 focused scanner',
  },
  {
    id: 'zap',
    name: 'OWASP ZAP',
    description: 'Comprehensive web application security scanner',
  },
  // Nikto scanner not yet implemented in backend
  // {
  //   id: 'nikto',
  //   name: 'Nikto',
  //   description: 'Web server vulnerability scanner',
  // },
];

export function ScanConfigDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: ScanConfigDialogProps) {
  const [config, setConfig] = useState<ScanConfig>({
    serverUrl: '',
    specUrl: '',
    scanners: ['ventiapi'],
    dangerous: false,
    fuzzAuth: false,
    useFile: false,
  });

  const [specFile, setSpecFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!config.serverUrl) {
      alert('Please provide an API base URL');
      return;
    }

    if (!config.useFile && !config.specUrl) {
      alert('Please provide an API specification or upload a file');
      return;
    }

    if (config.scanners.length === 0) {
      alert('Please select at least one scanner');
      return;
    }

    onSubmit({
      ...config,
      specFile: config.useFile ? specFile || undefined : undefined,
    });
  };

  const toggleScanner = (scannerId: string) => {
    setConfig(prev => ({
      ...prev,
      scanners: prev.scanners.includes(scannerId)
        ? prev.scanners.filter(s => s !== scannerId)
        : [...prev.scanners, scannerId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Configure Security Scan</h2>
              <p className="text-gray-400 text-sm mt-1">
                Set up your API security scan parameters
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isLoading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* API Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Base URL *
            </label>
            <input
              type="url"
              value={config.serverUrl}
              onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
              placeholder="https://api.example.com"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          {/* Spec Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Specification Method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!config.useFile}
                  onChange={() => setConfig({ ...config, useFile: false })}
                  className="text-blue-500"
                  disabled={isLoading}
                />
                <span className="text-gray-300">Paste Specification URL</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={config.useFile}
                  onChange={() => setConfig({ ...config, useFile: true })}
                  className="text-blue-500"
                  disabled={isLoading}
                />
                <span className="text-gray-300">Upload File</span>
              </label>
            </div>
          </div>

          {/* Spec URL or File Upload */}
          {!config.useFile ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                OpenAPI/Swagger Specification URL
              </label>
              <input
                type="url"
                value={config.specUrl || ''}
                onChange={(e) => setConfig({ ...config, specUrl: e.target.value })}
                placeholder="https://api.example.com/openapi.json"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload OpenAPI/Swagger File
              </label>
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={(e) => setSpecFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
                disabled={isLoading}
              />
              {specFile && (
                <p className="text-sm text-gray-400 mt-2">Selected: {specFile.name}</p>
              )}
            </div>
          )}

          {/* Scanner Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Scanner Engines *
            </label>
            <div className="space-y-2">
              {AVAILABLE_SCANNERS.filter(scanner => scanner && scanner.id).map((scanner) => (
                <label
                  key={scanner.id}
                  className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={config.scanners.includes(scanner.id)}
                    onChange={() => toggleScanner(scanner.id)}
                    className="mt-1"
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-white">{scanner.name}</div>
                    <div className="text-sm text-gray-400">{scanner.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Advanced Security Testing Options
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.dangerous}
                  onChange={(e) => setConfig({ ...config, dangerous: e.target.checked })}
                  className="mt-1"
                  disabled={isLoading}
                />
                <div className="flex-1">
                  <div className="font-medium text-white">Dangerous Tests</div>
                  <div className="text-sm text-gray-400">
                    Enable destructive/invasive security tests that may modify data
                  </div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.fuzzAuth}
                  onChange={(e) => setConfig({ ...config, fuzzAuth: e.target.checked })}
                  className="mt-1"
                  disabled={isLoading}
                />
                <div className="flex-1">
                  <div className="font-medium text-white">Authentication Fuzzing</div>
                  <div className="text-sm text-gray-400">
                    Test authentication mechanisms with various attack vectors
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Starting Scan...
                </span>
              ) : (
                'Start Security Scan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

