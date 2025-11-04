# Cedar OS Integration Technical SPIKE

**Date**: November 3, 2025
**Project**: VentiAPI Security Dashboard - Cedar-Mastra Migration
**Context**: Session continuation from previous migration work

---

## Executive Summary

This SPIKE investigates the Cedar OS bridge pattern for integrating the migrated security dashboard views (Analyst, Developer, Executive) with Cedar's AI context system. The analysis covers the existing implementation patterns, required adaptations, and provides a complete handoff for the next implementation phase.

**Key Finding**: Cedar bridges are lightweight, invisible React components that use `useCedarState` and `useSubscribeStateToAgentContext` hooks to automatically sync application state to the AI agent's context.

---

## User's Initial Instructions (Context Retention)

The user requested:
1. **Continue migration work** from the previous session (SESSION-SUMMARY-2025-11-03.md)
2. **Migrate Developer View** - Fast-track vulnerabilities to safe PRs (4 components)
3. **Migrate Executive View** - Risk & compliance overview (9 components)
4. **Perform technical SPIKE on Cedar bridges** to understand integration patterns
5. **Create comprehensive handoff document** including:
   - Summary of entire conversation with initial instructions
   - LLM prompt for remaining work

---

## What Was Accomplished This Session

### Phase 1: Developer View Migration ✅ COMPLETE
**Created 4 Components:**
1. `src/components/developer/DeveloperView.tsx` - Main container
2. `src/components/developer/ChatPresets.tsx` - 6 AI action presets (Generate Fix PR, Hot Patch, Write Tests, Explain for Junior, Create Policy Rule, Deprecation Notice)
3. `src/components/developer/DeveloperFindingsTable.tsx` - Fixability-ranked table with:
   - Search by service, repo, file, path
   - Severity and framework filters
   - PR status and test status indicators
   - Keyboard shortcuts (Enter, Shift+A, Shift+P)
   - "Generate Fix PR" workflow actions
4. `src/components/developer/DeveloperDetailsDrawer.tsx` - Comprehensive drawer with:
   - 48-hour hot patch configs
   - Full code diffs (before/after)
   - Unit & integration tests
   - Guardrail/lint rules
   - PR body templates
   - Similar fixes from historical data

**Created Route:**
- `src/app/developer/page.tsx` - Developer dashboard at `/developer`

### Phase 2: Executive View Migration ✅ COMPLETE
**Created 1 Hook:**
1. `src/hooks/useExecutiveReportBridge.ts` - Cedar integration hook for executive reports

**Created 9 Components:**
1. `src/components/executive/AddToReportChip.tsx` - Small utility chip
2. `src/components/executive/ExecutiveChatPresets.tsx` - 4 executive AI presets (Board update, 2 actions, NIST posture, Impact estimate)
3. `src/components/executive/ExecutiveKPICards.tsx` - 5 KPI cards (Overall Risk, Critical/High, % Past SLA, Public Exploits, Internet-Facing)
4. `src/components/executive/ExecutiveTrendChart.tsx` - Risk trend sparkline + SLA health bars
5. `src/components/executive/ExecutiveComplianceSnapshot.tsx` - OWASP, CWE, NIST CSF, NIST 800-53 compliance
6. `src/components/executive/ExecutiveOwnershipTable.tsx` - Team ownership & SLA tracking
7. `src/components/executive/ExecutiveTopRisks.tsx` - Top 5 business risks with actions/owners/ETAs
8. `src/components/executive/BoardBriefWizard.tsx` - 3-step wizard (Scope → Tone/Length → Preview/Deliver)
9. `src/components/executive/ExecutiveView.tsx` - Main executive container

**Created Route:**
- `src/app/executive/page.tsx` - Executive dashboard at `/executive`

### Phase 3: Cedar OS Bridge Technical SPIKE ✅ IN PROGRESS

---

## Cedar OS Bridge Architecture Analysis

### Core Concepts

**Cedar OS** provides a state management system that automatically makes application state available to AI agents through a "context subscription" pattern.

**Key Components:**
1. **State Registration** - `useCedarState` registers state in Cedar's global store
2. **Context Subscription** - `useSubscribeStateToAgentContext` transforms and subscribes state to agent input
3. **Bridges** - Invisible components (`return null`) that orchestrate state syncing

### Cedar Hooks API

#### `useCedarState`
```typescript
const [state, setState] = useCedarState({
  key: string,              // Unique identifier for this state
  initialValue: T,          // Initial state value
  description: string       // Human-readable description
});
```

**Purpose**: Registers state in Cedar's global store with a key for retrieval.

#### `useSubscribeStateToAgentContext`
```typescript
useSubscribeStateToAgentContext(
  stateKey: string,                    // Must match useCedarState key
  transformer: (state: T) => object,   // Transform state for agent
  options?: {
    icon?: ReactNode,                  // Visual icon for context badge
    color?: string,                    // Color for context badge
    order?: number,                    // Display order
    labelField?: string | ((item: T) => string), // Label extractor
    showInChat?: (entry: T) => boolean,          // Filter function
    collapse?: {                       // Collapse UI when threshold exceeded
      threshold: number,
      label: string,
      icon: ReactNode
    }
  }
);
```

**Purpose**: Subscribes state to agent context with transformation and UI configuration.

### Bridge Pattern Implementation

**Example from secure-vision-chat:**

```typescript
// FindingsSelectionBridge.tsx
export function FindingsSelectionBridge({ selectedFindings }: Props) {
  // 1. Register state in Cedar
  const [selection, setSelection] = useCedarState({
    key: "selected-findings",
    initialValue: [],
    description: "Selected findings in the current view",
  });

  // 2. Sync React props → Cedar state
  useEffect(() => {
    setSelection(selectedFindings);
  }, [selectedFindings]);

  // 3. Subscribe to agent context with transformation
  useSubscribeStateToAgentContext(
    "selected-findings",
    (findings: Finding[]) => ({
      findings: findings.map((f) => ({
        id: f.id,
        endpoint: `${f.endpoint.method} ${f.endpoint.path}`,
        severity: f.severity,
        cvss: f.cvss,
        // ... transform to agent-friendly format
      })),
    }),
    {
      labelField: (f) => `${f.severity}: ${f.endpoint.method} ${f.endpoint.path}`,
      order: 5,
    }
  );

  return null; // Bridge is invisible
}
```

**Key Patterns:**
1. ✅ Bridge receives React state via props
2. ✅ Bridge uses `useCedarState` to register in Cedar store
3. ✅ Bridge uses `useEffect` to keep Cedar state synchronized
4. ✅ Bridge uses `useSubscribeStateToAgentContext` to expose to agent
5. ✅ Bridge transforms state to agent-friendly format (minimal, relevant fields)
6. ✅ Bridge returns `null` (purely functional, no UI)

### Data Flow Architecture

```
User Interaction
    ↓
React Component State (selectedFindings)
    ↓
Bridge Component Props
    ↓
useCedarState → Cedar Store (global)
    ↓
useSubscribeStateToAgentContext → Agent Context
    ↓
ChatInput → Mastra Agent
    ↓
AI Response
```

### Existing Bridges in secure-vision-chat

**1. FindingsSelectionBridge**
- **Purpose**: Syncs selected vulnerability findings to agent context
- **State Key**: `"selected-findings"`
- **Transformation**: Maps findings to minimal format (id, endpoint, severity, cvss, exploitPresent, owasp, cwe, status, priorityScore)
- **Usage**: Mounted in Security Analyst View when findings are selected

**2. ExecutiveDataBridge**
- **Purpose**: Syncs executive summary KPIs to agent context
- **State Key**: `"executive-summary"`
- **Transformation**: Maps summary to KPI fields (riskScore, critical, high, pastSlaPct, mttrMedian, mttrP95, publicExploitCount, internetFacingCount)
- **Usage**: Mounted in Executive View to provide risk metrics to agent

---

## Gap Analysis: What Needs to Be Done

### Current State
✅ All 3 views migrated (Analyst, Developer, Executive)
✅ All 19 components functional with mock data
✅ Routes created: `/dashboard`, `/developer`, `/executive`
✅ ContextBasketContext working for manual context addition
✅ Dev server running cleanly (http://localhost:3000)

### Missing Pieces

#### 1. Cedar Bridges Not Copied ⚠️
**Status**: Files exist in secure-vision-chat but not in cedar-mastra
**Location (source)**: `/Users/jesse/x/295capstone-assembly/secure-vision-chat/src/lib/cedar/`
- `bridges.tsx` - FindingsSelectionBridge, ExecutiveDataBridge
- `hooks.ts` - useCedarActions, cedarEstimateTokens

**Action Required**: Copy files to cedar-mastra with toast import fixes

#### 2. Bridges Not Mounted in Views ⚠️
**Status**: Views don't use bridges yet
**Action Required**: Mount bridges in:
- Security Analyst View → FindingsSelectionBridge
- Developer View → FindingsSelectionBridge (reuse)
- Executive View → ExecutiveDataBridge

#### 3. ChatInput Component Not Integrated ⚠️
**Status**: Views don't have Cedar chat UI
**Options**:
- Use `FloatingCedarChat` from cedar-os
- Use `ChatInput` from cedar-os
- Integrate with existing ContextBasket UI

#### 4. Styling Issues ⚠️
**Status**: User reported "styling is a little broken"
**Root Cause**: Missing CSS custom properties for severity colors
**Action Required**: Add to `src/app/globals.css`:
```css
:root {
  --critical: 0 84% 60%;      /* Red */
  --high: 25 95% 53%;         /* Orange */
  --medium: 45 93% 47%;       /* Yellow/Gold */
  --low: 142 76% 36%;         /* Green */
  --info: 199 89% 48%;        /* Blue */
}
```

#### 5. Backend Integration ⚠️
**Status**: All data is mocked
**Action Required**:
- Connect to scanner API (`/api/scan/results`)
- Replace mockFindings with real scan data
- Replace mockExecutiveData with real metrics
- Connect Mastra backend for AI responses

---

## Technical Decisions & Recommendations

### 1. Bridge Mounting Strategy

**Recommendation**: Mount bridges conditionally based on state presence

```typescript
// In SecurityAnalystView.tsx or DeveloperView.tsx
export const SecurityAnalystView = () => {
  const [selectedFindings, setSelectedFindings] = useState<Finding[]>([]);

  return (
    <div>
      {/* Mount bridge when selections exist */}
      {selectedFindings.length > 0 && (
        <FindingsSelectionBridge selectedFindings={selectedFindings} />
      )}

      <FindingsTable onSelectionChange={setSelectedFindings} />
      <ChatInput /> {/* Cedar chat UI */}
    </div>
  );
};
```

**Rationale**: Only sync state when relevant, reduces agent context clutter.

### 2. Chat UI Integration Strategy

**Option A: Floating Chat (Recommended)**
```typescript
import { FloatingCedarChat } from "cedar-os";

// Mount at top level (in page.tsx or layout)
<FloatingCedarChat />
```

**Pros**: Non-intrusive, always accessible, works across all views
**Cons**: Requires z-index management

**Option B: Embedded Chat**
```typescript
import { ChatInput } from "cedar-os";

// Embed in each view
<ChatInput placeholder="Ask about findings, risks, or compliance..." />
```

**Pros**: Context-aware per view, integrated design
**Cons**: Duplicate chat instances, state management complexity

**Recommendation**: Use **Option A (Floating Chat)** for simplicity and consistency.

### 3. State Transformation Guidelines

**Principle**: Transform state to minimal, agent-relevant format

**Good Transformation** ✅
```typescript
// Only include fields the agent needs
findings: findings.map(f => ({
  id: f.id,
  severity: f.severity,
  cvss: f.cvss,
  endpoint: `${f.endpoint.method} ${f.endpoint.path}`,
  status: f.status,
}))
```

**Bad Transformation** ❌
```typescript
// Sending entire object wastes tokens
findings: findings // Don't do this!
```

### 4. Cedar Provider Strategy

**Current Setup**: cedar-mastra uses Mastra backend (port 4111)

**Recommendation**: Configure Cedar to use Mastra provider
```typescript
// In app/layout.tsx or provider wrapper
<CedarProvider
  provider={{
    type: "mastra",
    url: "http://localhost:4111",
  }}
>
  {children}
</CedarProvider>
```

---

## File Structure After Integration

```
cedar-mastra/
├── src/
│   ├── app/
│   │   ├── dashboard/page.tsx         # Security Analyst (with bridge)
│   │   ├── developer/page.tsx         # Developer (with bridge)
│   │   ├── executive/page.tsx         # Executive (with bridge)
│   │   └── layout.tsx                 # Mount FloatingCedarChat here
│   ├── components/
│   │   ├── analyst/                   # 5 components ✅
│   │   ├── developer/                 # 4 components ✅
│   │   └── executive/                 # 9 components ✅
│   ├── lib/
│   │   └── cedar/
│   │       ├── bridges.tsx            # ⚠️ TO COPY
│   │       ├── hooks.ts               # ⚠️ TO COPY
│   │       └── actions.ts             # ✅ EXISTS (workflow stubs)
│   ├── hooks/
│   │   └── useExecutiveReportBridge.ts # ✅ EXISTS
│   ├── contexts/
│   │   └── ContextBasketContext.tsx   # ✅ EXISTS
│   ├── types/
│   │   └── finding.ts                 # ✅ EXISTS
│   └── data/
│       ├── mockFindings.ts            # ✅ EXISTS
│       └── mockExecutiveData.ts       # ✅ EXISTS
```

---

## Testing Strategy

### Phase 1: Verify Bridge Mounting
1. Copy bridges and hooks to cedar-mastra
2. Mount FindingsSelectionBridge in SecurityAnalystView
3. Select findings in table
4. Open Cedar DevTools (F12 → Cedar tab)
5. Verify "selected-findings" appears in registered states

### Phase 2: Verify Agent Context
1. Mount FloatingCedarChat in layout
2. Select findings
3. Open chat, type message
4. Check Network tab for agent request
5. Verify findings appear in agent context payload

### Phase 3: End-to-End AI Interaction
1. Select critical findings
2. Ask agent: "Summarize the critical findings and suggest fixes"
3. Verify agent response references the selected findings
4. Test workflow actions (mark FP, assign owner, etc.)

---

## Known Issues & Workarounds

### Issue 1: useExecutiveReportBridge uses addContextEntry
**Description**: `useExecutiveReportBridge` manually calls `addContextEntry` instead of using bridge pattern
**Impact**: Executive data isn't automatically synced, requires manual "Add to Chat" clicks
**Workaround**: Keep current implementation, add ExecutiveDataBridge for automatic sync in future

### Issue 2: Multiple Background Servers Running
**Description**: Dev server logs show 9+ duplicate background processes
**Impact**: Performance degradation, port conflicts
**Workaround**: Kill all background processes, restart cleanly:
```bash
# Kill all node processes
pkill -f "npm run dev"
pkill -f "next dev"

# Clean restart
cd /Users/jesse/x/295capstone-assembly/cedar-mastra
rm -rf .next
npm run dev:next
```

### Issue 3: Styling Issues
**Description**: User reported "styling is a little broken"
**Root Cause**: Missing CSS custom properties for severity colors
**Fix**: Already documented in Gap Analysis section

---

## Dependencies & Versions

**Confirmed Installed:**
- Cedar OS: `v0.1.23`
- Next.js: `15.4.4`
- React: `19.1.0`
- Recharts: `v3.3.0`
- All Radix UI components installed

**Environment:**
- Node version: ≥20.9.0 (required for Mastra)
- Dev server: http://localhost:3000
- Mastra backend: http://localhost:4111

---

## Next Session Handoff: LLM Prompt

```markdown
# VentiAPI Security Dashboard - Cedar Integration Implementation

## Context
You are continuing the migration of the VentiAPI security dashboard from secure-vision-chat (Vite) to cedar-mastra (Next.js). The previous developer successfully migrated all 19 components across 3 views (Security Analyst, Developer, Executive) with full functionality using mock data. All views are accessible at:
- http://localhost:3000/dashboard (Security Analyst)
- http://localhost:3000/developer (Developer)
- http://localhost:3000/executive (Executive)

The dev server is running cleanly with no compilation errors.

## Your Task
Integrate Cedar OS bridges to enable AI agent context awareness. This will allow the AI to automatically see and respond to user selections (findings, executive data, etc.) without manual "Add to Chat" actions.

## Step-by-Step Instructions

### Phase 1: Copy Cedar Integration Files
1. Copy `/Users/jesse/x/295capstone-assembly/secure-vision-chat/src/lib/cedar/bridges.tsx`
   → `/Users/jesse/x/295capstone-assembly/cedar-mastra/src/lib/cedar/bridges.tsx`

2. Copy `/Users/jesse/x/295capstone-assembly/secure-vision-chat/src/lib/cedar/hooks.ts`
   → `/Users/jesse/x/295capstone-assembly/cedar-mastra/src/lib/cedar/hooks.ts`

3. **IMPORTANT**: Fix toast imports in `hooks.ts`:
   - Change: `import { toast } from "@/hooks/use-toast";`
   - To: `import { toast } from "sonner";`
   - Change: `toast({ title: "...", description: "..." })`
   - To: `toast.success("...")` or `toast.error("...")`

### Phase 2: Mount Bridges in Views

**2a. Security Analyst View** (`src/app/dashboard/page.tsx`)
```typescript
import { FindingsSelectionBridge } from "@/lib/cedar/bridges";
import { FloatingCedarChat } from "cedar-os";

export default function DashboardPage() {
  const [selectedFindings, setSelectedFindings] = useState<Finding[]>([]);

  return (
    <ContextBasketProvider>
      {selectedFindings.length > 0 && (
        <FindingsSelectionBridge selectedFindings={selectedFindings} />
      )}

      <SecurityAnalystView onSelectionChange={setSelectedFindings} />
      <FloatingCedarChat />
    </ContextBasketProvider>
  );
}
```

**2b. Developer View** (`src/app/developer/page.tsx`)
```typescript
import { FindingsSelectionBridge } from "@/lib/cedar/bridges";
import { FloatingCedarChat } from "cedar-os";

export default function DeveloperPage() {
  const [selectedFindings, setSelectedFindings] = useState<Finding[]>([]);

  return (
    <ContextBasketProvider>
      {selectedFindings.length > 0 && (
        <FindingsSelectionBridge selectedFindings={selectedFindings} />
      )}

      <DeveloperView onSelectionChange={setSelectedFindings} />
      <FloatingCedarChat />
    </ContextBasketProvider>
  );
}
```

**2c. Executive View** (`src/app/executive/page.tsx`)
```typescript
import { ExecutiveDataBridge } from "@/lib/cedar/bridges";
import { FloatingCedarChat } from "cedar-os";
import { mockExecSummary } from "@/data/mockExecutiveData";

export default function ExecutivePage() {
  return (
    <ContextBasketProvider>
      <ExecutiveDataBridge summary={mockExecSummary} />

      <ExecutiveView />
      <FloatingCedarChat />
    </ContextBasketProvider>
  );
}
```

**2d. Update View Components to Support onSelectionChange**
You'll need to modify SecurityAnalystView and DeveloperView to expose selection state:
- Add `onSelectionChange?: (findings: Finding[]) => void` prop
- Call it from FindingsTable when selection changes
- Pass selectedFindings state from table up to parent view

### Phase 3: Fix Styling Issues
Add missing CSS custom properties to `src/app/globals.css`:
```css
:root {
  --critical: 0 84% 60%;      /* Red */
  --high: 25 95% 53%;         /* Orange */
  --medium: 45 93% 47%;       /* Yellow/Gold */
  --low: 142 76% 36%;         /* Green */
  --info: 199 89% 48%;        /* Blue */
}
```

### Phase 4: Test Cedar Integration
1. Restart dev server: `rm -rf .next && npm run dev:next`
2. Navigate to http://localhost:3000/dashboard
3. Select some findings in the table
4. Open browser DevTools → Console
5. Open Cedar DevTools (if available) or check Cedar state in React DevTools
6. Verify "selected-findings" state is registered
7. Open FloatingCedarChat
8. Type: "Summarize the selected findings"
9. Verify agent response references the specific findings you selected

### Phase 5: Verify All Views
Test each view:
- ✅ Security Analyst (/dashboard) - Select findings, ask agent about them
- ✅ Developer (/developer) - Select findings, ask for PR generation
- ✅ Executive (/executive) - Ask about risk score, compliance, top risks

## Expected Behavior After Integration
- ✅ Selecting findings in table automatically adds them to agent context
- ✅ No need to click "Add to Chat" manually (though button still works)
- ✅ Agent responses reference specific selected findings
- ✅ FloatingCedarChat appears in bottom-right corner
- ✅ Styling looks correct with proper severity colors

## Files to Check/Modify
- `src/lib/cedar/bridges.tsx` (copy from secure-vision-chat)
- `src/lib/cedar/hooks.ts` (copy from secure-vision-chat, fix toast)
- `src/app/dashboard/page.tsx` (mount bridge)
- `src/app/developer/page.tsx` (mount bridge)
- `src/app/executive/page.tsx` (mount bridge)
- `src/components/analyst/SecurityAnalystView.tsx` (add onSelectionChange)
- `src/components/developer/DeveloperView.tsx` (add onSelectionChange)
- `src/app/globals.css` (add CSS custom properties)

## Important Notes
- Cedar OS v0.1.23 is already installed
- All UI components (FindingsTable, etc.) already functional
- Mock data is already set up and working
- Don't modify backend or Mastra agent code yet
- Focus only on Cedar frontend integration

## Success Criteria
- [ ] Bridges copied and toast imports fixed
- [ ] Bridges mounted in all 3 views
- [ ] FloatingCedarChat visible on all pages
- [ ] Selected findings appear in Cedar state (verify in DevTools)
- [ ] Agent responses reference selected findings
- [ ] Styling issues fixed (severity colors visible)
- [ ] No TypeScript compilation errors
- [ ] Dev server running cleanly

## If You Encounter Issues
1. **"Module not found" errors**: Run `npm install` and restart dev server
2. **TypeScript errors**: Check import paths use `@/` alias correctly
3. **Bridge not working**: Verify useCedarState key matches useSubscribeStateToAgentContext key
4. **FloatingCedarChat not appearing**: Check it's imported from "cedar-os" package
5. **Agent not seeing context**: Verify bridge is mounted and state is updating

Good luck! The foundation is solid - you're just connecting the final pieces.
```

---

## Appendix A: Complete Migration Timeline

### Previous Session (Nov 3, Morning)
- ✅ Installed all dependencies (Radix UI, recharts, Cedar OS)
- ✅ Created data layer (types, mockFindings, mockExecutiveData)
- ✅ Migrated Security Analyst View (5 components)
- ✅ Created /dashboard route
- ⚠️ User reported minor styling issues

### This Session (Nov 3, Afternoon)
- ✅ Migrated Developer View (4 components)
- ✅ Created /developer route
- ✅ Migrated Executive View (9 components + 1 hook)
- ✅ Created /executive route
- ✅ Performed Cedar OS bridge technical SPIKE
- ✅ Created comprehensive handoff documentation

### Next Session (TBD)
- ⏳ Copy Cedar bridges and hooks
- ⏳ Mount bridges in all views
- ⏳ Integrate FloatingCedarChat
- ⏳ Fix styling issues
- ⏳ Test Cedar integration end-to-end
- ⏳ Backend integration (scanner API, Mastra)

---

## Appendix B: Key File Locations

### Source (secure-vision-chat)
- Bridges: `/Users/jesse/x/295capstone-assembly/secure-vision-chat/src/lib/cedar/bridges.tsx`
- Hooks: `/Users/jesse/x/295capstone-assembly/secure-vision-chat/src/lib/cedar/hooks.ts`

### Destination (cedar-mastra)
- Components: `/Users/jesse/x/295capstone-assembly/cedar-mastra/src/components/`
  - analyst/ (5 files)
  - developer/ (4 files)
  - executive/ (9 files)
- Routes: `/Users/jesse/x/295capstone-assembly/cedar-mastra/src/app/`
  - dashboard/page.tsx
  - developer/page.tsx
  - executive/page.tsx
- Cedar integration: `/Users/jesse/x/295capstone-assembly/cedar-mastra/src/lib/cedar/`
  - actions.ts (exists)
  - bridges.tsx (TO COPY)
  - hooks.ts (TO COPY)

### Data & Types
- Types: `src/types/finding.ts`
- Mock data: `src/data/mockFindings.ts`, `src/data/mockExecutiveData.ts`
- Context: `src/contexts/ContextBasketContext.tsx`

---

## Appendix C: Useful Commands

```bash
# Start dev server
cd /Users/jesse/x/295capstone-assembly/cedar-mastra
npm run dev:next

# Clean restart
rm -rf .next && npm run dev:next

# Check running processes
ps aux | grep node

# Kill all node processes (if needed)
pkill -f "npm run dev"
pkill -f "next dev"

# Test Mastra backend
curl http://localhost:4111/health

# Install missing packages (if needed)
npm install cedar-os@^0.1.23
```

---

## Document Version
**Version**: 1.0
**Last Updated**: 2025-11-03
**Next Review**: After Cedar integration complete

---

*End of Technical SPIKE Document*
