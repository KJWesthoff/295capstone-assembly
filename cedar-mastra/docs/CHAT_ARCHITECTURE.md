# Chat Architecture & Dashboard Integration

This document explains how the AI chat system works across different dashboards and user roles in VentiAPI.

## Overview

VentiAPI uses a context-aware AI chat system that adapts its communication style based on:
1. **Which page/dashboard the user is on** (executive, analyst, developer)
2. **What vulnerability findings the user has selected**
3. **What scan results are currently loaded**

The core idea: **same AI, different conversations** - a business owner on the executive dashboard gets plain-language help drafting emails to their developer, while a developer on their dashboard gets code snippets and technical details.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  Executive  │    │   Analyst   │    │  Developer  │                 │
│  │  Dashboard  │    │  Dashboard  │    │  Dashboard  │                 │
│  │  /executive │    │  /analyst   │    │  /developer │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            │                                            │
│                   ┌────────▼────────┐                                   │
│                   │ PageContext     │  ← Tracks current path            │
│                   │ Provider        │                                   │
│                   └────────┬────────┘                                   │
│                            │                                            │
│  ┌─────────────────────────┼─────────────────────────────────────────┐ │
│  │                Cedar OS Context System                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │ │
│  │  │ pageContext  │  │ scanResults  │  │ findings     │            │ │
│  │  │ (auto)       │  │ (subscribed) │  │ (manual add) │            │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │ │
│  │         │                 │                 │                     │ │
│  │         └─────────────────┼─────────────────┘                     │ │
│  │                           │                                       │ │
│  │                  ┌────────▼────────┐                              │ │
│  │                  │ additionalContext│ ← All context combined     │ │
│  │                  └────────┬────────┘                              │ │
│  └───────────────────────────┼───────────────────────────────────────┘ │
│                              │                                          │
│  ┌───────────────────────────┼───────────────────────────────────────┐ │
│  │              FloatingCedarChat Component                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │ │
│  │  │ ChatInput   │  │ ChatBubbles │  │ QuickActions│               │ │
│  │  │ (typing)    │  │ (messages)  │  │ (presets)   │               │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │ │
│  └───────────────────────────┬───────────────────────────────────────┘ │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   POST /chat/stream  │
                    └──────────┬──────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                        Backend (Mastra)                                  │
├──────────────────────────────┼──────────────────────────────────────────┤
│                              │                                          │
│  ┌───────────────────────────▼───────────────────────────────────────┐ │
│  │                     chatWorkflow.ts                                │ │
│  │                                                                    │ │
│  │  1. Extract pageContext (executive/analyst/developer)             │ │
│  │  2. Extract vulnerability findings                                │ │
│  │  3. Build enhanced prompt with:                                   │ │
│  │     - Core personality (always friendly "Venti")                  │ │
│  │     - Page-specific guidance (audience-appropriate tone)          │ │
│  │     - Formatted findings context                                  │ │
│  │                                                                    │ │
│  └───────────────────────────┬───────────────────────────────────────┘ │
│                              │                                          │
│  ┌───────────────────────────▼───────────────────────────────────────┐ │
│  │               securityAnalystAgent.ts                             │ │
│  │                                                                    │ │
│  │  - Receives enhanced prompt with context                          │ │
│  │  - Uses tools: scan-analysis-workflow, visualizeAttackPath, etc.  │ │
│  │  - Streams response back to frontend                              │ │
│  │                                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. PageContextProvider (`src/app/cedar-os/PageContextProvider.tsx`)

Automatically tracks which page the user is on and adds it to Cedar context.

```tsx
// In layout.tsx - wraps the entire app
<CedarCopilot llmProvider={llmProvider}>
  <PageContextProvider>
    {children}
  </PageContextProvider>
  <FloatingCedarChat />
</CedarCopilot>
```

The page context is detected from the URL path:
- `/executive` → `executive` (business owner/executive audience)
- `/analyst` → `analyst` (security analyst audience)
- `/developer` → `developer` (engineer audience)
- `/` or `/home` → `home` (general/new user)
- anything else → `other`

### 2. Cedar Context System

Cedar OS provides three ways to add context for the AI:

#### a) Automatic State Subscription
Subscribe React state to be automatically included in every message:

```tsx
// Example from context.ts - scanResults are auto-included
useSubscribeStateToAgentContext(
  'scanResults',
  (scanResults) => ({
    scanId: scanResults.scanId,
    summary: scanResults.summary,
    // ...
  }),
  { icon: <Shield />, color: '#3B82F6' }
);
```

#### b) Manual Context Entry
Users can click "Add to Chat" buttons to add specific items:

```tsx
// Example: Adding a vulnerability finding to discuss
const addContextEntry = useCedarStore(s => s.addContextEntry);
addContextEntry('finding', {
  id: finding.id,
  data: finding,
  label: finding.title,
});
```

#### c) Page Context (Automatic)
The `PageContextProvider` automatically adds the current path:

```tsx
setContextEntry('pageContext', [{
  id: 'current-page',
  label: `Viewing: ${pageContextType}`,
  data: {
    pathname,
    pageType: pageContextType,
  },
}]);
```

### 3. Chat Workflow (`src/backend/src/mastra/workflows/chatWorkflow.ts`)

The workflow receives the user's message plus all context and builds an enhanced prompt:

```
User's message
    +
Core Personality (always applied - friendly "Venti" assistant)
    +
Page-Specific Guidance (based on pageContext)
    +
Formatted Findings (if any selected)
    =
Enhanced Prompt → Security Analyst Agent
```

### 4. Quick Actions / Chat Presets

Each dashboard has pre-configured prompts that match its audience:

**Executive Presets** (`/executive`):
- "Help me understand" - For confused business owners
- "Draft email to developer" - Generate communication
- "What's most urgent?" - Plain-language prioritization
- "Could this hurt my business?" - Risk assessment

**Analyst Presets** (`/analyst`):
- "Validate Finding" - Technical validation
- "Prioritize Queue" - Risk-based ranking
- "Map to NIST" - Compliance mapping
- "Similar Cases" - Historical lookup

**Developer Presets** (`/developer`):
- "Priority Remediation" - Code fixes
- "Hot Patch Now" - Quick mitigations
- "Write Tests" - Test generation
- "Create Policy Rule" - Prevention rules

## How It Works: Step by Step

### Executive Dashboard Flow (Business Owner)

1. **User visits `/executive`**
   - `PageContextProvider` detects path → `pageType: 'executive'`
   - Context entry added: `{ pageType: 'executive', pathname: '/executive' }`

2. **User sees scan results with Critical findings**
   - `useScanResultsState()` loads findings into Cedar context
   - Summary automatically available to AI

3. **User clicks "Help me understand" quick action**
   - Preset instruction sent: "I received a security notification..."
   - Chat opens with pre-filled message

4. **Message sent to backend**
   ```json
   {
     "prompt": "I received a security notification...",
     "additionalContext": {
       "pageContext": [{ "data": { "pageType": "executive" } }],
       "scanResults": [{ "scanId": "...", "summary": {...} }]
     }
   }
   ```

5. **chatWorkflow builds enhanced prompt**
   - Detects `pageType === 'executive'`
   - Adds core personality (friendly Venti)
   - Adds executive guidance:
     - "Reassure first"
     - "Translate, don't educate"
     - "Interview briefly (2-3 questions)"
     - "Help draft email to developer"

6. **AI responds appropriately**
   ```
   Hey! I can see you've had some security issues flagged. First thing -
   don't panic. Let's figure out what's going on together.

   Quick question before we dive in: what brought you here today? Did
   you get an email from Google, your payment processor, or somewhere else?
   ```

### Developer Dashboard Flow

1. **Same scan, different context**
   - `pageType: 'developer'`
   - Developer guidance applied

2. **AI responds with code**
   ```
   Looking at this SQL injection in your login endpoint - here's the fix:

   ```python
   # Before (vulnerable)
   query = f"SELECT * FROM users WHERE email = '{email}'"

   # After (secure)
   query = "SELECT * FROM users WHERE email = %s"
   cursor.execute(query, (email,))
   ```

   The key is using parameterized queries...
   ```

## File Locations

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with CedarCopilot and PageContextProvider |
| `src/app/cedar-os/usePageContext.ts` | Hook to detect and register page context |
| `src/app/cedar-os/PageContextProvider.tsx` | Provider component wrapping the app |
| `src/app/cedar-os/context.ts` | State subscription hooks for Cedar |
| `src/config/chatPresets.ts` | Quick action presets for each dashboard |
| `src/backend/src/mastra/workflows/chatWorkflow.ts` | Backend prompt enhancement |
| `src/backend/src/mastra/agents/securityAnalystAgent.ts` | AI agent configuration |

## Adding a New Dashboard

1. **Create the page** at `src/app/[dashboard-name]/page.tsx`

2. **Add page detection** in `usePageContext.ts`:
   ```tsx
   export function getPageContextType(pathname: string): PageContextType {
     // ... existing checks
     if (pathname.startsWith('/my-new-dashboard')) return 'my-new-role';
     // ...
   }
   ```

3. **Add page guidance** in `chatWorkflow.ts`:
   ```tsx
   } else if (pageType === 'my-new-role') {
     pageGuidance = `
   [AUDIENCE: Description of who uses this dashboard]
   Your approach with them:
   - How to communicate
   - What they need
   ...`;
   }
   ```

4. **Create presets** in `chatPresets.ts`:
   ```tsx
   export const myNewRolePresets: ChatPreset[] = [
     {
       icon: SomeIcon,
       label: "Quick Action",
       description: "What this does",
       instruction: "The prompt to send",
     },
   ];
   ```

5. **Add ChatPresets component** to your dashboard:
   ```tsx
   <ChatPresets
     presets={myNewRolePresets}
     title="Quick AI Actions"
   />
   ```

## Customizing AI Personality

The AI's core personality is defined in `chatWorkflow.ts`:

```tsx
const corePersonality = `
[ROLE: Venti - Your Security Assistant]
You are Venti, a friendly and knowledgeable security assistant...

Your core traits:
- **Approachable**: You're a colleague, not a lecturer.
- **Practical**: Focus on what matters most.
- **Encouraging**: Make security feel manageable.
- **Clear**: Explain things in plain language.
- **Conversational**: Write in natural paragraphs.
`;
```

To modify the personality:
1. Edit the `corePersonality` constant in `chatWorkflow.ts`
2. The changes apply to all dashboards
3. Page-specific guidance then tailors the approach for each audience

## Debugging

### Check what context is being sent

1. Open the Cedar Debugger (F12 → Cedar tab, or click the bug icon)
2. Look at the "States" tab to see registered context
3. Look at the "Network" tab to see actual API requests

### Backend logs

The chatWorkflow logs context detection:
```
Page context detected: executive (/executive)
Enhanced prompt with core personality and executive page context
```

Check Mastra backend logs:
```bash
cd cedar-mastra/src/backend && bun run dev
# Watch console for context logs
```

## Common Issues

### AI not adapting to page

- Check `PageContextProvider` is wrapping your content
- Verify the path matches detection logic in `usePageContext.ts`
- Check backend logs for "Page context detected" message

### Quick actions not showing

- Ensure `ChatPresets` component is imported and rendered
- Check that presets array is exported from `chatPresets.ts`
- Verify the variant prop matches your layout needs

### Context not appearing in AI response

- Use Cedar Debugger to verify context is registered
- Check `additionalContext` in Network tab
- Verify the context extraction logic in `chatWorkflow.ts`
