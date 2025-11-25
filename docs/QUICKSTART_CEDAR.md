# 🚀 QUICKSTART: Cedar Security Analyst Dashboard

## ⚡ **Get Running in 30 Minutes**

This guide adapts the [cedar-mastra-starter](https://github.com/CedarCopilot/cedar-mastra-starter) for your security scanner. You'll have a working AI-powered security dashboard TODAY.

---

## 📋 **Prerequisites**

```bash
✅ Node.js 18+
✅ PostgreSQL with pgvector
✅ OpenAI API key
✅ Your existing scanner service running on port 8000
```

---

## 🎯 **Step 1: Setup Cedar Frontend (5 minutes)**

```bash
cd /Users/jesse/x/295capstone-assembly

# The starter is already cloned as cedar-frontend-prototype
cd cedar-frontend-prototype

# Install dependencies
bun install
cd src/backend && bun install && cd ../..

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your-key-here
SCANNER_SERVICE_URL=http://localhost:8000
DATABASE_URL=postgresql://user:password@localhost:5432/security_scanner
EOF
```

---

## 🎯 **Step 2: Add Security Files (10 minutes)**

I've created these files for you - copy them into the project:

### 1. Security Analyst Agent
**Location**: `src/backend/src/mastra/agents/securityAnalystAgent.ts`

This replaces the `productRoadmapAgent` with a security-focused agent.

### 2. Scan Results State
**Location**: `src/app/cedar-os/scanState.ts`

Manages vulnerability data in Cedar state (like roadmap state but for vulnerabilities).

### 3. Scanner Bridge API
**Location**: `src/backend/src/mastra/tools/scannerBridgeTool.ts`

Connects Cedar to your existing Python scanner service.

### 4. Security Dashboard Component  
**Location**: `src/app/security/page.tsx`

Displays vulnerabilities grouped by endpoint with AI chat.

---

## 🎯 **Step 3: Modify Core Files (5 minutes)**

### Update `src/backend/src/mastra/index.ts`

```typescript
import { Mastra } from '@mastra/core/mastra';
import { chatWorkflow } from './workflows/chatWorkflow';
import { apiRoutes } from './apiRegistry';
import { securityAnalystAgent } from './agents/securityAnalystAgent'; // CHANGED
import { storage } from './storage';

export const mastra = new Mastra({
  agents: { securityAnalystAgent }, // CHANGED
  workflows: { chatWorkflow },
  storage,
  telemetry: {
    enabled: true,
  },
  server: {
    apiRoutes,
  },
});
```

### Update `src/backend/src/mastra/workflows/chatWorkflow.ts`

Change line 277:

```typescript
// OLD:
// const streamResult = await productRoadmapAgent.stream(messages, {

// NEW:
import { securityAnalystAgent } from '../agents/securityAnalystAgent';
const streamResult = await securityAnalystAgent.stream(messages, {
```

### Update `src/app/layout.tsx`

Add Cedar provider configuration:

```typescript
import { CedarProvider } from '@/app/cedar-os/context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CedarProvider providerConfig={{
          provider: 'mastra',
          baseURL: process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111',
          chatPath: '/workflows/chatWorkflow/execute-function/stream',
        }}>
          {children}
        </CedarProvider>
      </body>
    </html>
  );
}
```

---

## 🎯 **Step 4: Create New Security Dashboard (5 minutes)**

Create `src/app/security/page.tsx` (see files below).

Update navigation to link to `/security` instead of `/`.

---

## 🎯 **Step 5: Run Everything (5 minutes)**

### Terminal 1: Start Your Scanner Service
```bash
cd /Users/jesse/x/295capstone-assembly/scanner-service
python -m uvicorn web-api.main:app --reload --port 8000
```

### Terminal 2: Start Cedar Frontend
```bash
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun run dev
```

This starts:
- **Next.js frontend**: http://localhost:3000
- **Mastra backend**: http://localhost:4111

### Terminal 3: Run a Scan (to test)
```bash
# Trigger a scan from your existing frontend or:
curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "https://api.example.com",
    "spec_url": "https://api.example.com/openapi.json",
    "scanners": ["ventiapi"]
  }'
```

---

## 🎯 **Step 6: Test the Integration**

1. Open http://localhost:3000/security
2. You should see:
   - ✅ Vulnerability dashboard (empty until you run a scan)
   - ✅ Floating Cedar chat
   - ✅ "Run Scan" button

3. Click "Run Scan" or use your existing scanner UI
4. Watch AI analysis appear automatically in chat
5. Try asking: "Explain the BOLA vulnerabilities"
6. Try @mentioning specific endpoints

---

## 📝 **What You Get Immediately**

✅ **Cedar UI Components**: Floating chat, context badges, mentions  
✅ **Mastra Backend**: Workflows, agents, streaming  
✅ **Security Agent**: Pre-configured with security instructions  
✅ **State Management**: Vulnerabilities visible to AI  
✅ **Bridge to Scanner**: Connects to your Python service  
✅ **Auto-Analysis**: AI responds when scan completes  

---

## 🔄 **Integration Flow**

```
Your Scanner Service (Python)
         ↓ (REST API)
Scanner Bridge Tool (Mastra)
         ↓ (state update)
Cedar State Management
         ↓ (auto-subscribe)
Security Analyst Agent
         ↓ (streaming response)
Cedar Chat Component
```

---

## 🎨 **Customization Next Steps**

Once you have this running, you can:

1. **Add RAG**: Integrate your 50k embeddings database
2. **Enhance UI**: Customize vulnerability cards
3. **Add Tools**: CVE lookup, code example generation
4. **Improve Prompts**: Fine-tune agent instructions
5. **Add Memory**: Enable conversation history

All the patterns are in the starter - you just adapt them!

---

## 🐛 **Troubleshooting**

### Chat doesn't appear
- Check `.env` has `OPENAI_API_KEY`
- Verify Mastra backend running on :4111
- Check browser console for errors

### Can't connect to scanner
- Verify Python service running on :8000
- Check `SCANNER_SERVICE_URL` in `.env`
- Test scanner API directly with curl

### State not updating
- Check Cedar state hooks in component
- Verify `useRegisterState` called
- Check Mastra backend logs

---

## 📚 **Key Files Reference**

| File | Purpose |
|------|---------|
| `src/backend/src/mastra/agents/securityAnalystAgent.ts` | AI security expert |
| `src/app/cedar-os/scanState.ts` | Vulnerability state management |
| `src/backend/src/mastra/tools/scannerBridgeTool.ts` | Connects to Python scanner |
| `src/app/security/page.tsx` | Main security dashboard |
| `src/backend/src/mastra/workflows/chatWorkflow.ts` | Chat workflow (existing) |

---

## ✨ **Next: See the Actual Code Files**

The following files are ready to drop into your project. They're based on the cedar-mastra-starter patterns but adapted for security scanning.

**→ Continue to the code files below...**






