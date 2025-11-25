# Implementation Prompt: Interactive Security Dashboard Components

## Project Overview

**VentiAPI Scanner - Cedar Security Dashboard** is an AI-powered API security testing platform that helps developers identify and remediate OWASP API Security Top 10 vulnerabilities. The dashboard combines:

- **Mastra Framework**: RAG-powered AI agents for vulnerability analysis
- **Cedar OS**: React state management and UI component library
- **Python Scanner Service**: Multi-engine vulnerability scanner (VentiAPI, OWASP ZAP)

### What Makes This Special

This isn't just another security tool - it's a **developer-focused security assistant** that:
- Explains vulnerabilities in plain English with visual attack flow diagrams
- Generates production-ready fixes with tests
- Provides context-aware remediation guidance
- Integrates AI assistance directly into the security workflow

### Current Features

- **Security Analyst Agent**: OWASP expert that analyzes vulnerabilities
- **Visual Attack Path Generator**: Mermaid diagrams showing exploitation flows
- **GitHub Advisory Integration**: Real-world CVE data and code examples
- **Floating Debug Panel**: Network/Message/State inspection
- **Chat-based interaction**: Natural language security analysis

## Your Mission

Implement **three interactive Cedar OS components** to create an incredibly slick, modern security dashboard experience:

1. **RadialMenuSpell** - Context-sensitive radial menus
2. **TooltipMenuSpell** - Smart context menus and tooltips
3. **QuestioningSpell** - Interactive guided workflows

These will transform the dashboard from "just another security tool" into a **delightful, magical experience** that makes security fun and intuitive.

---

## Available Cedar OS Components

You have access to a rich component library. Here's the complete catalog:

### 📦 Containers & Layout
- `FloatingContainer` - Draggable, resizable floating windows (✅ Already used for diagrams)
- `SidePanelContainer` - Sliding side panels
- `Container3D` / `Flat3dContainer` - 3D perspective containers
- `GlassyPaneContainer` - Glassmorphism effects

### 💬 Chat Components
- `FloatingCedarChat` - Floating draggable chat (✅ Active)
- `SidePanelCedarChat` - Chat in side panel
- `EmbeddedCedarChat` - Embedded inline chat
- `CedarCaptionChat` - Caption-style chat overlay

### ✨ Visual Effects
- `GlowingMesh` / `GlowingMeshGradient` - Animated glowing mesh backgrounds
- `GradientMesh` - Gradient mesh effects
- `InsetGlow` - Inset glow effects
- `ShimmerText` - Shimmering text animation
- `PhantomText` - Ghostly text effects
- `TypewriterText` - Typewriter animation

### 🎯 Interactive Elements (YOUR TARGETS)
- **`RadialMenuSpell`** - Radial menu for quick actions ⭐
- **`TooltipMenuSpell` / `TooltipMenu`** - Context menus ⭐
- **`QuestioningSpell`** - Interactive questioning UI ⭐
- `SliderSpell` / `RangeSliderSpell` - Animated sliders
- `Slider3D` - 3D slider component

### 📊 Data Display
- `TodoList` - Todo list with checkboxes
- `DiffContainer` / `DiffText` - Code diff visualization
- `Storyline` / `StorylineEdge` - Story/timeline visualization
- `DialogueOptions` - Multiple choice dialogue
- `MultipleChoice` - Multiple choice component
- `MermaidDiagram` - Mermaid diagram renderer (✅ Enhanced with floating window)

### 🎭 UI Primitives
- `Dialog` - Modal dialogs (Radix UI)
- `Tabs` - Tab navigation
- `DropdownMenu` - Dropdown menus
- `Command` - Command palette
- `Button` - Styled buttons

### 🎤 Voice & Audio
- `VoiceIndicator` - Audio level visualization

### 🛠 Dev Tools
- `DebuggerPanel` - Interactive debugger with tabs (✅ Active)
- `MessagesTab` / `NetworkTab` / `StatesTab` - Debug panels
- `CollapsibleSection` - Collapsible sections

---

## Implementation Requirements

### 1. RadialMenuSpell - Context-Sensitive Radial Menus

#### Use Case: Right-click on Vulnerability Findings

**Location**: Findings tables (`src/components/analyst/FindingsTable.tsx`, `src/components/developer/DeveloperFindingsTable.tsx`)

**Trigger**: Right-click or long-press on a vulnerability row

**Actions Menu**:
```tsx
const menuItems = [
  { icon: '🎨', label: 'Visualize Attack', action: () => generateDiagram(finding) },
  { icon: '📋', label: 'Copy Details', action: () => copyToClipboard(finding) },
  { icon: '🔍', label: 'Deep Dive', action: () => deepAnalyze(finding) },
  { icon: '🛠️', label: 'Generate Fix', action: () => createFix(finding) },
  { icon: '⚠️', label: 'Mark False Positive', action: () => markFalsePositive(finding) },
  { icon: '📤', label: 'Export', action: () => exportReport(finding) },
];
```

**Expected Behavior**:
- Smooth circular animation when menu appears
- Items arranged radially (like a pie menu)
- Hover effect highlights segments
- Click outside to dismiss
- Respects screen boundaries (don't cut off menu)

**Integration Points**:
- Use `useFindingActions` hook from `src/lib/cedar/useFindingActions.ts` for actions
- Add context to chat when "Deep Dive" clicked
- Call `visualizeAttackPathTool` when "Visualize Attack" clicked

#### Additional Use Cases to Implement

**2. Code Snippet Actions**
- Location: Within `proposedDiff` code blocks
- Trigger: Right-click on code
- Actions: "Explain Code", "Find Similar", "Copy", "Apply Fix"

**3. Chat Message Actions**
- Location: AI response bubbles in chat
- Trigger: Right-click on message
- Actions: "👍 Good", "👎 Improve", "📋 Copy", "🔄 Regenerate"

---

### 2. TooltipMenuSpell - Smart Context Menus

#### Use Case: Hover-Based Quick Actions

**Location 1: Vulnerability Severity Badges**
- Hover over severity badge → Shows:
  - CVE IDs (clickable links to NVD)
  - CWE categories
  - CVSS score breakdown
  - Quick action buttons

**Location 2: Endpoint Paths**
- Hover over endpoint (e.g., `POST /v1/auth/login`)
- Shows:
  - Service name and repo
  - Framework (Node/Express, Python/Django, etc.)
  - Related findings count
  - "Test Endpoint" button

**Location 3: Code Snippets**
- Hover toolbar on code blocks with:
  - Language indicator
  - Copy button
  - "Explain" button
  - "Run Tests" button (if test code)

**Expected Behavior**:
- Smooth fade-in animation
- Auto-positioning (flip to stay on screen)
- Accessible (keyboard navigation)
- Dismisses on mouse leave or click outside
- Can be "pinned" to stay open

**Implementation Pattern**:
```tsx
<TooltipMenuSpell
  trigger={<Badge severity={finding.severity} />}
  content={
    <div className="space-y-2">
      <div className="font-semibold">CVE-2023-12345</div>
      <div className="text-sm">CWE-89 (SQL Injection)</div>
      <div className="text-xs">CVSS: 9.1 Critical</div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={() => openNVD()}>View NVD</Button>
        <Button size="sm" onClick={() => showExamples()}>Examples</Button>
      </div>
    </div>
  }
  position="auto"
  pinnable={true}
/>
```

---

### 3. QuestioningSpell - Interactive Guided Workflows

#### Use Case 1: Guided Remediation Flow

**Trigger**: User clicks "Fix This" button on a vulnerability

**Question Flow**:
```tsx
const remediationQuestions = [
  {
    id: 'timeline',
    question: 'When do you need this fixed?',
    type: 'single-choice',
    options: [
      {
        value: 'immediate',
        label: '🔥 Immediate (Hot patch)',
        description: 'Critical production issue - deploy ASAP'
      },
      {
        value: 'sprint',
        label: '📅 This Sprint',
        description: 'Include in current sprint planning'
      },
      {
        value: 'backlog',
        label: '📝 Add to Backlog',
        description: 'Prioritize with other technical debt'
      },
    ],
  },
  {
    id: 'approach',
    question: 'What fix approach do you prefer?',
    type: 'single-choice',
    options: [
      {
        value: 'quick-patch',
        label: '⚡ Quick Patch',
        description: 'Minimal changes, might not be perfect but fast'
      },
      {
        value: 'refactor',
        label: '🏗️ Proper Refactor',
        description: 'Clean solution, might require breaking changes'
      },
      {
        value: 'hybrid',
        label: '🎯 Hybrid',
        description: 'Quick fix now + refactor task for later'
      },
    ],
  },
  {
    id: 'testing',
    question: 'Testing requirements?',
    type: 'multi-choice',
    options: [
      { value: 'unit', label: '✅ Unit Tests' },
      { value: 'integration', label: '🔗 Integration Tests' },
      { value: 'e2e', label: '🌐 E2E Tests' },
      { value: 'manual', label: '👨‍💻 Manual Test Plan' },
    ],
  },
];
```

**After Completion**:
- Generate customized fix based on answers
- Create GitHub PR with appropriate labels
- Schedule tasks in project management tool
- Add to sprint board if "This Sprint" selected

#### Use Case 2: Scan Configuration Wizard

**Trigger**: Before starting a new security scan

**Question Flow**:
```tsx
const scanConfigQuestions = [
  {
    id: 'target-type',
    question: 'What are you scanning?',
    type: 'single-choice',
    options: [
      { value: 'rest-api', label: '🔌 REST API' },
      { value: 'graphql', label: '🎯 GraphQL API' },
      { value: 'web-app', label: '🌐 Web Application' },
      { value: 'mobile-backend', label: '📱 Mobile Backend' },
    ],
  },
  {
    id: 'scan-depth',
    question: 'How thorough should the scan be?',
    type: 'single-choice',
    options: [
      { value: 'quick', label: '⚡ Quick (5-10 min)', description: 'Basic checks only' },
      { value: 'standard', label: '📊 Standard (20-30 min)', description: 'Recommended for most cases' },
      { value: 'deep', label: '🔬 Deep (1-2 hours)', description: 'Comprehensive analysis' },
    ],
  },
  {
    id: 'scan-options',
    question: 'Additional scan options?',
    type: 'multi-choice',
    options: [
      { value: 'auth', label: '🔐 Test Authentication' },
      { value: 'rate-limit', label: '🚦 Check Rate Limiting' },
      { value: 'injection', label: '💉 Deep Injection Tests' },
      { value: 'experimental', label: '🧪 Experimental Checks' },
    ],
  },
];
```

#### Use Case 3: Alert Triage Assistant

**Trigger**: When new Critical/High vulnerability detected

**Question Flow**:
```tsx
const triageQuestions = [
  {
    id: 'environment',
    question: 'Where is this code running?',
    type: 'single-choice',
    options: [
      { value: 'production', label: '🔴 Production' },
      { value: 'staging', label: '🟡 Staging' },
      { value: 'dev', label: '🟢 Development Only' },
    ],
  },
  {
    id: 'data-risk',
    question: 'What data is at risk?',
    type: 'multi-choice',
    options: [
      { value: 'pii', label: '👤 Personal Information (PII)' },
      { value: 'payment', label: '💳 Payment Data' },
      { value: 'health', label: '🏥 Health Records (PHI)' },
      { value: 'auth', label: '🔑 Authentication Tokens' },
      { value: 'other', label: '📄 Other Sensitive Data' },
    ],
  },
  {
    id: 'assignment',
    question: 'Who should handle this?',
    type: 'single-choice',
    options: [
      { value: 'me', label: '👨‍💻 I\'ll fix it' },
      { value: 'security', label: '🛡️ Security Team' },
      { value: 'dev-team', label: '👥 Development Team' },
      { value: 'escalate', label: '⬆️ Escalate to Management' },
    ],
  },
];
```

**After Completion**:
- Auto-create Jira/Linear ticket
- Send Slack notification to appropriate team
- Add to incident response log if production
- Schedule post-mortem if critical

---

## Implementation Checklist

### Phase 1: RadialMenuSpell
- [ ] Read RadialMenuSpell component source to understand API
- [ ] Add to FindingsTable for vulnerability actions
- [ ] Integrate with `useFindingActions` hook
- [ ] Add keyboard shortcuts (e.g., right-arrow to cycle options)
- [ ] Test on mobile (long-press to trigger)

### Phase 2: TooltipMenuSpell
- [ ] Read TooltipMenuSpell/TooltipMenu component source
- [ ] Add to severity badges with CVE/CWE info
- [ ] Add to endpoint paths with service metadata
- [ ] Add toolbar to code blocks
- [ ] Implement pinning functionality
- [ ] Test accessibility (keyboard navigation, screen readers)

### Phase 3: QuestioningSpell
- [ ] Read QuestioningSpell component source
- [ ] Implement remediation flow (Fix This button)
- [ ] Implement scan configuration wizard
- [ ] Implement alert triage assistant
- [ ] Connect to Mastra agent for customized responses
- [ ] Test multi-step flows and answer persistence

### Phase 4: Integration & Polish
- [ ] Ensure all components work together (e.g., radial menu → questioning spell)
- [ ] Add smooth animations and transitions
- [ ] Test on different screen sizes
- [ ] Add error handling and loading states
- [ ] Document usage for other developers

---

## Technical Implementation Notes

### Component Location Strategy

**Cedar OS components live in**: `/Users/jesse/x/295capstone-assembly/cedar-mastra/src/app/cedar-os/components/`

**Your new components should integrate into**:
- `src/components/analyst/` - Security analyst dashboard
- `src/components/developer/` - Developer dashboard
- `src/components/executive/` - Executive dashboard
- `src/components/shared/` - Shared components across all dashboards

### State Management

Use Cedar's `useCedarState` hook for state that should be visible to AI agents:

```tsx
import { useCedarState } from 'cedar-os';

// Register state so AI can see it
useCedarState({
  stateKey: 'selectedFinding',
  value: selectedFinding,
  schema: FindingSchema,
  setter: setSelectedFinding,
});
```

### Integration with Mastra Agents

When user selects "Deep Dive" or similar actions, add context to chat:

```tsx
import { useCedarStore } from 'cedar-os';

const store = useCedarStore();

const handleDeepDive = (finding) => {
  // Add to Cedar context
  store.addToContext(`finding-${finding.id}`, {
    data: finding,
    source: 'manual',
  });

  // Open chat if not already open
  // Optionally auto-send a message
  store.sendMessage(`Can you do a deep dive analysis on this ${finding.owasp} vulnerability in ${finding.endpoint.path}?`);
};
```

### Styling Conventions

- Use Tailwind CSS classes
- Dark theme is primary (`bg-gray-900`, `text-white`, etc.)
- Accent color: Blue (`bg-blue-600`, `hover:bg-blue-700`)
- Severity colors:
  - Critical: `text-red-600` / `bg-red-100`
  - High: `text-orange-600` / `bg-orange-100`
  - Medium: `text-yellow-600` / `bg-yellow-100`
  - Low: `text-blue-600` / `bg-blue-100`

---

## Success Criteria

Your implementation will be successful when:

1. **RadialMenuSpell is magical**:
   - Smooth, beautiful animations
   - Feels natural and intuitive
   - Works on both desktop (right-click) and mobile (long-press)
   - All actions integrate with existing hooks and agents

2. **TooltipMenuSpell enhances UX**:
   - Provides contextual information exactly when needed
   - Doesn't obstruct the interface
   - Accessible to keyboard users and screen readers
   - Can be pinned for reference while working

3. **QuestioningSpell guides users effectively**:
   - Reduces decision paralysis ("What should I do about this vuln?")
   - Collects enough info to generate perfect fixes
   - Feels conversational, not like filling out a form
   - Results in higher-quality automated outputs

4. **Overall polish**:
   - Components work beautifully together
   - No jank, no bugs, smooth as butter
   - Delightful to use - makes security work FUN
   - Demo-ready quality

---

## Bonus Ideas (Optional, but Awesome)

### Component Combinations

**1. RadialMenu → QuestioningSpell Flow**
- Right-click finding → Radial menu appears
- Select "Fix This" → QuestioningSpell guides remediation
- After questions → Generate fix with Mastra agent

**2. TooltipMenu with Embedded Actions**
- Hover CVE badge → Tooltip appears with details
- Click "Show Examples" in tooltip → Queries GitHub Advisories tool
- Results stream into a new FloatingContainer

**3. Visual Feedback Loop**
- Complete QuestioningSpell flow
- Show TypewriterText animation: "Generating your custom fix..."
- Display PhantomText showing AI "thinking"
- Results appear with ShimmerText effect

### Advanced Interactions

**Keyboard Power-User Mode**:
- `Ctrl+Shift+F` → Open radial menu on selected finding
- Arrow keys to navigate radial options
- `/` in QuestioningSpell to search options
- `Esc` always closes everything

**Mobile Gestures**:
- Swipe left on finding row → Quick actions
- Long-press → Radial menu
- Pinch-to-zoom on code diffs

---

## Resources & References

### Key Files to Study

**Components**:
- `/src/app/cedar-os/components/spells/RadialMenuSpell.tsx`
- `/src/app/cedar-os/components/spells/TooltipMenuSpell.tsx`
- `/src/app/cedar-os/components/spells/QuestioningSpell.tsx`

**Existing Integration Points**:
- `/src/components/analyst/FindingsTable.tsx` - Main vulnerability table
- `/src/components/analyst/FindingDetailsDrawer.tsx` - Details sidebar
- `/src/lib/cedar/useFindingActions.ts` - Action hooks

**State & Context**:
- `/src/app/cedar-os/scanState.ts` - Scan state management
- `/src/app/cedar-os/index.ts` - Cedar OS exports

**Backend**:
- `/src/backend/src/mastra/agents/securityAnalystAgent.ts` - AI agent
- `/src/backend/src/mastra/tools/` - Agent tools

### Cedar OS Documentation

The components you're implementing should follow Cedar OS patterns. Look at existing spell components to understand:
- How they integrate with Cedar state
- Animation patterns and timing
- Event handling and accessibility
- Type definitions

---

## Your Approach

1. **Start by reading the component source code** to understand their APIs
2. **Build one use case at a time** - don't try to do everything at once
3. **Test frequently** - these are interactive components, test on real data
4. **Make it feel magical** - smooth animations, thoughtful UX
5. **Ask for feedback** - show your work early and often

You've got this! These components will transform the security dashboard from functional to **absolutely delightful**. Make it something developers will actually want to use.

Good luck! 🚀
