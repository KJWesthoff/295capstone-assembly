/**
 * Utility functions for vulnerability finding actions
 * Integrates with Cedar state management and Mastra agents
 */

import { Finding } from "@/types/finding";
import { cedarPayloadShapes } from "@/lib/cedar/actions";
import { toast } from "sonner";

export interface FindingActionContext {
  finding: Finding;
  addToContext: (id: string, payload: string, label: string, color?: string) => void;
  sendChatMessage?: (message: string) => void;
}

/**
 * Add finding to Cedar context for agent analysis
 */
export const addFindingToContext = (ctx: FindingActionContext) => {
  const { finding, addToContext } = ctx;
  const payload = cedarPayloadShapes.fullFinding(finding);
  const label = `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;
  const color =
    finding.severity === "Critical" ? "#dc2626" :
    finding.severity === "High" ? "#ea580c" :
    finding.severity === "Medium" ? "#ca8a04" : "#16a34a";

  addToContext(`finding-${finding.id}`, payload, label, color);
  toast.success(`Added ${finding.severity} finding to context`);
};

/**
 * Copy finding details to clipboard
 */
export const copyFindingToClipboard = (ctx: FindingActionContext) => {
  const { finding } = ctx;
  const details = JSON.stringify(finding, null, 2);
  navigator.clipboard.writeText(details);
  toast.success("Finding copied to clipboard");
};

/**
 * Request agent to visualize attack path
 */
export const visualizeAttackPath = (ctx: FindingActionContext) => {
  const { finding, sendChatMessage, addToContext } = ctx;

  // First add finding to context
  addFindingToContext(ctx);

  // Then ask agent to create diagram
  if (sendChatMessage) {
    sendChatMessage(`@finding-${finding.id} Create an attack path diagram showing how an attacker could exploit this vulnerability`);
  } else {
    toast.info("Open chat to generate attack path diagram");
  }
};

/**
 * Request agent for deep analysis
 */
export const requestDeepAnalysis = (ctx: FindingActionContext) => {
  const { finding, sendChatMessage, addToContext } = ctx;

  addFindingToContext(ctx);

  if (sendChatMessage) {
    sendChatMessage(`@finding-${finding.id} Provide a comprehensive security analysis including:\n1. Technical details\n2. Attack scenarios\n3. Code examples\n4. Remediation steps`);
  } else {
    toast.info("Open chat for deep analysis");
  }
};

/**
 * Request remediation code generation
 */
export const generateRemediationCode = (ctx: FindingActionContext) => {
  const { finding, sendChatMessage, addToContext } = ctx;

  addFindingToContext(ctx);

  if (sendChatMessage) {
    sendChatMessage(`@finding-${finding.id} Generate remediation code with:\n1. Before/after examples\n2. Security best practices\n3. Testing suggestions`);
  } else {
    toast.info("Open chat to generate fix");
  }
};

/**
 * Mark finding as false positive
 */
export const markFalsePositive = (ctx: FindingActionContext) => {
  const { finding } = ctx;
  // In a real implementation, this would call the backend
  console.log(`Marking finding ${finding.id} as false positive`);
  toast.info(`Marked ${finding.endpoint.path} as false positive`);
};

/**
 * Export finding as report
 */
export const exportFindingReport = (ctx: FindingActionContext) => {
  const { finding } = ctx;

  // Create report content
  const report = `
# Security Finding Report

## Vulnerability Details
- **Severity**: ${finding.severity}
- **CVSS**: ${finding.cvss}
- **Endpoint**: ${finding.endpoint.method} ${finding.endpoint.path}
- **Service**: ${finding.endpoint.service}

## Classification
- **CWE**: ${finding.cwe.join(", ")}
- **CVE**: ${finding.cve.length > 0 ? finding.cve.join(", ") : "None"}
- **OWASP**: ${finding.owaspCategory}

## Impact
${finding.impact}

## Recommendation
${finding.recommendation}

## Evidence
${finding.evidence}

---
Report generated: ${new Date().toISOString()}
`;

  const blob = new Blob([report], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finding-${finding.id}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success("Report exported");
};

/**
 * Accept risk for this finding
 */
export const acceptRisk = (ctx: FindingActionContext) => {
  const { finding } = ctx;
  console.log(`Accepting risk for finding ${finding.id}`);
  toast.info(`Accepted risk for ${finding.endpoint.path}`);
};

/**
 * Request MITRE ATT&CK mapping
 */
export const mapToMitre = (ctx: FindingActionContext) => {
  const { finding, sendChatMessage, addToContext } = ctx;

  addFindingToContext(ctx);

  if (sendChatMessage) {
    sendChatMessage(`@finding-${finding.id} Map this vulnerability to MITRE ATT&CK framework and explain relevant TTPs`);
  } else {
    toast.info("Open chat for MITRE mapping");
  }
};
