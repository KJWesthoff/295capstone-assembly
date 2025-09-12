const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface ScanRequest {
  spec_url?: string;
  server_url: string;
  rps?: number;
  max_requests?: number;
  dangerous?: boolean;
  fuzz_auth?: boolean;
}

export interface ChunkStatus {
  chunk_id: string;
  status: 'preparing' | 'starting' | 'running' | 'completed' | 'failed';
  endpoints_count: number;
  endpoints: string[];
  current_endpoint?: string;
  progress: number;
  error?: string;
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
  // Enhanced parallel scanning info
  total_chunks?: number;
  completed_chunks?: number;
  parallel_mode?: boolean;
  chunk_status?: ChunkStatus[];
  current_phase?: string;
}

export interface Finding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  endpoint: string;
  details?: any;
}

export interface FindingsResponse {
  findings: Finding[];
  total: number;
  nextOffset?: number;
}

export const scannerApi = {
  async startScan(request: ScanRequest, specFile?: File): Promise<{ scan_id: string; status: string }> {
    const formData = new FormData();
    
    if (specFile) {
      formData.append('spec_file', specFile);
    }
    
    // Add other request parameters
    formData.append('server_url', request.server_url);
    if (request.spec_url) formData.append('spec_url', request.spec_url);
    if (request.rps) formData.append('rps', request.rps.toString());
    if (request.max_requests) formData.append('max_requests', request.max_requests.toString());
    if (request.dangerous) formData.append('dangerous', 'true');
    if (request.fuzz_auth) formData.append('fuzz_auth', 'true');

    const response = await fetch(`${API_BASE_URL}/api/scan/start`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to start scan: ${response.statusText}`);
    }

    return response.json();
  },

  async getScanStatus(scanId: string): Promise<ScanStatus> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}/status`);
    
    if (!response.ok) {
      throw new Error(`Failed to get scan status: ${response.statusText}`);
    }

    return response.json();
  },

  async getFindings(scanId: string, offset: number = 0, limit: number = 50): Promise<FindingsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}/findings?offset=${offset}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  },

  async getReport(scanId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}/report`);
    
    if (!response.ok) {
      throw new Error(`Failed to get report: ${response.statusText}`);
    }

    return response.text();
  },

  async getAllScans(): Promise<Array<{scan_id: string; status: string; created_at: string; server_url: string}>> {
    const response = await fetch(`${API_BASE_URL}/api/scans`);
    
    if (!response.ok) {
      throw new Error(`Failed to get scans: ${response.statusText}`);
    }

    return response.json();
  },

  async deleteScan(scanId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete scan: ${response.statusText}`);
    }
  }
};