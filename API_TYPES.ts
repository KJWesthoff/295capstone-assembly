/**
 * VentiAPI Scanner - TypeScript API Types
 *
 * Complete type definitions for Scanner API and Mastra AI Backend.
 * Import these into your Lovable frontend for full type safety.
 *
 * Usage:
 *   import type { ScanRequest, ScanResponse, Finding } from './API_TYPES';
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  username: string;
  role: 'admin' | 'user';
}

export interface UserResponse {
  username: string;
  role: 'admin' | 'user';
}

// ============================================================================
// Scan Types
// ============================================================================

export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ScannerType = 'ventiapi' | 'zap' | 'nikto';

export interface ScanRequest {
  /** OpenAPI spec file (if not using spec_url) */
  file?: File;
  /** URL to OpenAPI spec (if not using file) */
  spec_url?: string;
  /** Base URL of the API to scan */
  target_url: string;
  /** Enable destructive tests (default: false) */
  dangerous_mode?: boolean;
  /** Test authentication bypass vulnerabilities (default: false) */
  fuzz_auth?: boolean;
  /** Maximum number of requests (default: 1000) */
  max_requests?: number;
  /** Use parallel scanning (default: true) */
  parallel_mode?: boolean;
  /** Scanner engines to use (default: ['ventiapi']) */
  scanners?: ScannerType[];
}

export interface ScanResponse {
  scan_id: string;
  status: ScanStatus;
}

export interface ChunkStatus {
  chunk_id: number;
  status: ScanStatus;
  findings_count: number;
  error?: string;
}

export interface QueueStats {
  queue_length: number;
  active_workers: number;
  processing_workers: number;
  waiting_workers: number;
}

export interface ScanStatusResponse {
  scan_id: string;
  status: ScanStatus;
  progress: number; // 0-100
  current_phase: string;
  findings_count: number;
  parallel_mode: boolean;
  total_chunks: number;
  chunk_status: ChunkStatus[];
  job_ids: string[];
  queue_stats: QueueStats;
  error?: string;
}

export interface Finding {
  /** Severity level of the finding */
  severity: Severity;
  /** Short title of the vulnerability */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected endpoint path */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Evidence/proof of the vulnerability */
  evidence: string;
  /** Remediation guidance */
  remediation: string;
  /** CWE identifier */
  cwe_id?: string;
  /** OWASP API Security Top 10 category */
  owasp_category?: string;
  /** Scanner that found this vulnerability */
  scanner: ScannerType;
  /** CVE references */
  cve_references?: string[];
  /** CVSS score */
  cvss_score?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface FindingsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface FindingsResponse {
  scan_id: string;
  findings: Finding[];
  summary: FindingsSummary;
}

export interface ScanMetadata {
  scan_id: string;
  status: ScanStatus;
  created_at: string; // ISO 8601 timestamp
  completed_at?: string;
  target_url: string;
  findings_count: number;
  scanners_used: ScannerType[];
  dangerous_mode: boolean;
  fuzz_auth: boolean;
  parallel_mode: boolean;
}

export interface ScanReport {
  metadata: ScanMetadata;
  findings: Finding[];
  summary: FindingsSummary;
  owasp_mapping: {
    [category: string]: Finding[];
  };
  cwe_mapping: {
    [cwe_id: string]: Finding[];
  };
}

export interface ScanListItem {
  scan_id: string;
  status: ScanStatus;
  created_at: string;
  target_url: string;
  findings_count: number;
}

// ============================================================================
// Scanner Configuration Types
// ============================================================================

export interface ScannerInfo {
  name: ScannerType;
  description: string;
  supported_tests: string[];
  enabled: boolean;
}

export interface AvailableScannersResponse {
  scanners: ScannerInfo[];
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  queue_stats: QueueStats;
}

// ============================================================================
// Mastra AI Backend Types
// ============================================================================

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  /** User's message/prompt */
  prompt: string;
  /** Temperature for LLM (0.0-1.0, default: 0.7) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** System prompt override */
  systemPrompt?: string;
  /** Resource ID (user ID) for thread association */
  resourceId?: string;
  /** Existing thread ID to continue conversation */
  threadId?: string;
  /** Additional context (scan results, vulnerabilities, etc.) */
  additionalContext?: Record<string, any>;
}

export interface ChatResponse {
  /** AI-generated response */
  response: string;
  /** Thread ID for conversation continuity */
  threadId: string;
}

export interface StreamEvent {
  type: 'token' | 'done' | 'error';
  content?: string;
  error?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface APIError {
  detail: string;
  status_code: number;
}

// ============================================================================
// API Client Configuration
// ============================================================================

export interface APIConfig {
  /** Base URL for Scanner API */
  scannerBaseUrl: string;
  /** Base URL for Mastra AI */
  mastraBaseUrl: string;
  /** JWT token for authentication */
  accessToken?: string;
}

// ============================================================================
// Typed API Client Class (Optional - for reference)
// ============================================================================

export class VentiAPIClient {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      ...options.headers,
    };

    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }

    const response = await fetch(`${this.config.scannerBaseUrl}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.detail);
    }

    return response.json();
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.config.scannerBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.config.accessToken = data.access_token;
    return data;
  }

  // Scans
  async startScan(request: FormData): Promise<ScanResponse> {
    return this.request<ScanResponse>('/api/scan/start', {
      method: 'POST',
      body: request,
    });
  }

  async getScanStatus(scanId: string): Promise<ScanStatusResponse> {
    return this.request<ScanStatusResponse>(`/api/scan/${scanId}/status`);
  }

  async getScanFindings(scanId: string): Promise<FindingsResponse> {
    return this.request<FindingsResponse>(`/api/scan/${scanId}/findings`);
  }

  async getScanReport(scanId: string): Promise<ScanReport> {
    return this.request<ScanReport>(`/api/scan/${scanId}/report`);
  }

  async listScans(): Promise<ScanListItem[]> {
    return this.request<ScanListItem[]>('/api/scans');
  }

  async deleteScan(scanId: string): Promise<void> {
    return this.request<void>(`/api/scan/${scanId}`, { method: 'DELETE' });
  }

  // Scanners
  async getAvailableScanners(): Promise<AvailableScannersResponse> {
    return this.request<AvailableScannersResponse>('/api/scanners');
  }

  // Health
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/health');
  }

  // AI Chat (Mastra)
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.config.mastraBaseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Chat request failed');
    }

    return response.json();
  }

  async chatStream(
    request: ChatRequest,
    onToken: (content: string) => void,
    onDone: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.config.mastraBaseUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Chat stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '');
        if (!data) continue;

        try {
          const event: StreamEvent = JSON.parse(data);

          if (event.type === 'token' && event.content) {
            onToken(event.content);
          } else if (event.type === 'done') {
            onDone();
            return;
          } else if (event.type === 'error' && event.error) {
            onError(event.error);
            return;
          }
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      }
    }
  }

  async getThreads(userId: string): Promise<ChatThread[]> {
    const response = await fetch(
      `${this.config.mastraBaseUrl}/threads?userId=${userId}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch threads');
    }

    return response.json();
  }

  async getThreadMessages(threadId: string, userId: string): Promise<ChatMessage[]> {
    const response = await fetch(
      `${this.config.mastraBaseUrl}/threads/${threadId}?userId=${userId}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch thread messages');
    }

    return response.json();
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/*
// Initialize client
const client = new VentiAPIClient({
  scannerBaseUrl: 'http://localhost:8000',
  mastraBaseUrl: 'http://localhost:4111',
});

// Login
const loginResponse = await client.login({
  username: 'admin',
  password: 'your_password',
});

// Start scan
const formData = new FormData();
formData.append('file', openapiFile);
formData.append('target_url', 'https://api.example.com');

const { scan_id } = await client.startScan(formData);

// Poll for status
const pollScan = async () => {
  const status = await client.getScanStatus(scan_id);

  if (status.status === 'completed') {
    const findings = await client.getScanFindings(scan_id);
    console.log('Findings:', findings);
  } else if (status.status === 'failed') {
    console.error('Scan failed:', status.error);
  } else {
    setTimeout(pollScan, 2000);
  }
};

await pollScan();

// Chat with AI
const chatResponse = await client.chat({
  prompt: 'Explain this BOLA vulnerability and provide remediation code',
  additionalContext: {
    vulnerability: findings.findings[0]
  }
});

console.log('AI Response:', chatResponse.response);
*/
