// CedarOS Action Utilities

import { toast } from "sonner";
import type { Finding } from "@/types/finding";

// Payload shape transformers per CedarOS spec
export const cedarPayloadShapes = {
  devMinimal: (finding: Finding) => ({
    id: finding.id,
    service: finding.endpoint.service,
    repo: finding.repo,
    endpoint: finding.endpoint,
    severity: finding.severity,
    cvss: finding.cvss,
    exploitPresent: finding.exploitPresent,
    owasp: finding.owasp,
    cwe: finding.cwe,
    cve: finding.cve,
  }),

  devFix: (finding: Finding, additionalData?: any) => ({
    id: finding.id,
    service: finding.endpoint.service,
    repo: finding.repo,
    language: finding.language,
    framework: finding.framework,
    endpoint: finding.endpoint,
    suggestedFix: finding.suggestedFix,
    rootCause: finding.summaryHumanReadable,
    ...additionalData,
  }),

  evidenceLite: (evidence: any) => {
    const truncate = (str: string, max: number) =>
      str?.length > max ? str.substring(0, max) + "..." : str;
    return {
      id: evidence.id,
      authContext: evidence.authContext,
      request: truncate(evidence.request, 1200),
      response: truncate(evidence.response, 1200),
      pocLinks: evidence.pocLinks,
    };
  },

  similarCases: (cases: any[]) => ({
    cases: cases.map(c => ({
      source: c.source,
      summary: c.summary,
      diffPointer: c.diffPointer,
      link: c.link,
    })),
  }),

  complianceRef: (finding: Finding) => ({
    owasp: finding.owasp,
    cwe: finding.cwe,
    nistCsf: finding.nistCsf,
    nist80053: finding.nist80053,
  }),

  // Executive payload shapes
  execSummary: (summary: any) => ({
    riskScore: summary.riskScore,
    critical: summary.critical,
    high: summary.high,
    pastSlaPct: summary.pastSlaPct,
    mttrMedian: summary.mttrMedian,
    mttrP95: summary.mttrP95,
    publicExploitCount: summary.publicExploitCount,
    internetFacingCount: summary.internetFacingCount,
  }),

  execTrend: (trend: any) => ({
    window: trend.window,
    deltaPct: trend.deltaPct,
    points: trend.points,
  }),

  execTopRisk: (risk: any) => ({
    id: risk.id,
    title: risk.title,
    systems: risk.systems,
    severity: risk.severity,
    exploitPresent: risk.exploitPresent,
    internetFacing: risk.internetFacing,
    isNewOrRegressed: risk.isNewOrRegressed,
    recommendedAction: risk.recommendedAction,
    owner: risk.owner,
    eta: risk.eta,
    relatedBreachIds: risk.relatedBreachIds,
  }),

  execCompliance: (compliance: any) => ({
    owaspCounts: compliance.owaspCounts,
    cweCounts: compliance.cweCounts,
    nistCsf: compliance.nistCsf,
    nist80053: compliance.nist80053,
  }),

  execSlaOwners: (owners: any[]) =>
    owners.map(o => ({
      owner: o.owner,
      critOpen: o.critOpen,
      highOpen: o.highOpen,
      pastSLA: o.pastSLA,
      dueNext7: o.dueNext7,
    })),

  // Analyst payload shapes
  minimalFinding: (finding: Finding) => ({
    id: finding.id,
    endpoint: finding.endpoint,
    severity: finding.severity,
    cvss: finding.cvss,
    exploitPresent: finding.exploitPresent,
    owasp: finding.owasp,
    cwe: finding.cwe,
    priorityScore: finding.priorityScore,
  }),

  fullFinding: (finding: Finding) => ({
    id: finding.id,
    endpoint: finding.endpoint,
    severity: finding.severity,
    cvss: finding.cvss,
    exploitPresent: finding.exploitPresent,
    owasp: finding.owasp,
    cwe: finding.cwe,
    cve: finding.cve,
    scanners: finding.scanners,
    status: finding.status,
    priorityScore: finding.priorityScore,
    fixabilityScore: finding.fixabilityScore,
    summaryHumanReadable: finding.summaryHumanReadable,
    exposure: finding.exposure,
    flags: finding.flags,
  }),

  fullFindingWithEvidenceAndMappings: (finding: Finding, evidence: any) => ({
    finding: {
      id: finding.id,
      endpoint: finding.endpoint,
      severity: finding.severity,
      cvss: finding.cvss,
      exploitPresent: finding.exploitPresent,
      summaryHumanReadable: finding.summaryHumanReadable,
      priorityScore: finding.priorityScore,
    },
    evidence: cedarPayloadShapes.evidenceLite(evidence),
    mappings: {
      owasp: finding.owasp,
      cwe: finding.cwe,
      nistCsf: finding.nistCsf,
      nist80053: finding.nist80053,
    },
  }),

  complianceOnly: (finding: Finding) => ({
    id: finding.id,
    owasp: finding.owasp,
    cwe: finding.cwe,
    nistCsf: finding.nistCsf,
    nist80053: finding.nist80053,
  }),

  diffItem: (finding: Finding, status: "new" | "regressed" | "resolved") => ({
    id: finding.id,
    endpoint: finding.endpoint,
    severity: finding.severity,
    status,
    firstSeen: finding.firstSeen,
    lastSeen: finding.lastSeen,
  }),
};

// Token estimation per CedarOS spec
export const cedarEstimateTokens = (payload: any): number => {
  const str = JSON.stringify(payload);
  return Math.ceil(str.length / 4);
};

// Cedar action handlers
export const cedar = {
  context: {
    add: (item: { type: string; label: string; data: any; tokens: number }) => {
      // This integrates with ContextBasketContext
      return item;
    },
  },

  chat: {
    send: (payload: any, instruction: string) => {
      console.log("cedar.chat.send:", { payload, instruction });
      toast.success(`AI Request Prepared with ${cedarEstimateTokens(payload)} tokens`);
    },
    launcher: {
      open: () => {
        // Hotkey handler for Ctrl+/
        console.log("cedar.chat.launcher.open");
      },
    },
  },

  workflow: {
    git: {
      createPR: (config: {
        repo: string;
        branch: string;
        title: string;
        body: string;
        files?: string[];
      }) => {
        console.log("cedar.workflow.git.createPR:", config);
        toast.success(`PR Creation (Stub): ${config.title}`);
      },
    },
    issue: {
      create: (config: { title: string; body: string }) => {
        console.log("cedar.workflow.issue.create:", config);
        toast.success(`Issue Creation (Stub): ${config.title}`);
      },
    },
    repo: {
      open: (config: { repo: string; file: string }) => {
        const url = `https://${config.repo}/blob/main/${config.file}`;
        window.open(url, "_blank");
        toast.success(`Opening: ${config.file}`);
      },
    },
    assignOwner: (config: { id: string; owner: string }) => {
      console.log("cedar.workflow.assignOwner:", config);
      toast.success(`Assign Owner (Stub): ${config.owner} → ${config.id}`);
    },
    setDue: (config: { id: string; eta: string }) => {
      console.log("cedar.workflow.setDue:", config);
      toast.success(`Set Due Date (Stub): ${config.eta}`);
    },
    nudge: (config: { owner: string; message?: string }) => {
      console.log("cedar.workflow.nudge:", config);
      toast.success(`Nudge Owner (Stub): ${config.owner}`);
    },
    findings: {
      markFalsePositive: (config: { id: string; reason?: string }) => {
        console.log("cedar.workflow.findings.markFalsePositive:", config);
        toast.success(`Mark False Positive (Stub): ${config.id}`);
      },
      mergeDuplicates: (config: { ids: string[]; primaryId: string }) => {
        console.log("cedar.workflow.findings.mergeDuplicates:", config);
        toast.success(`Merge Duplicates (Stub): ${config.ids.length} findings → ${config.primaryId}`);
      },
    },
    risk: {
      accept: (config: { id: string; reason: string; expiresAt?: string }) => {
        console.log("cedar.workflow.risk.accept:", config);
        toast.success(`Accept Risk (Stub): ${config.id}`);
      },
    },
  },

  util: {
    copy: (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    },
  },

  codegen: {
    applyPattern: (config: { diffPointer: string }) => {
      console.log("cedar.codegen.applyPattern:", config);
      toast.success("Apply Pattern (Stub): Would apply similar fix pattern");
    },
  },
};

// Keyboard shortcuts per spec
export const cedarKeyboardShortcuts = {
  openDetails: "Enter",
  addToChat: "Shift+A",
  markForPR: "Shift+P",
  openChatLauncher: "Ctrl+/",
};
