# VentiAPI Scanner - Lovable Integration Guide

Quick guide for building a new frontend in Lovable that connects to VentiAPI Scanner backend.

## Quick Setup (3 Steps)

### 1. Import TypeScript Types

Copy the `API_TYPES.ts` file into your Lovable project:

```bash
# Copy types to your Lovable src directory
cp API_TYPES.ts /path/to/your-lovable-project/src/types/
```

### 2. Configure API Client

Create `src/lib/api-client.ts`:

```typescript
import { VentiAPIClient } from '@/types/API_TYPES';

export const apiClient = new VentiAPIClient({
  scannerBaseUrl: import.meta.env.VITE_SCANNER_API_URL || 'http://localhost:8000',
  mastraBaseUrl: import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111',
});
```

### 3. Add Environment Variables

In your Lovable project settings, add:

```bash
VITE_SCANNER_API_URL=http://localhost:8000
VITE_MASTRA_API_URL=http://localhost:4111
```

---

## Example: Building a Scan Dashboard

### Login Component

```tsx
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await apiClient.login({ username, password });
      console.log('Logged in:', response.username);
      // Store token or redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

### Start Scan Component

```tsx
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ScanResponse } from '@/types/API_TYPES';

export function StartScanForm() {
  const [file, setFile] = useState<File | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    if (file) formData.append('file', file);
    formData.append('target_url', targetUrl);
    formData.append('parallel_mode', 'true');

    try {
      const response = await apiClient.startScan(formData);
      setScanResponse(response);
      // Redirect to scan status page
    } catch (error) {
      console.error('Scan failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept=".yaml,.yml,.json"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <input
        type="url"
        value={targetUrl}
        onChange={(e) => setTargetUrl(e.target.value)}
        placeholder="https://api.example.com"
      />
      <button type="submit">Start Scan</button>

      {scanResponse && (
        <div>
          <p>Scan ID: {scanResponse.scan_id}</p>
          <p>Status: {scanResponse.status}</p>
        </div>
      )}
    </form>
  );
}
```

### Scan Status Component (with Polling)

```tsx
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ScanStatusResponse, FindingsResponse } from '@/types/API_TYPES';

interface ScanStatusProps {
  scanId: string;
}

export function ScanStatus({ scanId }: ScanStatusProps) {
  const [status, setStatus] = useState<ScanStatusResponse | null>(null);
  const [findings, setFindings] = useState<FindingsResponse | null>(null);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const statusData = await apiClient.getScanStatus(scanId);
        setStatus(statusData);

        if (statusData.status === 'completed') {
          // Fetch findings
          const findingsData = await apiClient.getScanFindings(scanId);
          setFindings(findingsData);
        } else if (statusData.status === 'running') {
          // Continue polling
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    pollStatus();
  }, [scanId]);

  if (!status) return <div>Loading...</div>;

  return (
    <div>
      <h2>Scan Status</h2>
      <div className="bg-gray-100 p-4 rounded">
        <p><strong>Status:</strong> {status.status}</p>
        <p><strong>Progress:</strong> {status.progress}%</p>
        <p><strong>Phase:</strong> {status.current_phase}</p>
        <p><strong>Findings:</strong> {status.findings_count}</p>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded h-4 mt-2">
          <div
            className="bg-blue-500 h-4 rounded"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {findings && (
        <div className="mt-4">
          <h3>Findings Summary</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-red-100 p-2 rounded">
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-2xl font-bold">{findings.summary.critical}</p>
            </div>
            <div className="bg-orange-100 p-2 rounded">
              <p className="text-sm text-gray-600">High</p>
              <p className="text-2xl font-bold">{findings.summary.high}</p>
            </div>
            <div className="bg-yellow-100 p-2 rounded">
              <p className="text-sm text-gray-600">Medium</p>
              <p className="text-2xl font-bold">{findings.summary.medium}</p>
            </div>
            <div className="bg-green-100 p-2 rounded">
              <p className="text-sm text-gray-600">Low</p>
              <p className="text-2xl font-bold">{findings.summary.low}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Findings List Component

```tsx
import type { Finding } from '@/types/API_TYPES';

interface FindingsListProps {
  findings: Finding[];
}

export function FindingsList({ findings }: FindingsListProps) {
  const getSeverityColor = (severity: string) => {
    const colors = {
      CRITICAL: 'bg-red-500',
      HIGH: 'bg-orange-500',
      MEDIUM: 'bg-yellow-500',
      LOW: 'bg-blue-500',
      INFO: 'bg-gray-500',
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="space-y-4">
      {findings.map((finding, index) => (
        <div key={index} className="border rounded-lg p-4 shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-white text-xs font-bold ${getSeverityColor(
                    finding.severity
                  )}`}
                >
                  {finding.severity}
                </span>
                <h3 className="font-bold text-lg">{finding.title}</h3>
              </div>

              <p className="text-gray-600 mt-2">{finding.description}</p>

              <div className="mt-3 flex gap-4 text-sm">
                <span><strong>Endpoint:</strong> {finding.endpoint}</span>
                <span><strong>Method:</strong> {finding.method}</span>
                {finding.cwe_id && <span><strong>CWE:</strong> {finding.cwe_id}</span>}
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-blue-600 hover:underline">
                  View Details
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Evidence:</strong>
                    <pre className="bg-gray-100 p-2 rounded mt-1 text-sm overflow-x-auto">
                      {finding.evidence}
                    </pre>
                  </div>
                  <div>
                    <strong>Remediation:</strong>
                    <p className="text-gray-700 mt-1">{finding.remediation}</p>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### AI Chat Component (Streaming)

```tsx
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Finding } from '@/types/API_TYPES';

interface AIChatProps {
  vulnerability?: Finding;
}

export function AIChat({ vulnerability }: AIChatProps) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse('');
    setIsStreaming(true);

    try {
      await apiClient.chatStream(
        {
          prompt,
          temperature: 0.7,
          additionalContext: vulnerability ? { vulnerability } : undefined,
        },
        // onToken
        (content) => setResponse((prev) => prev + content),
        // onDone
        () => setIsStreaming(false),
        // onError
        (error) => {
          console.error('Chat error:', error);
          setIsStreaming(false);
        }
      );
    } catch (error) {
      console.error('Failed to start chat:', error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about vulnerabilities, remediation, or security best practices..."
          className="w-full p-3 border rounded-lg"
          rows={4}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isStreaming ? 'Generating...' : 'Ask AI'}
        </button>
      </form>

      {response && (
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-bold mb-2">AI Response:</h3>
          <div className="prose max-w-none">
            {response}
            {isStreaming && <span className="animate-pulse">▊</span>}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Using React Query (Recommended)

Install React Query for better data management:

```bash
npm install @tanstack/react-query
```

Example with React Query:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Login mutation
export function useLogin() {
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiClient.login(credentials),
    onSuccess: (data) => {
      console.log('Login successful:', data);
    },
  });
}

// Scan status query with polling
export function useScanStatus(scanId: string) {
  return useQuery({
    queryKey: ['scan', scanId, 'status'],
    queryFn: () => apiClient.getScanStatus(scanId),
    refetchInterval: (data) => {
      // Stop polling when completed or failed
      return data?.status === 'running' ? 2000 : false;
    },
  });
}

// Scan findings query
export function useScanFindings(scanId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['scan', scanId, 'findings'],
    queryFn: () => apiClient.getScanFindings(scanId),
    enabled, // Only fetch when scan is completed
  });
}

// Start scan mutation
export function useStartScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => apiClient.startScan(formData),
    onSuccess: () => {
      // Invalidate scans list to refetch
      queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

// Usage in component
function ScanDashboard({ scanId }: { scanId: string }) {
  const { data: status, isLoading } = useScanStatus(scanId);
  const { data: findings } = useScanFindings(
    scanId,
    status?.status === 'completed'
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>Status: {status?.status}</p>
      <p>Progress: {status?.progress}%</p>
      {findings && <FindingsList findings={findings.findings} />}
    </div>
  );
}
```

---

## Testing with Postman

1. Import `VentiAPI_Postman_Collection.json` into Postman
2. Update environment variables (username, password, base URLs)
3. Run "Login" request to get token (auto-saved)
4. Test other endpoints

---

## Important Notes for Lovable

### CORS Configuration

The backend already allows `localhost:3000`, `localhost:3001`, and `localhost:3002`. If your Lovable preview URL is different:

1. Add to backend `.env.local`:
   ```
   ADDITIONAL_CORS_ORIGINS=https://your-app.lovableproject.com
   ```

2. Restart backend:
   ```bash
   ./restart-dev.sh api
   ```

### Authentication State

Use your preferred state management:

```tsx
// Simple context example
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext<{
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );

  const login = async (username: string, password: string) => {
    const response = await apiClient.login({ username, password });
    setToken(response.access_token);
    localStorage.setItem('token', response.access_token);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## Next Steps

1. ✅ Copy `API_TYPES.ts` to your Lovable project
2. ✅ Import `VentiAPI_Postman_Collection.json` for testing
3. ✅ Configure environment variables
4. ✅ Start with login component
5. ✅ Build scan dashboard
6. ✅ Add AI chat feature
7. ✅ Implement findings visualization

---

## Getting Help

- **API Documentation**: See `API_REFERENCE.md`
- **Live Swagger Docs**: http://localhost:8000/docs
- **Example Frontend**: Check `/frontend/src/` for React example
- **Issues**: https://github.com/your-repo/issues
