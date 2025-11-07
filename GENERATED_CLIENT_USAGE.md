# Generated TypeScript API Client - Usage Guide

## ✅ What Was Generated

The TypeScript client has been successfully generated in `./generated-api-client/`:

```
generated-api-client/
├── index.ts                  # Main exports
├── core/                     # Core HTTP client functionality
│   ├── OpenAPI.ts           # Configuration
│   ├── ApiError.ts          # Error handling
│   ├── request.ts           # HTTP request handler
│   └── ...
├── models/                   # TypeScript types/interfaces
│   ├── LoginRequest.ts
│   ├── ScanResponse.ts
│   ├── ScanStatus.ts
│   └── ...
└── services/                 # API service methods
    └── DefaultService.ts    # All API endpoints
```

---

## 🚀 Quick Start

### 1. Copy to Your Lovable Project

```bash
# Copy the entire generated client to your Lovable project
cp -r generated-api-client /path/to/your-lovable-project/src/api
```

### 2. Configure the Client

Create `src/lib/scanner-api.ts`:

```typescript
import { OpenAPI } from '@/api/core/OpenAPI';

// Configure base URL
OpenAPI.BASE = import.meta.env.VITE_SCANNER_API_URL || 'http://localhost:8000';

// Set bearer token (call after login)
export function setAuthToken(token: string) {
  OpenAPI.TOKEN = token;
}

// Clear token (logout)
export function clearAuthToken() {
  OpenAPI.TOKEN = undefined;
}
```

### 3. Use in Your Components

```typescript
import { DefaultService } from '@/api';
import { setAuthToken } from '@/lib/scanner-api';

// Login
async function login(username: string, password: string) {
  const response = await DefaultService.loginApiAuthLoginPost({
    username,
    password,
  });

  // Save token
  setAuthToken(response.access_token);
  return response;
}

// Start scan
async function startScan(file: File, targetUrl: string) {
  const response = await DefaultService.startScanApiScanStartPost({
    file,
    target_url: targetUrl,
    dangerous_mode: false,
    max_requests: 1000,
  });

  return response; // { scan_id: string, status: string }
}

// Get scan status
async function getScanStatus(scanId: string) {
  return await DefaultService.getScanStatusApiScanScanIdStatusGet(scanId);
}

// Get findings
async function getFindings(scanId: string) {
  return await DefaultService.getScanFindingsApiScanScanIdFindingsGet(scanId);
}
```

---

## 📋 Available Methods

All methods are available via `DefaultService`:

### Authentication
- `loginApiAuthLoginPost(requestBody)` - Login and get JWT token

### Scans
- `startScanApiScanStartPost(formData)` - Start a new scan
- `getScanStatusApiScanScanIdStatusGet(scanId)` - Get scan status
- `getScanFindingsApiScanScanIdFindingsGet(scanId, offset?, limit?)` - Get findings
- `getScanReportApiScanScanIdReportGet(scanId)` - Get JSON report
- `getScanReportHtmlApiScanScanIdReportHtmlGet(scanId)` - Get HTML report
- `listScansApiScansGet()` - List all scans
- `deleteScanApiScanScanIdDelete(scanId)` - Delete scan

### Utilities
- `healthCheckHealthGet()` - Health check
- `getQueueStatsApiQueueStatsGet()` - Queue statistics
- `getAvailableScannersApiScannersGet()` - List scanner engines

---

## 💡 Complete Example Component

```typescript
import { useState, useEffect } from 'react';
import { DefaultService, ScanStatus } from '@/api';
import { setAuthToken } from '@/lib/scanner-api';

export function ScanDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus | null>(null);

  // Login
  const handleLogin = async () => {
    try {
      const response = await DefaultService.loginApiAuthLoginPost({
        username: 'MICS295',
        password: 'MaryMcHale',
      });
      setAuthToken(response.access_token);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Start scan
  const handleStartScan = async (file: File, targetUrl: string) => {
    try {
      const response = await DefaultService.startScanApiScanStartPost({
        file,
        target_url: targetUrl,
      });
      setScanId(response.scan_id);
    } catch (error) {
      console.error('Scan failed:', error);
    }
  };

  // Poll for status
  useEffect(() => {
    if (!scanId) return;

    const interval = setInterval(async () => {
      try {
        const statusData = await DefaultService.getScanStatusApiScanScanIdStatusGet(scanId);
        setStatus(statusData);

        if (statusData.status === 'completed' || statusData.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [scanId]);

  return (
    <div>
      {!isLoggedIn ? (
        <button onClick={handleLogin}>Login</button>
      ) : (
        <div>
          {/* Scan form and status display */}
          {status && (
            <div>
              <p>Status: {status.status}</p>
              <p>Progress: {status.progress}%</p>
              <p>Findings: {status.findings_count}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 🔧 Error Handling

The client includes automatic error handling:

```typescript
import { ApiError } from '@/api';

try {
  const response = await DefaultService.startScanApiScanStartPost(formData);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.status, error.body);

    if (error.status === 401) {
      // Handle unauthorized
    } else if (error.status === 422) {
      // Handle validation error
    }
  }
}
```

---

## ⚙️ Configuration Options

Configure the client in `src/lib/scanner-api.ts`:

```typescript
import { OpenAPI } from '@/api/core/OpenAPI';

// Base URL
OpenAPI.BASE = 'http://localhost:8000';

// Bearer token
OpenAPI.TOKEN = 'your-jwt-token';

// Custom headers
OpenAPI.HEADERS = {
  'X-Custom-Header': 'value',
};

// Request timeout (milliseconds)
OpenAPI.TIMEOUT = 30000;

// Credentials mode
OpenAPI.WITH_CREDENTIALS = true;
```

---

## 📦 Type Imports

All types are exported from the main index:

```typescript
import type {
  LoginRequest,
  ScanResponse,
  ScanStatus,
  Body_start_scan_api_scan_start_post,
} from '@/api';
```

---

## 🔄 Regenerating the Client

If the backend API changes, regenerate the client:

```bash
# Download updated OpenAPI spec
curl http://localhost:8000/openapi.json -o scanner-openapi.json

# Regenerate client
npx openapi-typescript-codegen \
  --input scanner-openapi.json \
  --output ./generated-api-client \
  --client fetch
```

---

## 🎯 Next Steps

1. ✅ Copy `generated-api-client/` to your Lovable project
2. ✅ Create configuration file (`lib/scanner-api.ts`)
3. ✅ Add environment variable: `VITE_SCANNER_API_URL=http://localhost:8000`
4. ✅ Use `DefaultService` methods in your components
5. ✅ Implement authentication state management
6. ✅ Build scan dashboard UI

---

## 📚 Additional Resources

- **API Documentation**: `API_REFERENCE.md`
- **Manual Types**: `API_TYPES.ts` (custom-made, includes more examples)
- **Postman Collection**: `VentiAPI_Postman_Collection.json`
- **Lovable Integration Guide**: `LOVABLE_INTEGRATION_GUIDE.md`

The generated client is fully typed, handles errors automatically, and works seamlessly with React/TypeScript projects!
