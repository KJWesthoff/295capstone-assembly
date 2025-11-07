# Dashboard Abstraction Implementation Plan

**Created:** 2025-11-04
**Context:** Technical SPIKE on dashboard reusability
**Estimated Effort:** 7-11 hours
**Expected Impact:** 30-40% reduction in dashboard code complexity

---

## Table of Contents
1. [Project Context & Goals](#project-context--goals)
2. [Architecture Discoveries](#architecture-discoveries)
3. [Detailed Implementation Plan](#detailed-implementation-plan)
4. [Code Examples](#code-examples)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)

---

## Project Context & Goals

### Overarching Project Goals

**VentiAPI Scanner** is a dual-architecture API security testing platform targeting OWASP API Security Top 10 vulnerabilities:

1. **Production Scanner (Docker Compose)**: React + FastAPI + Python scanner with multi-engine support
2. **Cedar Security Dashboard (Next.js)**: AI-powered security analyst using Cedar OS state management and Mastra RAG framework

### Cedar Dashboard Context

The Cedar Security Dashboard provides three role-specific views:
1. **Developer Dashboard** - Fast-track vulnerabilities to PRs with remediation plans
2. **Security Analyst Dashboard** - Triage and validate findings with prioritization
3. **Executive Dashboard** - High-level risk overview with compliance metrics

**Key Technical Stack:**
- Next.js 15 with App Router
- Cedar OS for state management and AI chat
- Mastra framework for AI agents and RAG
- Python scanner service for vulnerability detection

### Current State & Problem

The three dashboards were built rapidly and contain significant duplication:
- **255 lines** of duplicated ChatPresets logic
- **5 files** with identical severity color mappings (with inconsistencies!)
- **3 dashboard headers** with similar-but-not-identical patterns
- **2 drawer components** sharing ~40% of their structure
- **Inconsistent Cedar context integration** patterns

**Goal:** Reduce complexity by 30-40% while improving consistency and maintainability.

---

## Architecture Discoveries

### Key Patterns Identified

#### 1. Cedar OS Integration Pattern (CRITICAL INSIGHT)

Cedar OS provides automatic state serialization for AI agents. The existing abstraction in `/src/lib/cedar/` follows this pattern:

**Current Abstractions (WORKING WELL):**
- `useRegisterFindings(mockFindings)` - Registers findings with Cedar + enables @mentions
- `useRegisterExecutiveData(risks, owners)` - Same for executive data
- `useFindingActions()` - Provides `addFindingToChat`, `addFindingsToChat`, `addCustomToChat`

**Key Discovery:** The developer dashboard already uses these abstractions correctly, but analyst and executive dashboards have inconsistent implementations mixing:
- Direct `useContextBasket()` calls
- Manual `cedarEstimateTokens()` calls
- Duplicated color coding logic
- Inconsistent toast patterns

#### 2. Severity Color Scheme Inconsistency (BREAKING ISSUE)

**Two different schemes found:**

**Scheme A (Analyst):**
```typescript
Critical: "bg-critical/20 text-critical border-critical/40"
High: "bg-high/20 text-high border-high/40"
```

**Scheme B (Developer/Executive):**
```typescript
Critical: "bg-destructive text-destructive-foreground"
High: "bg-destructive/80 text-destructive-foreground"
```

**Decision Required:** Which scheme should be canonical? Recommend Scheme B as it uses Tailwind's semantic color system.

#### 3. ChatPresets Component Structure

All three ChatPresets components follow this exact structure:
1. Array of presets with `{ icon, label, description, instruction/prompt }`
2. `useContextBasket()` hook
3. `handlePresetClick` that calls `cedarEstimateTokens` and `addItem`
4. Toast notification on add
5. Grid of Card components with icon + label + description

**Difference:** Analyst uses `prompt` field while dev/exec use `instruction` field.

#### 4. File Organization Pattern

```
src/
├── components/
│   ├── analyst/          # Security analyst view
│   ├── developer/        # Developer view
│   ├── executive/        # Executive view
│   ├── shared/           # ← CREATE THIS for common components
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── cedar/           # Cedar OS integration helpers (GOOD PATTERN)
│   └── utils/           # ← ADD severity.ts here
```

---

## Detailed Implementation Plan

### Phase 1: Quick Wins (1-2 hours)

#### Task 1.1: Extract Severity Colors (30 min)

**Files to Create:**
- `/src/lib/utils/severity.ts`

**Files to Modify:**
- `/src/components/developer/DeveloperFindingsTable.tsx` (remove lines with `const severityColors`)
- `/src/components/developer/DeveloperDetailsDrawer.tsx` (remove lines with `const severityColors`)
- `/src/components/analyst/FindingsTable.tsx` (remove lines with `const severityColors`)
- `/src/components/analyst/FindingDetailsDrawer.tsx` (remove lines with `const severityColors`)
- `/src/components/executive/ExecutiveTopRisks.tsx` (remove lines with `const severityColors`)

**Implementation:**
```typescript
// /src/lib/utils/severity.ts
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export const SEVERITY_COLORS = {
  badge: {
    Critical: "bg-destructive text-destructive-foreground",
    High: "bg-destructive/80 text-destructive-foreground",
    Medium: "bg-[hsl(var(--chart-3))] text-foreground font-semibold",
    Low: "bg-muted text-foreground font-semibold",
  },
  border: {
    Critical: "bg-critical/20 text-critical border-critical/40",
    High: "bg-high/20 text-high border-high/40",
    Medium: "bg-medium/20 text-medium border-medium/40",
    Low: "bg-low/20 text-low border-low/40",
  },
  hex: {
    Critical: "#dc2626",
    High: "#ea580c",
    Medium: "#ca8a04",
    Low: "#16a34a",
  }
} as const;

export function getSeverityColor(
  severity: Severity,
  variant: 'badge' | 'border' | 'hex' = 'badge'
): string {
  return SEVERITY_COLORS[variant][severity] || SEVERITY_COLORS[variant].Low;
}

export function getSeverityTextColor(severity: Severity): string {
  const colors = {
    Critical: "text-critical",
    High: "text-high",
    Medium: "text-medium",
    Low: "text-low",
  };
  return colors[severity] || colors.Low;
}
```

**Migration Example:**
```typescript
// BEFORE (in DeveloperFindingsTable.tsx)
const severityColors = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-destructive/80 text-destructive-foreground",
  // ...
};

<Badge className={severityColors[finding.severity as keyof typeof severityColors]}>

// AFTER
import { getSeverityColor } from "@/lib/utils/severity";

<Badge className={getSeverityColor(finding.severity)}>
```

**Testing:**
- Verify all badges render with correct colors in all three dashboards
- Check that hover states still work
- Verify executive view's "Add to Chat" still uses correct colors

---

#### Task 1.2: Create DashboardHeader Component (30 min)

**Files to Create:**
- `/src/components/shared/DashboardHeader.tsx`

**Files to Modify:**
- `/src/components/developer/DeveloperView.tsx` (lines 24-31)
- `/src/components/analyst/SecurityAnalystView.tsx` (lines 33-40)
- `/src/components/executive/ExecutiveView.tsx` (lines 38-49)

**Implementation:**
```typescript
// /src/components/shared/DashboardHeader.tsx
"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DashboardHeader = ({
  title,
  description,
  action,
  size = 'lg',
  className
}: DashboardHeaderProps) => {
  const titleSizes = {
    sm: "text-2xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className={cn(
          "font-serif font-bold text-foreground",
          size === 'md' ? "font-semibold mb-2" : "",
          titleSizes[size]
        )}>
          {title}
        </h2>
        <p className={cn(
          "text-muted-foreground",
          size === 'sm' ? "text-xs" : size === 'md' ? "text-sm" : "text-base mt-1"
        )}>
          {description}
        </p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
```

**Migration Example:**
```typescript
// BEFORE (in DeveloperView.tsx)
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-3xl font-serif font-bold text-foreground">Developer Dashboard</h2>
    <p className="text-muted-foreground mt-1">
      Fast-track vulnerabilities to safe PRs with staged remediation plans
    </p>
  </div>
</div>

// AFTER
import { DashboardHeader } from "@/components/shared/DashboardHeader";

<DashboardHeader
  title="Developer Dashboard"
  description="Fast-track vulnerabilities to safe PRs with staged remediation plans"
/>
```

**Executive Dashboard with Button:**
```typescript
// BEFORE
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-3xl font-serif font-bold text-foreground">Risk & Compliance Overview</h2>
    <p className="text-muted-foreground mt-1">
      Current security posture, trends, and prioritized business risks
    </p>
  </div>
  <Button onClick={() => setWizardOpen(true)} size="lg">
    <FileText className="h-4 w-4 mr-2" />
    Generate Board Brief
  </Button>
</div>

// AFTER
<DashboardHeader
  title="Risk & Compliance Overview"
  description="Current security posture, trends, and prioritized business risks"
  action={
    <Button onClick={() => setWizardOpen(true)} size="lg">
      <FileText className="h-4 w-4 mr-2" />
      Generate Board Brief
    </Button>
  }
/>
```

**Testing:**
- Verify all three dashboards render headers correctly
- Check responsive behavior on mobile
- Verify executive dashboard button still works

---

#### Task 1.3: Standardize Cedar Context Integration (60 min)

**Goal:** Make all dashboards use the `useFindingActions` pattern consistently.

**Files to Modify:**
- `/src/components/analyst/FindingDetailsDrawer.tsx` (lines 27-74)
- `/src/components/executive/ExecutiveTopRisks.tsx` (lines 36-69)

**Current State:**

**Developer (GOOD - already using abstraction):**
```typescript
const { addCustomToChat } = useFindingActions();
```

**Analyst (NEEDS UPDATE):**
```typescript
const { addItem } = useContextBasket();

const handleAddToChat = (type: "full" | "overview" | "evidence" | "compliance") => {
  let payload: any;
  let label: string;
  let itemType: "vulnerability" | "evidence" | "compliance";

  // ... manual switch statement

  const tokenEstimate = cedarEstimateTokens(payload);
  addItem({
    type: itemType,
    label,
    data: payload,
    tokens: tokenEstimate,
  });
  toast.success("Added to Context Basket");
};
```

**Executive (NEEDS UPDATE):**
```typescript
const { addToContext } = useCedarActions();

const handleAddToChat = (risk: TopRisk) => {
  const payload = cedarPayloadShapes.execTopRisk(risk);
  const label = `Risk: ${risk.title.substring(0, 50)}...`;

  addToContext(
    `risk-${risk.id}`,
    payload,
    label,
    risk.severity === "Critical" ? "#dc2626" :
    risk.severity === "High" ? "#ea580c" :
    risk.severity === "Medium" ? "#ca8a04" : "#16a34a"
  );
};
```

**Solution:** Extend `useFindingActions` to work with any data type.

**Implementation:**

Update `/src/lib/cedar/useFindingActions.ts`:
```typescript
import { toast } from "sonner";
import { useCedarActions } from "./hooks";
import { cedarPayloadShapes } from "./actions";
import type { Finding } from "@/types/finding";
import { getSeverityColor } from "@/lib/utils/severity";

// ... existing DEBUG flag and getSeverityColor (update to use imported one)

export function useFindingActions() {
  const { addToContext } = useCedarActions();

  // Update getSeverityColor to use the imported utility
  const getColor = (severity: string): string => {
    return getSeverityColor(severity as any, 'hex');
  };

  const addFindingToChat = (
    finding: Finding,
    keyPrefix: string,
    payload?: any,
    customLabel?: string
  ) => {
    const data = payload || cedarPayloadShapes.devMinimal(finding);
    const label = customLabel || `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;
    const key = `${keyPrefix}-${finding.id}`;
    const color = getColor(finding.severity);

    if (DEBUG_CONTEXT_ADDITIONS) {
      console.log("🔍 [Cedar Context] Adding single finding:", { key, label, color, severity: finding.severity, data });
    }

    addToContext(key, data, label, color);
  };

  const addFindingsToChat = (
    findings: Finding[],
    keyPrefix: string,
    payloadFn?: (f: Finding) => any,
    showToast: boolean = true
  ) => {
    if (DEBUG_CONTEXT_ADDITIONS) {
      console.log("🔍 [Cedar Context] Adding multiple findings:", {
        count: findings.length,
        keyPrefix,
        findingIds: findings.map((f) => f.id),
        severities: findings.map((f) => f.severity),
      });
    }

    findings.forEach((finding) => {
      const payload = payloadFn ? payloadFn(finding) : cedarPayloadShapes.devMinimal(finding);
      addFindingToChat(finding, keyPrefix, payload);
    });

    if (showToast) {
      toast.success(`${findings.length} finding${findings.length === 1 ? "" : "s"} added to Chat`);
    }
  };

  const addCustomToChat = (
    key: string,
    data: any,
    label: string,
    severity?: string
  ) => {
    const color = severity ? getColor(severity) : "#003262";

    if (DEBUG_CONTEXT_ADDITIONS) {
      console.log("🔍 [Cedar Context] Adding custom data:", { key, label, color, severity: severity || "none", dataKeys: Object.keys(data), data });
    }

    addToContext(key, data, label, color);
  };

  return { addFindingToChat, addFindingsToChat, addCustomToChat, getSeverityColor: getColor };
}
```

**Migration for Analyst:**
```typescript
// In FindingDetailsDrawer.tsx

// BEFORE
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { cedarEstimateTokens } from "@/lib/cedar/actions";

const { addItem } = useContextBasket();

const handleAddToChat = (type: "full" | "overview" | "evidence" | "compliance") => {
  // ... 30 lines of manual logic
};

// AFTER
import { useFindingActions } from "@/lib/cedar/useFindingActions";

const { addCustomToChat } = useFindingActions();

const handleAddToChat = (type: "full" | "overview" | "evidence" | "compliance") => {
  let payload: any;
  let label: string;

  switch (type) {
    case "full":
      payload = cedarPayloadShapes.fullFindingWithEvidenceAndMappings(finding, evidence);
      label = `Full details: ${finding.endpoint.method} ${finding.endpoint.path}`;
      break;
    case "overview":
      payload = cedarPayloadShapes.minimalFinding(finding);
      label = `Overview: ${finding.endpoint.method} ${finding.endpoint.path}`;
      break;
    case "evidence":
      payload = cedarPayloadShapes.evidenceLite(evidence);
      label = `Evidence: ${finding.evidenceId}`;
      break;
    case "compliance":
      payload = cedarPayloadShapes.complianceOnly(finding);
      label = `Compliance: ${finding.endpoint.method} ${finding.endpoint.path}`;
      break;
  }

  addCustomToChat(`analyst-${type}-${finding.id}`, payload, label, finding.severity);
  toast.success("Added to Context Basket");
};
```

**Migration for Executive:**
```typescript
// In ExecutiveTopRisks.tsx

// BEFORE
const { addToContext } = useCedarActions();

const handleAddToChat = (risk: TopRisk) => {
  const payload = cedarPayloadShapes.execTopRisk(risk);
  const label = `Risk: ${risk.title.substring(0, 50)}...`;

  addToContext(
    `risk-${risk.id}`,
    payload,
    label,
    risk.severity === "Critical" ? "#dc2626" : /* ... */
  );
};

// AFTER
import { useFindingActions } from "@/lib/cedar/useFindingActions";

const { addCustomToChat } = useFindingActions();

const handleAddToChat = (risk: TopRisk) => {
  const payload = cedarPayloadShapes.execTopRisk(risk);
  const label = `Risk: ${risk.title.substring(0, 50)}...`;

  addCustomToChat(`risk-${risk.id}`, payload, label, risk.severity);
};
```

**Testing:**
- Test "Add to Chat" buttons in analyst dashboard
- Test "Add to Chat" buttons in executive dashboard
- Verify toast notifications appear
- Check that items appear in Cedar context with correct colors
- Test @mention functionality still works

---

### Phase 2: Major Refactor (4-6 hours)

#### Task 2.1: Abstract ChatPresets Component (3-4 hours)

**This is the biggest win - 60% code reduction in ChatPresets!**

**Files to Create:**
- `/src/components/shared/ChatPresets.tsx`
- `/src/config/chatPresets.ts` (optional - for cleaner separation)

**Files to Modify:**
- `/src/components/developer/DeveloperView.tsx` (replace import)
- `/src/components/analyst/SecurityAnalystView.tsx` (replace import)
- `/src/components/executive/ExecutiveView.tsx` (replace import)

**Files to DELETE (after migration):**
- `/src/components/developer/ChatPresets.tsx`
- `/src/components/analyst/ChatPresets.tsx`
- `/src/components/executive/ExecutiveChatPresets.tsx`

**Step 1: Create Shared Component**

```typescript
// /src/components/shared/ChatPresets.tsx
"use client";

import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { cedarEstimateTokens } from "@/lib/cedar/actions";

export interface ChatPreset {
  icon: LucideIcon;
  label: string;
  description: string;
  instruction?: string;  // Used by developer & executive
  prompt?: string;       // Used by analyst
}

export interface ChatPresetsProps {
  presets: ChatPreset[];
  title?: string;
  subtitle?: string;
  gridCols?: {
    base?: number;
    md?: number;
    lg?: number;
  };
  variant?: 'default' | 'compact' | 'card-wrapped';
  className?: string;
}

export const ChatPresets = ({
  presets,
  title = "Quick AI Actions (CedarOS)",
  subtitle,
  gridCols = { base: 1, md: 2, lg: 6 },
  variant = 'default',
  className = ""
}: ChatPresetsProps) => {
  const { addItem } = useContextBasket();

  const handlePresetClick = (preset: ChatPreset) => {
    // Support both instruction and prompt fields for compatibility
    const payload = preset.instruction
      ? { instruction: preset.instruction }
      : { prompt: preset.prompt };

    const tokens = cedarEstimateTokens(payload);

    addItem({
      type: "report",
      label: preset.label,
      data: payload,
      tokens,
    });

    toast.success(`Added "${preset.label}" preset to Context Basket (≈${tokens} tokens)`);
  };

  const gridClass = `grid grid-cols-${gridCols.base || 1} md:grid-cols-${gridCols.md || 2} lg:grid-cols-${gridCols.lg || 6} gap-3`;

  const content = (
    <>
      {(title || subtitle) && (
        <div className={variant === 'card-wrapped' ? "mb-3" : "mb-4"}>
          {title && (
            <h3 className={variant === 'card-wrapped'
              ? "text-sm font-semibold text-foreground uppercase tracking-wide"
              : "text-lg font-serif font-semibold text-foreground mb-1"
            }>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      <div className={gridClass}>
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <Card
              key={preset.label}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-border"
              onClick={() => handlePresetClick(preset)}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-primary/10 text-primary flex-shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{preset.label}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );

  if (variant === 'card-wrapped') {
    return (
      <Card className={`p-6 bg-card border-border ${className}`}>
        {content}
      </Card>
    );
  }

  return <div className={`space-y-${variant === 'compact' ? '3' : '4'} ${className}`}>{content}</div>;
};
```

**Step 2: Create Preset Configurations**

```typescript
// /src/config/chatPresets.ts
import {
  Sparkles, Shield, FileCode, GitPullRequest, CheckCircle, BookOpen,
  MessageSquare, TrendingUp, GitMerge,
  FileText, Target, AlertTriangle
} from "lucide-react";
import { ChatPreset } from "@/components/shared/ChatPresets";

export const developerPresets: ChatPreset[] = [
  {
    icon: FileCode,
    label: "Generate Fix PR",
    description: "Minimal code diff + unit tests for selected finding",
    instruction: "Generate minimal, safe code diff + unit/integration tests + PR body referencing CVE/CWE/OWASP. Include 48h hot patch and guardrail rule.",
  },
  {
    icon: Shield,
    label: "Hot Patch Now",
    description: "48-hour mitigation + long-term fix",
    instruction: "Produce a 48-hour mitigation (gateway/header/rate limiting) with rollback steps; confirm non-breaking.",
  },
  {
    icon: Sparkles,
    label: "Write Tests",
    description: "Unit + integration tests",
    instruction: "Generate unit and integration tests that fail before and pass after the proposed fix, for the selected framework.",
  },
  {
    icon: BookOpen,
    label: "Explain for Junior",
    description: "Tutorial: why vulnerable, do/don't",
    instruction: "Explain the issue to a junior developer with two Do's and two Don'ts to prevent regressions.",
  },
  {
    icon: CheckCircle,
    label: "Create Policy Rule",
    description: "Lint/policy to block regressions",
    instruction: "Propose a lint/policy rule (ESLint/Flake8/Conftest/OPA) to prevent this class of issues; include a code example.",
  },
  {
    icon: GitPullRequest,
    label: "Deprecation Notice",
    description: "Client comms for API changes",
    instruction: "Draft a client-facing deprecation/change notice for this endpoint; include versioning strategy and migration steps.",
  },
];

export const analystPresets: ChatPreset[] = [
  {
    icon: MessageSquare,
    label: "Validate Finding",
    description: "Summarize evidence and assess exploitability",
    prompt: "Validate the selected finding: summarize evidence and tell me if it's likely exploitable. If uncertain, list missing proof.",
  },
  {
    icon: TrendingUp,
    label: "Prioritize Queue",
    description: "Rank by exploitability × data sensitivity",
    prompt: "Prioritize the current queue by exploitability × data sensitivity; give me the top 10 with reasons.",
  },
  {
    icon: Shield,
    label: "Map to NIST",
    description: "Map findings to NIST CSF and 800-53",
    prompt: "Map these findings to NIST CSF and 800-53 families and propose policy guardrails.",
  },
  {
    icon: GitMerge,
    label: "Similar Cases",
    description: "Find historical fixes and solutions",
    prompt: "Show me similar historical findings we fixed and what worked (link prior tickets/PRs).",
  },
];

export const executivePresets: ChatPreset[] = [
  {
    icon: FileText,
    label: "Board update",
    description: "150-word executive summary with key risks and 2 actions",
    instruction: "Using execSummary, trend, top three risks, and compliance: write a 150-word board summary with two prioritized actions, owners, and dates. Keep it non-technical.",
  },
  {
    icon: Target,
    label: "2 actions this week",
    description: "Highest impact actions by exploitability & exposure",
    instruction: "If we can do only two things this week, which give the largest risk reduction and why? Tie to exploitability and exposure; include owners and ETAs.",
  },
  {
    icon: Shield,
    label: "NIST posture",
    description: "CSF status and shortest path to green",
    instruction: "Summarize our NIST CSF posture (Identify/Protect/Detect/Respond/Recover) and propose the shortest path to green.",
  },
  {
    icon: AlertTriangle,
    label: "Impact estimate",
    description: "Business impact if top risk is exploited",
    instruction: "Estimate business impact if the top risk is exploited. Use analogous breach cases when relevant.",
  },
];
```

**Step 3: Update Dashboard Views**

```typescript
// /src/components/developer/DeveloperView.tsx

// BEFORE
import { ChatPresets } from "./ChatPresets";

// AFTER
import { ChatPresets } from "@/components/shared/ChatPresets";
import { developerPresets } from "@/config/chatPresets";

// In component JSX:
<ChatPresets presets={developerPresets} />
```

```typescript
// /src/components/analyst/SecurityAnalystView.tsx

// BEFORE
import { ChatPresets } from "./ChatPresets";

// AFTER
import { ChatPresets } from "@/components/shared/ChatPresets";
import { analystPresets } from "@/config/chatPresets";

// In component JSX:
<ChatPresets
  presets={analystPresets}
  title="Quick AI Actions"
  subtitle="Pre-configured prompts for common security analyst workflows"
  gridCols={{ base: 1, md: 2, lg: 4 }}
/>
```

```typescript
// /src/components/executive/ExecutiveView.tsx

// BEFORE
import { ExecutiveChatPresets } from "./ExecutiveChatPresets";

// In JSX:
<ExecutiveChatPresets />

// AFTER
import { ChatPresets } from "@/components/shared/ChatPresets";
import { executivePresets } from "@/config/chatPresets";

// In JSX:
<ChatPresets
  presets={executivePresets}
  title="Quick AI Actions (Executive)"
  gridCols={{ base: 1, md: 2, lg: 4 }}
  variant="card-wrapped"
/>
```

**Step 4: Delete Old Files**

After verifying everything works:
```bash
rm src/components/developer/ChatPresets.tsx
rm src/components/analyst/ChatPresets.tsx
rm src/components/executive/ExecutiveChatPresets.tsx
```

**Testing:**
- Test all preset buttons in developer dashboard
- Test all preset buttons in analyst dashboard
- Test all preset buttons in executive dashboard
- Verify toast notifications appear correctly
- Verify items are added to Context Basket with correct token estimates
- Test responsive layout on mobile, tablet, desktop
- Verify card hover states work correctly

---

#### Task 2.2: Create BaseDrawer Component (2-3 hours)

**This is more complex and optional - consider skipping if time is limited.**

The two drawer components share structure but have significantly different tab content. Creating a shared base would require careful abstraction.

**Recommendation:** Skip this for now unless you notice further duplication in drawer usage patterns. The benefit (~150 lines saved) may not be worth the complexity introduced.

**Alternative Approach:** If you do tackle this, create a `DrawerShell` component that handles:
- Fixed positioning and width
- Header with close button
- Tab system
- Scroll area

But let each dashboard provide its own tab content as children/slots.

```typescript
// Simplified approach:
// /src/components/shared/DrawerShell.tsx

interface DrawerTab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface DrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  tabs: DrawerTab[];
}

export const DrawerShell = ({ isOpen, onClose, title, badge, headerActions, tabs }: DrawerShellProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[720px] bg-card border-l border-border shadow-lg z-50 flex flex-col">
      <div className="border-b border-border p-6 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {badge}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue={tabs[0]?.value} className="flex-1 flex flex-col">
        <div className="border-b border-border px-6">
          <TabsList className="w-full justify-start">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {tabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="p-6">
              {tab.content}
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
};
```

Then each specific drawer would use it:
```typescript
<DrawerShell
  isOpen={!!finding}
  onClose={onClose}
  title={`${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`}
  badge={<Badge>...</Badge>}
  tabs={[
    { value: "overview", label: "Overview", content: <OverviewTab finding={finding} /> },
    { value: "fix", label: "Fix", content: <FixTab finding={finding} /> },
    // ...
  ]}
/>
```

---

### Phase 3: Polish (2-3 hours)

#### Task 3.1: Add AddToChatButton Wrapper (Optional, 1-2 hours)

If you notice more duplication in "Add to Chat" button patterns, create:

```typescript
// /src/components/shared/AddToChatButton.tsx
interface AddToChatButtonProps<T> {
  data: T;
  payloadFn: (data: T) => any;
  labelFn: (data: T) => string;
  keyPrefix: string;
  variant?: 'icon' | 'button' | 'menu-item';
  severity?: string;
  children?: React.ReactNode;
}
```

#### Task 3.2: Documentation (1 hour)

Create `/src/components/shared/README.md` documenting:
- When to use each shared component
- Props API
- Examples
- Migration guide

---

## Code Examples

### Full Example: Migrating Developer Dashboard

```typescript
// /src/components/developer/DeveloperView.tsx
"use client";

import { useState } from "react";
import { DeveloperFindingsTable } from "./DeveloperFindingsTable";
import { DeveloperDetailsDrawer } from "./DeveloperDetailsDrawer";
import { ChatPresets } from "@/components/shared/ChatPresets"; // ← CHANGED
import { developerPresets } from "@/config/chatPresets"; // ← ADDED
import { DashboardHeader } from "@/components/shared/DashboardHeader"; // ← ADDED
import { mockFindings } from "@/data/mockFindings";
import type { Finding } from "@/types/finding";
import { useRegisterFindings } from "@/lib/cedar/useRegisterFindings";

interface DeveloperViewProps {
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const DeveloperView = ({ selectedFindings, onSelectionChange }: DeveloperViewProps = {}) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Register findings with Cedar for @mention functionality
  const { findings } = useRegisterFindings(mockFindings);

  return (
    <div className="space-y-6">
      {/* BEFORE: Manual header markup (lines 24-31) */}
      {/* AFTER: Shared component */}
      <DashboardHeader
        title="Developer Dashboard"
        description="Fast-track vulnerabilities to safe PRs with staged remediation plans"
      />

      {/* BEFORE: <ChatPresets /> */}
      {/* AFTER: Shared component with config */}
      <ChatPresets presets={developerPresets} />

      <DeveloperFindingsTable
        findings={findings}
        onSelectFinding={setSelectedFinding}
        selectedFindings={selectedFindings}
        onSelectionChange={onSelectionChange}
      />

      <DeveloperDetailsDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
};
```

### Full Example: Using Severity Colors

```typescript
// /src/components/developer/DeveloperFindingsTable.tsx

// BEFORE (lines 15-20)
const severityColors = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-destructive/80 text-destructive-foreground",
  Medium: "bg-[hsl(var(--chart-3))] text-foreground font-semibold",
  Low: "bg-muted text-foreground font-semibold",
};

// ... later in JSX
<Badge className={severityColors[finding.severity as keyof typeof severityColors]}>
  {finding.severity}
</Badge>

// AFTER
import { getSeverityColor } from "@/lib/utils/severity";

// Remove const severityColors = { ... };

// ... later in JSX
<Badge className={getSeverityColor(finding.severity)}>
  {finding.severity}
</Badge>
```

---

## Testing Strategy

### Automated Testing

**Create test file:** `/src/components/shared/__tests__/ChatPresets.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPresets } from '../ChatPresets';
import { Sparkles } from 'lucide-react';

const mockPresets = [
  {
    icon: Sparkles,
    label: "Test Preset",
    description: "Test description",
    instruction: "Test instruction",
  },
];

jest.mock('@/contexts/ContextBasketContext', () => ({
  useContextBasket: () => ({
    addItem: jest.fn(),
  }),
}));

jest.mock('@/lib/cedar/actions', () => ({
  cedarEstimateTokens: jest.fn(() => 100),
}));

describe('ChatPresets', () => {
  it('renders presets correctly', () => {
    render(<ChatPresets presets={mockPresets} />);
    expect(screen.getByText('Test Preset')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('calls addItem when preset is clicked', () => {
    const { addItem } = useContextBasket();
    render(<ChatPresets presets={mockPresets} />);

    fireEvent.click(screen.getByText('Test Preset'));

    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "report",
        label: "Test Preset",
      })
    );
  });
});
```

### Manual Testing Checklist

**Phase 1 Testing:**
- [ ] Developer dashboard loads without errors
- [ ] Security analyst dashboard loads without errors
- [ ] Executive dashboard loads without errors
- [ ] All severity badges display correct colors
- [ ] All dashboard headers render correctly
- [ ] "Add to Chat" buttons work in analyst drawer
- [ ] "Add to Chat" buttons work in executive risks
- [ ] Toast notifications appear
- [ ] Items appear in Cedar context with correct colors

**Phase 2 Testing:**
- [ ] All developer presets clickable and add to basket
- [ ] All analyst presets clickable and add to basket
- [ ] All executive presets clickable and add to basket
- [ ] Grid layouts responsive on mobile
- [ ] Grid layouts responsive on tablet
- [ ] Grid layouts responsive on desktop
- [ ] Executive presets wrapped in card correctly
- [ ] Token estimates appear in toasts

**Regression Testing:**
- [ ] @mention functionality still works for findings
- [ ] @mention functionality still works for executive risks
- [ ] @mention functionality still works for SLA owners
- [ ] Drawer tabs switch correctly
- [ ] Tables still sortable and filterable
- [ ] Selection state persists correctly

### Browser Testing Matrix

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari
- Mobile Chrome

---

## Rollback Plan

### Git Strategy

Create a feature branch for this work:
```bash
git checkout -b feature/dashboard-abstraction
git commit -m "Phase 1: Extract severity colors and dashboard header"
git commit -m "Phase 2: Abstract ChatPresets component"
# etc.
```

### Rollback Procedure

**If issues found in Phase 1:**
```bash
git revert <commit-hash>
```

**If issues found in Phase 2:**
1. Restore old ChatPresets files from git history
2. Update imports back to local files
3. Keep Phase 1 changes (they're independent)

**Nuclear option (full rollback):**
```bash
git checkout main
git branch -D feature/dashboard-abstraction
```

### Partial Rollback

The phases are designed to be independent:
- Phase 1 (severity + header) can be kept even if Phase 2 fails
- Phase 2 (ChatPresets) can be reverted without affecting Phase 1
- Individual tasks within Phase 1 can be reverted independently

---

## Implementation Checklist

### Phase 1: Quick Wins (1-2 hours)
- [ ] Create `/src/lib/utils/severity.ts` with color constants
- [ ] Update `DeveloperFindingsTable.tsx` to use `getSeverityColor`
- [ ] Update `DeveloperDetailsDrawer.tsx` to use `getSeverityColor`
- [ ] Update `FindingsTable.tsx` to use `getSeverityColor`
- [ ] Update `FindingDetailsDrawer.tsx` to use `getSeverityColor`
- [ ] Update `ExecutiveTopRisks.tsx` to use `getSeverityColor`
- [ ] Test all severity badges in all dashboards
- [ ] Create `/src/components/shared/DashboardHeader.tsx`
- [ ] Update `DeveloperView.tsx` to use `DashboardHeader`
- [ ] Update `SecurityAnalystView.tsx` to use `DashboardHeader`
- [ ] Update `ExecutiveView.tsx` to use `DashboardHeader` (with button)
- [ ] Test all dashboard headers
- [ ] Update `FindingDetailsDrawer.tsx` to use `useFindingActions`
- [ ] Update `ExecutiveTopRisks.tsx` to use `useFindingActions`
- [ ] Test "Add to Chat" in analyst dashboard
- [ ] Test "Add to Chat" in executive dashboard
- [ ] Commit Phase 1

### Phase 2: Major Refactor (4-6 hours)
- [ ] Create `/src/components/shared/ChatPresets.tsx`
- [ ] Create `/src/config/chatPresets.ts` with all presets
- [ ] Update `DeveloperView.tsx` to use shared ChatPresets
- [ ] Update `SecurityAnalystView.tsx` to use shared ChatPresets
- [ ] Update `ExecutiveView.tsx` to use shared ChatPresets
- [ ] Test developer presets
- [ ] Test analyst presets
- [ ] Test executive presets
- [ ] Delete old ChatPresets files
- [ ] Test responsive layouts
- [ ] Commit Phase 2

### Phase 3: Polish (2-3 hours)
- [ ] Create `/src/components/shared/README.md` documentation
- [ ] Add tests for shared components
- [ ] Run full regression test suite
- [ ] Update CLAUDE.md with new patterns
- [ ] Commit Phase 3

### Final Steps
- [ ] Code review
- [ ] Merge to main
- [ ] Monitor production for issues
- [ ] Update team documentation

---

## Common Pitfalls & Solutions

### Pitfall 1: TypeScript Errors with Severity Types

**Problem:** TypeScript complains about `string` vs `Severity` type mismatch.

**Solution:**
```typescript
// Option A: Type assertion
<Badge className={getSeverityColor(finding.severity as Severity)}>

// Option B: Update Finding type to use Severity literal
export type Finding = {
  severity: Severity;  // instead of severity: string
  // ...
}
```

### Pitfall 2: Import Path Errors

**Problem:** `@/components/shared/...` not resolving.

**Solution:** Check `tsconfig.json` has correct path mapping:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Pitfall 3: Grid Layout Breaking on Mobile

**Problem:** ChatPresets grid doesn't stack on mobile.

**Solution:** Ensure Tailwind classes are dynamic strings, not template literals:
```typescript
// BAD:
className={`grid grid-cols-${cols}`}

// GOOD:
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6"
```

### Pitfall 4: Cedar Context Not Receiving Items

**Problem:** "Add to Chat" works but items don't appear in context.

**Solution:** Check that:
1. `useRegisterFindings` is called in parent component
2. State is registered with correct key (`'findings'`, not `'finding'`)
3. Cedar DevTools shows registered state (F12 → Cedar tab)

### Pitfall 5: Toast Notifications Stacking

**Problem:** Multiple toasts appear when clicking "Add All".

**Solution:** Use the `showToast` parameter:
```typescript
addFindingsToChat(selected, "finding", cedarPayloadShapes.devMinimal, true);
```

---

## Success Metrics

### Code Metrics
- **Lines of Code Reduced:** Target 465 lines (~35% reduction)
- **Files Deleted:** 3 (ChatPresets components)
- **New Shared Components:** 2-3
- **Duplication Instances Removed:** 5+ (severityColors)

### Quality Metrics
- **Test Coverage:** Maintain or improve current coverage
- **TypeScript Errors:** 0
- **ESLint Warnings:** 0
- **Bundle Size:** Should decrease slightly

### User-Facing Metrics
- **Page Load Time:** Should not increase
- **Interaction Time:** Should remain the same
- **Bug Reports:** Target 0 new bugs introduced
- **Console Errors:** 0

---

## Contact & Questions

If you encounter issues during implementation:

1. Check the Cedar OS MCP documentation via `mcp__cedar__searchDocs`
2. Review the original component implementations for edge cases
3. Test incrementally - don't implement everything before testing
4. Keep the git history clean with descriptive commits

**Most Important:** Each phase is independent. If Phase 2 is taking too long or causing issues, ship Phase 1 and revisit Phase 2 later.

Good luck! 🚀
