const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

// Helper function to get auth headers for FormData
const getAuthHeadersForFormData = (): HeadersInit => {
  const token = localStorage.getItem('jwt_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export interface ScanRequest {
  spec_url?: string;
  server_url: string;
  target_url: string;
  rps?: number;
  requests_per_second?: number;
  max_requests?: number;
  dangerous?: boolean;
  dangerous_mode?: boolean;
  fuzz_auth?: boolean;
  scanner_type?: string;
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
  rule: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
  endpoint: string;
  method: string;
  description: string;
  evidence?: any;
}

export interface FindingsResponse {
  findings: Finding[];
  total: number;
  nextOffset?: number;
}

export interface Scanner {
  type: string;
  name: string;
  display_name?: string;
  capabilities?: {
    description: string;
    supported_targets: string[];
    supported_formats: string[];
    parallel_capable: boolean;
    auth_capable: boolean;
    custom_headers: boolean;
  };
  healthy?: boolean;
}

export interface ScannersResponse {
  scanners: Scanner[];
  total_count: number;
}

export const scannerApi = {
  async getAvailableScanners(): Promise<ScannersResponse> {
    const response = await fetch(`${API_BASE_URL}/api/scanners`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get scanners: ${response.statusText}`);
    }

    return response.json();
  },
  async startScan(request: ScanRequest, specFile?: File): Promise<{ scan_id: string; status: string }> {
    const formData = new FormData();
    
    // Only append spec_file if it's actually provided and not empty
    if (specFile && specFile.size > 0) {
      formData.append('spec_file', specFile);
    }
    
    // Add new plugin API parameters
    formData.append('target_url', request.target_url || request.spec_url || request.server_url);
    formData.append('scanner_type', request.scanner_type || 'venti-api');
    if (request.max_requests) formData.append('max_requests', request.max_requests.toString());
    if (request.requests_per_second || request.rps) {
      formData.append('requests_per_second', (request.requests_per_second || request.rps)!.toString());
    }
    if (request.dangerous_mode || request.dangerous) formData.append('dangerous_mode', 'true');
    if (request.fuzz_auth) formData.append('fuzz_auth', 'true');

    const response = await fetch(`${API_BASE_URL}/api/scan/start`, {
      method: 'POST',
      headers: getAuthHeadersForFormData(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to start scan: ${response.statusText}`);
    }

    return response.json();
  },

  async getScanStatus(scanId: string): Promise<ScanStatus> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}/status`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get scan status: ${response.statusText}`);
    }

    return response.json();
  },

  async getFindings(scanId: string, offset: number = 0, limit: number = 50): Promise<FindingsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}/findings?offset=${offset}&limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  },

  async getReport(scanId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}/report`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get report: ${response.statusText}`);
    }

    return response.text();
  },

  async getAllScans(): Promise<Array<{scan_id: string; status: string; created_at: string; server_url: string}>> {
    const response = await fetch(`${API_BASE_URL}/api/scans`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get scans: ${response.statusText}`);
    }

    return response.json();
  },

  async deleteScan(scanId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/scan/${scanId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete scan: ${response.statusText}`);
    }
  }
};