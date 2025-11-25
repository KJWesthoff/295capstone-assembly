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
