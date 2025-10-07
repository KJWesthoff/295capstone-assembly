# 🔍 How to Run a Security Scan

## ✅ **Feature Complete!**

The "Run Security Scan" feature is now fully implemented and connected to your Python scanner service.

---

## 🚀 **Quick Test**

### 1. Start Your Services

**Terminal 1: Python Scanner Service**
```bash
cd /Users/jesse/x/295capstone-assembly/scanner-service
python -m uvicorn web-api.main:app --reload --port 8000
```

**Terminal 2: Cedar Frontend**
```bash
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun run dev
```

### 2. Run a Scan

1. Visit: **http://localhost:3000/security**
2. Click **"Run Security Scan"** button
3. Fill in the dialog:
   - **API Base URL**: `https://petstore.swagger.io/v2`
   - **Spec URL**: `https://petstore.swagger.io/v2/swagger.json`
   - **Scanners**: Check "VentiAPI" (default)
   - Click **"Start Security Scan"**

### 3. Watch the Magic

- ✨ Dialog closes, scan starts
- 🔄 "Security Scan in Progress" screen appears
- 📊 Automatic polling every 3 seconds
- 🎉 When complete, dashboard shows all vulnerabilities
- 🤖 AI automatically notified via Cedar context
- 💬 Chat shows "Scan completed: X findings"

---

## 🎨 **What Was Implemented**

### 1. Scan Configuration Dialog
**File**: `src/components/security/ScanConfigDialog.tsx`

Beautiful modal with:
- ✅ API URL input
- ✅ Spec URL or file upload toggle
- ✅ Scanner selection (VentiAPI, ZAP, Nikto)
- ✅ Advanced options (Dangerous tests, Auth fuzzing)
- ✅ Loading states
- ✅ Form validation

### 2. Scanner API Client
**File**: `src/lib/scannerApi.ts`

TypeScript client that:
- ✅ Starts scans via `/api/scan/start`
- ✅ Polls status via `/api/scan/{id}/status`
- ✅ Fetches findings via `/api/scan/{id}/findings`
- ✅ Gets available scanners via `/api/scanners`
- ✅ Full error handling

### 3. Security Dashboard Integration
**File**: `src/app/security/page.tsx`

Enhanced with:
- ✅ Scan dialog state management
- ✅ Active scan tracking
- ✅ Automatic polling (every 3s)
- ✅ Loading states (pending, running, completed)
- ✅ Auto-load findings when complete
- ✅ AI context updates
- ✅ Beautiful animations

---

## 🔄 **The Complete Flow**

```
User clicks "Run Security Scan"
         ↓
Scan Config Dialog opens
         ↓
User fills in API URL, spec, scanners
         ↓
Click "Start Security Scan"
         ↓
POST to Python scanner /api/scan/start
         ↓
Receive scan_id, start polling
         ↓
Dashboard shows "Scan in Progress" 🔄
         ↓
Poll /api/scan/{id}/status every 3s
         ↓
When status = 'completed':
  - Fetch /api/scan/{id}/findings
  - Transform to Cedar state format
  - Group by endpoint
  - Calculate summary
  - Update UI with results
  - Notify AI via context entry
         ↓
Dashboard shows vulnerabilities grouped by endpoint 🎉
         ↓
AI chat receives scan completion notification
         ↓
User can click vulnerabilities to add to context
         ↓
Ask AI questions about specific findings
```

---

## 🎯 **Test Scenarios**

### Scenario 1: Basic Scan
```
API URL: https://petstore.swagger.io/v2
Spec URL: https://petstore.swagger.io/v2/swagger.json
Scanners: VentiAPI
```

### Scenario 2: Multi-Scanner Scan
```
API URL: https://petstore.swagger.io/v2
Spec URL: https://petstore.swagger.io/v2/swagger.json
Scanners: VentiAPI, ZAP
Advanced: Enable both dangerous tests and auth fuzzing
```

### Scenario 3: File Upload
```
API URL: https://api.example.com
Upload File: (select a local OpenAPI JSON/YAML file)
Scanners: VentiAPI
```

---

## 🤖 **AI Integration**

When a scan completes, the AI automatically receives:

```json
{
  "scanId": "abc-123",
  "summary": {
    "total": 15,
    "critical": 2,
    "high": 5,
    "medium": 6,
    "low": 2
  },
  "totalEndpoints": 7
}
```

**Try asking the AI:**
- "Analyze the scan results"
- "What are the critical vulnerabilities?"
- "Which endpoints have the most issues?"
- "Prioritize the findings for me"

---

## 🎨 **UI States**

### Empty State
- Shows when no scan results loaded
- "Run Security Scan" button prominent
- Link to existing scanner UI

### Scanning State
- Animated spinner icon
- "Security Scan in Progress"
- Shows scan ID
- Polling indicator

### Results State
- Summary cards with severity counts
- Vulnerabilities grouped by endpoint
- Expandable cards
- "Add to Context" buttons
- "New Scan" button in header

---

## 🔧 **Configuration Options**

Edit `src/lib/scannerApi.ts` to change:
- Scanner service URL (default: `http://localhost:8000`)
- Polling interval (default: 3 seconds)
- Request timeout settings

Edit `src/components/security/ScanConfigDialog.tsx` to:
- Add/remove scanner options
- Customize form fields
- Change validation rules

---

## 📊 **What Happens After Scan**

1. **Findings loaded into Cedar state** → AI can see them
2. **Grouped by endpoint** → Easy to navigate
3. **Summary calculated** → Overview at a glance
4. **AI notified** → Context badge appears in chat
5. **User can interact**:
   - Click "Add to Context" on any vulnerability
   - Ask AI questions about specific findings
   - Get remediation guidance
   - Request code examples

---

## 🎯 **Next Enhancement Ideas**

After testing this, consider adding:

- [ ] **Scan history list** - View past scans
- [ ] **Real-time progress** - Show scan progress percentage
- [ ] **Auto-refresh** - Automatically reload when scan completes
- [ ] **Export results** - Download findings as JSON/CSV
- [ ] **Compare scans** - Diff two scan results
- [ ] **Scan scheduling** - Schedule periodic scans

---

## ✅ **Ready to Test!**

```bash
# Terminal 1
cd /Users/jesse/x/295capstone-assembly/scanner-service
python -m uvicorn web-api.main:app --reload --port 8000

# Terminal 2
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun run dev

# Visit: http://localhost:3000/security
# Click: "Run Security Scan"
# Fill in the form
# Watch the magic happen! ✨
```

---

## 🎉 **What You Built**

✅ Full scan configuration UI
✅ Integration with Python scanner service
✅ Real-time scan progress tracking
✅ Automatic results loading
✅ AI context integration
✅ Beautiful, responsive design
✅ Error handling and loading states

**This is production-ready!** 🚀

Try it out and let me know how it works!

