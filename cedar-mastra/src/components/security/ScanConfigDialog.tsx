'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { scannerApi } from '@/lib/scannerApi';

export interface ScanConfig {
  serverUrl: string;
  specUrl?: string;
  specFile?: File;
  scanners: string[];
  dangerous: boolean;
  fuzzAuth: boolean;
  rps?: number;
  maxRequests?: number;
}

interface ScanConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: ScanConfig) => void;
  isLoading?: boolean;
}

export function ScanConfigDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: ScanConfigDialogProps) {
  const [serverUrl, setServerUrl] = useState('https://dbfpcim2pg.us-west-2.awsapprunner.com/');
  const [specUrl, setSpecUrl] = useState('');
  const [specFile, setSpecFile] = useState<File | undefined>();
  const [selectedScanners, setSelectedScanners] = useState<string[]>(['ventiapi']);
  const [dangerous, setDangerous] = useState(false);
  const [fuzzAuth, setFuzzAuth] = useState(false);
  const [rps, setRps] = useState(1.0);
  const [maxRequests, setMaxRequests] = useState(100);
  const [availableScanners, setAvailableScanners] = useState<Record<string, string>>({});

  // Load available scanners on mount
  useEffect(() => {
    async function loadScanners() {
      try {
        const response = await scannerApi.getAvailableScanners();
        setAvailableScanners(response.descriptions);
      } catch (error) {
        console.error('Failed to load scanners:', error);
        // Use defaults if API fails
        setAvailableScanners({
          ventiapi: 'VentiAPI - OWASP API Security Top 10 focused scanner',
          zap: 'OWASP ZAP - Comprehensive web application security scanner',
        });
      }
    }
    if (isOpen) {
      loadScanners();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!serverUrl) {
      alert('Please provide a server URL');
      return;
    }

    if (selectedScanners.length === 0) {
      alert('Please select at least one scanner');
      return;
    }

    onSubmit({
      serverUrl,
      specUrl: specUrl || undefined,
      specFile,
      scanners: selectedScanners,
      dangerous,
      fuzzAuth,
      rps,
      maxRequests,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSpecFile(e.target.files[0]);
      setSpecUrl(''); // Clear spec URL if file is selected
    }
  };

  const toggleScanner = (scanner: string) => {
    setSelectedScanners(prev =>
      prev.includes(scanner)
        ? prev.filter(s => s !== scanner)
        : [...prev, scanner]
    );
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50">
          <Dialog.Title className="text-2xl font-bold text-white mb-4">
            Configure Security Scan
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Server URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Server URL *
              </label>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
              <p className="text-xs text-gray-400 mt-1">
                The base URL of the API to scan
              </p>
            </div>

            {/* OpenAPI Spec */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                OpenAPI Specification (Optional)
              </label>

              {/* Spec URL */}
              <input
                type="url"
                value={specUrl}
                onChange={(e) => {
                  setSpecUrl(e.target.value);
                  if (e.target.value) setSpecFile(undefined);
                }}
                placeholder="https://api.example.com/openapi.json"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                disabled={isLoading || !!specFile}
              />

              {/* OR divider */}
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t border-gray-600"></div>
                <span className="text-gray-400 text-xs">OR</span>
                <div className="flex-1 border-t border-gray-600"></div>
              </div>

              {/* File upload */}
              <input
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                disabled={isLoading || !!specUrl}
              />
              {specFile && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ File selected: {specFile.name}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Provide URL or upload OpenAPI spec file (JSON/YAML)
              </p>
            </div>

            {/* Scanner Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Scanners *
              </label>
              <div className="space-y-2">
                {Object.entries(availableScanners).map(([scanner, description]) => (
                  <label
                    key={scanner}
                    className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScanners.includes(scanner)}
                      onChange={() => toggleScanner(scanner)}
                      disabled={isLoading}
                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white capitalize">{scanner}</div>
                      <div className="text-xs text-gray-400">{description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Advanced Options */}
            <details className="bg-gray-700 rounded-lg border border-gray-600 p-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white">
                Advanced Options
              </summary>
              <div className="mt-4 space-y-4">
                {/* Rate Limiting */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Requests per Second: {rps}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.5"
                    value={rps}
                    onChange={(e) => setRps(parseFloat(e.target.value))}
                    disabled={isLoading}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Lower values are safer for production APIs
                  </p>
                </div>

                {/* Max Requests */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Requests
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={maxRequests}
                    onChange={(e) => setMaxRequests(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                {/* Checkboxes */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fuzzAuth}
                    onChange={(e) => setFuzzAuth(e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">
                    Fuzz Authentication
                    <span className="text-xs text-gray-400 ml-2">
                      (Test auth bypass techniques)
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dangerous}
                    onChange={(e) => setDangerous(e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-300">
                    Enable Dangerous Tests
                    <span className="text-xs text-red-400 ml-2">
                      ⚠️ (May modify data - use only on test environments)
                    </span>
                  </span>
                </label>
              </div>
            </details>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Starting Scan...' : 'Start Scan'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
              disabled={isLoading}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
