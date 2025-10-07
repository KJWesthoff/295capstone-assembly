// Scanner API Client for Cedar Frontend
// Connects to your existing Python scanner service

import { ensureScannerAuth, getScannerAuthHeader } from './scannerAuth';

const SCANNER_SERVICE_URL = process.env.NEXT_PUBLIC_SCANNER_SERVICE_URL || 'http://localhost:8000';

export interface ScanRequest {
  serverUrl: string;
  specUrl?: string;
  specFile?: File;
  scanners: string[];
  dangerous: boolean;
  fuzzAuth: boolean;
  rps?: number;
  maxRequests?: number;
}

export interface ScanResponse {
  scan_id: string;
  status: string;
  message?: string;
}

export interface ChunkStatus {
  chunk_id: string;
  scanner?: string;
  status: 'preparing' | 'starting' | 'running' | 'completed' | 'failed';
  endpoints_count: number;
  endpoints: string[];
  current_endpoint?: string;
  progress: number;
  error?: string;
  scanner_description?: string;
  scan_type?: string;
  total_endpoints?: number;
  scanned_endpoints?: string[];
}

export interface ScanStatus {
  scan_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_probe?: string;
  findings_count: number;
  created_at: string;
  completed_at?: string;
  error?: string;
  total_chunks?: number;
  completed_chunks?: number;
  parallel_mode?: boolean;
  chunk_status?: ChunkStatus[];
  current_phase?: string;
}

export interface Finding {
  rule: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
  endpoint: string;
  method: string;
  description: string;
  evidence?: any;
  scanner?: string;
  scanner_description?: string;
}

export interface FindingsResponse {
  findings: Finding[];
  total: number;
}

export class ScannerApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = SCANNER_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Start a new security scan
   */
  async startScan(config: ScanRequest): Promise<ScanResponse> {
    // Ensure we're authenticated before making the request
    const authenticated = await ensureScannerAuth();
    if (!authenticated) {
      throw new Error('Failed to authenticate with scanner service');
    }

    const formData = new FormData();

    // Add basic parameters
    formData.append('server_url', config.serverUrl);
    formData.append('target_url', config.specUrl || config.serverUrl);
    formData.append('rps', (config.rps || 1.0).toString());
    formData.append('max_requests', (config.maxRequests || 100).toString());
    
    if (config.dangerous) {
      formData.append('dangerous', 'true');
    }
    
    if (config.fuzzAuth) {
      formData.append('fuzz_auth', 'true');
    }

    // Add scanners
    if (config.scanners.length > 0) {
      formData.append('scanners', config.scanners.join(','));
    }

    // Add spec file if provided
    if (config.specFile) {
      formData.append('spec_file', config.specFile);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/scan/start`, {
        method: 'POST',
        headers: {
          ...getScannerAuthHeader(),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to start scan: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error starting scan:', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Scanner service is not running. Please start it with: ./start-scanner-service.sh');
      }
      throw error;
    }
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string): Promise<ScanStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan/${scanId}/status`, {
        headers: {
          ...getScannerAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get scan status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting scan status:', error);
      throw error;
    }
  }

  /**
   * Get scan findings
   */
  async getFindings(scanId: string): Promise<FindingsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan/${scanId}/findings`, {
        headers: {
          ...getScannerAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get findings: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting findings:', error);
      throw error;
    }
  }

  /**
   * Get available scanners
   */
  async getAvailableScanners(): Promise<{
    available_scanners: string[];
    descriptions: Record<string, string>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scanners`, {
        headers: {
          ...getScannerAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get scanners: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error getting scanners:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const scannerApi = new ScannerApiClient();

