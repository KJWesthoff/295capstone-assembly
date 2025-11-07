# VentiAPI Scanner - Complete API Reference

## Table of Contents
1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Scanner API Endpoints](#scanner-api-endpoints)
4. [Mastra AI Backend Endpoints](#mastra-ai-backend-endpoints)
5. [Integration Guide for Lovable](#integration-guide-for-lovable)

---

## Quick Start

### Access Interactive API Docs

**Scanner API (FastAPI)**
```
http://localhost:8000/docs          # Swagger UI (interactive)
http://localhost:8000/redoc         # ReDoc (read-only)
http://localhost:8000/openapi.json  # OpenAPI 3.0 spec (JSON)
```

**Mastra AI Backend**
```
http://localhost:4111/docs          # Mastra docs
http://localhost:4111/api/openapi   # OpenAPI spec
```

### Base URLs

- **Production Scanner**: `http://localhost:8000`
- **Mastra AI**: `http://localhost:4111`
- **Production (via nginx)**: `http://localhost:3000` (proxies to port 8000)

---

## Authentication

All Scanner API endpoints (except `/health` and `/api/auth/login`) require JWT authentication.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "username": "your_username",
  "role": "admin"
}
```

### Using the Token
```http
GET /api/scans
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Default Credentials** (from `.env.local`):
- Username: Set in `ADMIN_USERNAME`
- Password: Set in `ADMIN_PASSWORD`

---

## Scanner API Endpoints

### Health Check
```http
GET /health
```
No authentication required. Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-02T10:00:00.000Z",
  "queue_stats": {
    "queue_length": 0,
    "active_workers": 0,
    "processing_workers": 0,
    "waiting_workers": 0
  }
}
```

---

### Start a Scan

```http
POST /api/scan/start
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "file": <OpenAPI spec file>,
  "target_url": "https://api.example.com",
  "dangerous_mode": false,
  "fuzz_auth": false,
  "max_requests": 1000,
  "parallel_mode": true,
  "scanners": ["ventiapi", "zap"]
}
```

**Parameters:**
- `file` (optional): OpenAPI spec file (YAML/JSON)
- `spec_url` (optional): URL to OpenAPI spec
- `target_url` (required): Base URL of API to scan
- `dangerous_mode` (optional, default: false): Enable destructive tests
- `fuzz_auth` (optional, default: false): Test auth bypass vulnerabilities
- `max_requests` (optional, default: 1000): Request budget
- `parallel_mode` (optional, default: true): Use parallel scanning
- `scanners` (optional, default: ["ventiapi"]): List of scanner engines

**Response:**
```json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

---

### Get Scan Status

```http
GET /api/scan/{scan_id}/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": 45,
  "current_phase": "Testing BOLA vulnerabilities",
  "findings_count": 12,
  "parallel_mode": true,
  "total_chunks": 4,
  "chunk_status": [
    {
      "chunk_id": 0,
      "status": "completed",
      "findings_count": 5
    }
  ]
}
```

**Status Values:**
- `queued` - Scan is in queue
- `running` - Scan is in progress
- `completed` - Scan finished successfully
- `failed` - Scan encountered an error

---

### Get Scan Findings

```http
GET /api/scan/{scan_id}/findings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "scan_id": "550e8400-e29b-41d4-a716-446655440000",
  "findings": [
    {
      "severity": "HIGH",
      "title": "Broken Object Level Authorization (BOLA)",
      "description": "Endpoint allows accessing resources belonging to other users",
      "endpoint": "/api/users/{userId}",
      "method": "GET",
      "evidence": "Successfully accessed user ID 456 with credentials for user ID 123",
      "remediation": "Implement proper authorization checks to verify resource ownership",
      "cwe_id": "CWE-639",
      "owasp_category": "API1:2023 Broken Object Level Authorization",
      "scanner": "ventiapi"
    }
  ],
  "summary": {
    "total": 12,
    "critical": 2,
    "high": 5,
    "medium": 3,
    "low": 2
  }
}
```

---

### Get Scan Report (JSON)

```http
GET /api/scan/{scan_id}/report
Authorization: Bearer <token>
```

Returns comprehensive JSON report with all findings, metadata, and OWASP mappings.

---

### Get Scan Report (HTML)

```http
GET /api/scan/{scan_id}/report/html
Authorization: Bearer <token>
```

Returns formatted HTML report suitable for downloading.

---

### List All Scans

```http
GET /api/scans
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "scan_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "created_at": "2025-11-02T10:00:00.000Z",
    "target_url": "https://api.example.com",
    "findings_count": 12
  }
]
```

---

### Delete Scan

```http
DELETE /api/scan/{scan_id}
Authorization: Bearer <token>
```

Deletes scan results and associated files.

---

### Get Available Scanners

```http
GET /api/scanners
Authorization: Bearer <token>
```

**Response:**
```json
{
  "scanners": [
    {
      "name": "ventiapi",
      "description": "Custom OWASP API Top 10 scanner",
      "supported_tests": ["BOLA", "BFLA", "Injection", "Mass Assignment"]
    },
    {
      "name": "zap",
      "description": "OWASP ZAP baseline scanner",
      "supported_tests": ["XSS", "Security Headers", "Cookie Security"]
    }
  ]
}
```

---

### Queue Statistics

```http
GET /api/queue/stats
Authorization: Bearer <token>
```

Returns current job queue statistics.

---

## Mastra AI Backend Endpoints

### Chat (Non-Streaming)

```http
POST /chat
Content-Type: application/json

{
  "prompt": "Explain this BOLA vulnerability and how to fix it",
  "temperature": 0.7,
  "maxTokens": 2000,
  "systemPrompt": "You are a security expert",
  "resourceId": "user-123",
  "threadId": "thread-456",
  "additionalContext": {
    "scanResults": {...}
  }
}
```

**Response:**
```json
{
  "response": "BOLA (Broken Object Level Authorization) occurs when...",
  "threadId": "thread-456"
}
```

---

### Chat (Streaming)

```http
POST /chat/stream
Content-Type: application/json

{
  "prompt": "Analyze this scan and suggest fixes",
  "temperature": 0.7,
  "additionalContext": {
    "scanId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Returns Server-Sent Events (SSE) stream with real-time responses.

**SSE Format:**
```
data: {"type": "token", "content": "BOLA"}
data: {"type": "token", "content": " vulnerabilities"}
data: {"type": "done"}
```

---

### Get Chat Threads

```http
GET /threads?userId=user-123
```

**Response:**
```json
[
  {
    "id": "thread-456",
    "title": "BOLA Vulnerability Analysis",
    "createdAt": "2025-11-02T10:00:00.000Z",
    "updatedAt": "2025-11-02T10:05:00.000Z"
  }
]
```

---

### Get Thread Messages

```http
GET /threads/{threadId}?userId=user-123
```

**Response:**
```json
[
  {
    "id": "msg-1",
    "threadId": "thread-456",
    "role": "user",
    "content": "Explain this BOLA vulnerability",
    "createdAt": "2025-11-02T10:00:00.000Z"
  },
  {
    "id": "msg-2",
    "threadId": "thread-456",
    "role": "assistant",
    "content": "BOLA vulnerabilities occur when...",
    "createdAt": "2025-11-02T10:00:05.000Z"
  }
]
```

---

## Integration Guide for Lovable

### Option 1: Import OpenAPI Spec Directly

1. Start the backend: `./start-dev.sh`
2. Download the spec: `curl http://localhost:8000/openapi.json > scanner-api.json`
3. Import into Lovable's API client generator

### Option 2: TypeScript API Client (Recommended)

Generate a fully-typed TypeScript client using `openapi-typescript-codegen`:

```bash
# Install generator
npm install -g openapi-typescript-codegen

# Generate TypeScript client
openapi-typescript-codegen --input http://localhost:8000/openapi.json --output ./src/api --client fetch
```

This creates:
- Type-safe API client
- Request/response types
- Automatic error handling
- IntelliSense support

### Option 3: Use the Types Directly

I can generate a TypeScript types file with all request/response interfaces. See `API_TYPES.ts` (generated separately).

---

## Example: Complete Scan Flow

```typescript
// 1. Login
const loginResponse = await fetch('http://localhost:8000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'your_password'
  })
});
const { access_token } = await loginResponse.json();

// 2. Start scan
const formData = new FormData();
formData.append('file', openapiSpecFile);
formData.append('target_url', 'https://api.example.com');
formData.append('dangerous_mode', 'false');

const startResponse = await fetch('http://localhost:8000/api/scan/start', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}` },
  body: formData
});
const { scan_id } = await startResponse.json();

// 3. Poll for status
const pollStatus = async () => {
  const response = await fetch(`http://localhost:8000/api/scan/${scan_id}/status`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const status = await response.json();

  if (status.status === 'completed') {
    // 4. Get findings
    const findingsResponse = await fetch(
      `http://localhost:8000/api/scan/${scan_id}/findings`,
      { headers: { 'Authorization': `Bearer ${access_token}` } }
    );
    const findings = await findingsResponse.json();
    return findings;
  }

  // Continue polling
  setTimeout(pollStatus, 2000);
};

await pollStatus();
```

---

## CORS Configuration

The backend allows these origins by default:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3002`

To add your Lovable app URL:
```bash
# Add to .env.local
ADDITIONAL_CORS_ORIGINS=https://your-lovable-app.lovableproject.com
```

---

## Rate Limits

- **Login**: 5 requests per minute
- **Scan Start**: 10 requests per minute
- **Other endpoints**: 30 requests per minute

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here",
  "status_code": 400
}
```

**Common Status Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## WebSocket Support (Future)

Real-time scan progress updates will be available via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/scan/{scan_id}');
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress:', update.progress);
};
```

---

## Need More Help?

- View live docs: http://localhost:8000/docs
- Check examples: `/frontend/src/lib/scannerApi.ts`
- Report issues: https://github.com/your-repo/issues
