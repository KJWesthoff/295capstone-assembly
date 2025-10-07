# 🔧 Scanner Service Setup Guide

## Problem: "Failed to start scan: Load failed"

This error occurs when the Cedar frontend at `http://localhost:3002` cannot connect to the Python scanner service at `http://localhost:8000`.

---

## ✅ Solution: Start the Scanner Service

### Step 1: Start the Scanner Service

From the project root:

```bash
cd /Users/jesse/x/295capstone-assembly
./start-scanner-service.sh
```

This script will:
- Set up authentication credentials
- Install Python dependencies
- Start the scanner service on port 8000

**Default Credentials:**
- Username: `scanner_admin`
- Password: `SecureP@ssw0rd2024!`

### Step 2: Verify Service is Running

In another terminal:

```bash
curl http://localhost:8000/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-..."
}
```

### Step 3: Test Authentication

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"scanner_admin","password":"SecureP@ssw0rd2024!"}'
```

You should receive a JWT token:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

### Step 4: Access Cedar Frontend

Now visit: http://localhost:3002/security

The frontend will automatically:
1. Authenticate with the scanner service
2. Store the JWT token
3. Use it for all API requests

---

## 🔐 Custom Credentials (Optional)

To use different credentials:

```bash
export ADMIN_USERNAME="your_username"
export ADMIN_PASSWORD="your_secure_password"
./start-scanner-service.sh
```

Then update Cedar frontend environment:

```bash
# cedar-frontend-prototype/.env.local
NEXT_PUBLIC_SCANNER_USERNAME=your_username
NEXT_PUBLIC_SCANNER_PASSWORD=your_secure_password
```

---

## 🐛 Troubleshooting

### Error: "Connection refused"

**Cause:** Scanner service is not running

**Solution:**
```bash
# Check if service is running
ps aux | grep "python.*main.py"

# If not running, start it
./start-scanner-service.sh
```

### Error: "401 Unauthorized"

**Cause:** Authentication credentials don't match

**Solution:**
1. Check scanner service logs for configured username
2. Update frontend credentials in `.env.local`
3. Clear browser localStorage: `localStorage.clear()`
4. Refresh page

### Error: "CORS policy"

**Cause:** Frontend URL not in allowed origins

**Solution:**
The start script already configures CORS for:
- http://localhost:3000
- http://localhost:3001
- http://localhost:3002

If using a different port, add it:
```bash
export ADDITIONAL_CORS_ORIGINS="http://localhost:YOUR_PORT"
./start-scanner-service.sh
```

### Error: "Admin credentials must be set"

**Cause:** Security module requires explicit credentials

**Solution:**
The start script sets secure defaults. If you see this error:
```bash
export ADMIN_USERNAME="your_username"
export ADMIN_PASSWORD="Strong_P@ssw0rd_123"
./start-scanner-service.sh
```

---

## 📋 Complete Workflow

### Terminal 1: Scanner Service
```bash
cd /Users/jesse/x/295capstone-assembly
./start-scanner-service.sh
```

Wait for:
```
✅ Starting scanner service on http://localhost:8000
🔑 Login credentials for Cedar frontend:
   Username: scanner_admin
   Password: SecureP@ssw0rd2024!
```

### Terminal 2: Cedar Frontend
```bash
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun run dev
```

Wait for:
```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3002
```

### Browser
1. Visit: http://localhost:3002/security
2. Click "Run Security Scan"
3. Configure scan settings
4. Submit scan

The frontend will automatically authenticate and start the scan.

---

## 🔄 Development Tips

### Auto-restart on code changes

For the scanner service, use:
```bash
cd scanner-service/web-api
pip install watchdog
watchmedo auto-restart -d . -p '*.py' -- python main.py
```

### Check Scanner Service Logs

```bash
# View API documentation
open http://localhost:8000/docs

# Check queue stats (admin only)
curl http://localhost:8000/api/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# List available scanners
curl http://localhost:8000/api/scanners
```

---

## 🏗️ Architecture

```
┌─────────────────────────┐
│  Cedar Frontend         │
│  (Next.js - Port 3002)  │
│                         │
│  - Auto-authenticates   │
│  - Stores JWT token     │
│  - Makes API requests   │
└──────────┬──────────────┘
           │
           │ HTTP + JWT Auth
           │
┌──────────▼──────────────┐
│  Scanner Service        │
│  (Python - Port 8000)   │
│                         │
│  - JWT authentication   │
│  - Multi-scanner engine │
│  - Rate limiting        │
│  - Security middleware  │
└─────────────────────────┘
```

---

## ✨ Features

The scanner service provides:

- **🔒 JWT Authentication**: Secure token-based auth
- **⚡ Rate Limiting**: Prevents API abuse
- **🔐 Security Headers**: CORS, CSP, etc.
- **🛡️ Input Validation**: File uploads, URLs, parameters
- **📊 Progress Tracking**: Real-time scan status
- **🔄 Multi-Scanner Support**: VentiAPI, ZAP, Nikto
- **📈 Detailed Reporting**: HTML and JSON reports

---

## 🚀 Production Deployment

For production, update credentials:

```bash
# Generate strong password
openssl rand -base64 32

# Set environment variables
export ADMIN_USERNAME="production_admin"
export ADMIN_PASSWORD="generated_strong_password"
export JWT_SECRET="$(openssl rand -base64 32)"

# Start service
./start-scanner-service.sh
```

**Important**: Never commit `.env` files with real credentials!

---

## 📚 API Documentation

Once the service is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

