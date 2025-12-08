import {
  Sparkles, Shield, FileCode, GitPullRequest, CheckCircle, BookOpen,
  MessageSquare, TrendingUp, GitMerge,
  FileText, Target, AlertTriangle
} from "lucide-react";
import { ChatPreset } from "@/components/shared/ChatPresets";

export const developerPresets: ChatPreset[] = [
  {
    icon: FileCode,
    label: "Priority Remediation",
    description: "Minimal code diff + unit tests for selected finding",
    instruction: "Use the remediation-prioritization-tool to prioritize the remediation of the selected finding. Generate minimal, safe code diff + unit/integration tests + PR body referencing CVE/CWE/OWASP. Include 48h hot patch and guardrail rule. Use the generate-fix-pr-tool to generate the fix PR.",
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
    prompt: "Run the analyze-scan-tool with the scan ID {scanId} and return a summary of the results.",
  },
  {
    icon: TrendingUp,
    label: "Prioritize Queue",
    description: "Rank by exploitability × data sensitivity",
    prompt: "Run the remediation-prioritization-tool. Prioritize the current queue by exploitability × data sensitivity; give me the top 3 with reasons.",
  },
  {
    icon: Shield,
    label: "Map to NIST",
    description: "Map findings to NIST CSF and 800-53",
    prompt: "Map these findings to NIST CSF and 800-53 families and propose policy guardrails; perform retrieval with get-security-intelligence-tool.",
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
    icon: MessageSquare,
    label: "Help me understand",
    description: "I got a security alert and need to know what's going on",
    instruction: "I received a security notification or alert about my website/business and I'm not sure what it means. Can you help me understand what's happening and what I need to do?",
  },
  {
    icon: FileText,
    label: "Draft email to developer",
    description: "Write an email I can send to my developer about these issues",
    instruction: "I need to contact my developer or IT person about these security issues. Can you help me write a clear, non-technical email that explains what they need to fix and how urgent it is?",
  },
  {
    icon: Target,
    label: "What's most urgent?",
    description: "Which of these issues should we fix first?",
    instruction: "Looking at what we've found, what's the most important thing to fix first? Explain it to me like I'm not a security expert - just tell me what's at stake and what my team needs to do.",
  },
  {
    icon: AlertTriangle,
    label: "Could this hurt my business?",
    description: "What's the real-world impact if we don't fix this?",
    instruction: "In plain terms, what could happen to my business if we don't address these security issues? I need to understand the actual risk so I can prioritize this properly.",
  },
];
