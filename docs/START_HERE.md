# ⚡ START HERE - Cedar Security Dashboard

## 🎉 **You're 2 Minutes from Running Code!**

Your credentials are configured. Everything is ready. Let's go!

---

## 🚀 **Quick Start (2 commands)**

### 1️⃣ Install Dependencies (first time only)

```bash
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun install
cd src/backend && bun install && cd ../..
```

### 2️⃣ Start Everything

```bash
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun run dev
```

This starts:
- ✅ Next.js frontend on **http://localhost:3000**
- ✅ Mastra backend on **http://localhost:4111**

### 3️⃣ Visit Your Dashboard

Open: **http://localhost:3000/security**

---

## 🎯 **Try These in the Chat**

The floating chat should appear in the bottom-right. Try asking:

```
"Explain BOLA vulnerabilities"
"What's the difference between BOLA and BFLA?"
"Show me a code example of SQL injection prevention"
"What are the OWASP Top 10 API Security risks?"
"Tell me about the Equifax breach"
```

---

## 🗄️ **Your Database is Already Connected!**

Your existing PostgreSQL database with 50k NIST/CVE/CWE embeddings is configured:

```
Database: postgresql://rag_user:rag_pass@localhost:54320/rag_db
```

**Next step**: We'll integrate your embeddings with the Mastra RAG pipeline (Phase 2).

---

## 🔌 **Optional: Connect Your Python Scanner**

If you want to test the full flow:

**Terminal 2** (separate terminal):
```bash
cd /Users/jesse/x/295capstone-assembly/scanner-service
python -m uvicorn web-api.main:app --reload --port 8000
```

---

## 📁 **Key Files Reference**

| File | What It Does |
|------|--------------|
| `src/backend/src/mastra/agents/securityAnalystAgent.ts` | 🤖 The security AI brain |
| `src/app/cedar-os/scanState.ts` | 📊 Vulnerability state management |
| `src/app/security/page.tsx` | 🎨 The security dashboard UI |
| `src/backend/src/mastra/tools/scannerBridgeTool.ts` | 🔌 Connects to your Python scanner |

---

## 🎨 **What You'll See**

1. **Empty Dashboard** (until you load a scan)
   - Summary cards (Critical, High, Medium, Low)
   - "Run Security Scan" button
   - Floating AI chat

2. **Floating Cedar Chat**
   - Bottom-right corner
   - Click to expand
   - Type your security questions
   - Get real-time AI responses

3. **Cedar State DevTools**
   - Press F12 → Cedar tab
   - See registered states
   - Monitor context changes
   - Debug message flow

---

## 🔧 **Troubleshooting**

### Chat doesn't appear?
```bash
# Check if backend is running
curl http://localhost:4111/health

# Check .env file exists
cat cedar-frontend-prototype/.env | grep OPENAI_API_KEY
```

### Database connection error?
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 54320 -U rag_user

# If not, start it:
cd /Users/jesse/x/295capstone-assembly
docker-compose up -d
```

### Can't start dev server?
```bash
# Clear node_modules and reinstall
cd cedar-frontend-prototype
rm -rf node_modules package-lock.json
bun install
```

---

## 📊 **Current Status**

✅ **Completed**
- Cedar+Mastra prototype cloned
- Environment configured with your credentials
- Security Analyst agent created
- Scanner bridge tools ready
- Security dashboard UI built

🔨 **Next Steps** (Optional)
- Load a real scan result
- Connect 50k embeddings database
- Add RAG vector search
- Customize UI styling
- Deploy to production

---

## 🎓 **Learning the Codebase**

### Start Here:
1. Open `src/app/security/page.tsx` - See the dashboard UI
2. Open `src/app/cedar-os/scanState.ts` - See state management
3. Open `src/backend/src/mastra/agents/securityAnalystAgent.ts` - See the AI agent

### Key Patterns:
```typescript
// 1. Register state with Cedar
const [scanResults, setScanResults] = useCedarState({
  stateKey: 'scanResults',
  initialValue: null,
});

// 2. Add context entry (click button → AI sees it)
addContextEntry({
  id: finding.id,
  data: finding,
});

// 3. Agent automatically gets context
// No extra code needed!
```

---

## 💡 **Quick Experiments**

### Experiment 1: Test the AI (1 minute)
1. Start the app
2. Ask: "What is BOLA?"
3. See the structured response

### Experiment 2: Inspect State (2 minutes)
1. Press F12
2. Click "Cedar" tab
3. See registered states
4. Watch context changes

### Experiment 3: Customize Agent (5 minutes)
1. Edit `securityAnalystAgent.ts`
2. Change the instructions
3. Restart backend
4. Test the changes

---

## 🔗 **Quick Links**

- **Your Dashboard**: http://localhost:3000/security
- **Mastra Backend**: http://localhost:4111
- **Scanner API**: http://localhost:8000 (when running)

**Docs:**
- [Cedar Docs](https://docs.cedarcopilot.com)
- [Mastra Docs](https://mastra.ai)
- [Your SPIKE Doc](SPIKE_CEDEROS_INTEGRATION.md)

---

## 🎯 **What's Next?**

After you see it working:

**Phase 2: RAG Integration** (I can help!)
- Connect your 50k embeddings
- Add vector query tool
- Enable knowledge-based responses
- Test with real security questions

**Phase 3: Production Features**
- Custom message rendering
- Automatic scan analysis
- CVE lookup integration
- Beautiful vulnerability cards

---

## ✅ **Ready? Let's Go!**

```bash
cd /Users/jesse/x/295capstone-assembly/cedar-frontend-prototype
bun run dev
```

Then visit: **http://localhost:3000/security** 🚀

---

**Questions?** Check:
1. `IMMEDIATE_NEXT_STEPS.md` - Detailed guide
2. `SPIKE_CEDEROS_INTEGRATION.md` - Full technical design
3. `QUICKSTART_CEDAR.md` - Integration instructions

**Let's build something special!** 🔥





