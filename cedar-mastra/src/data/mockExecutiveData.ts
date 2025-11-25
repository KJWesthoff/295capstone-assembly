// Mock data for Executive Dashboard

export const mockExecSummary = {
  riskScore: 7.2,
  critical: 3,
  high: 7,
  pastSlaPct: 28,
  mttrMedian: 12,
  mttrP95: 45,
  publicExploitCount: 4,
  internetFacingCount: 8,
};

export const mockExecTrend = {
  window: "30d",
  deltaPct: -15,
  points: [8.1, 7.9, 8.2, 7.8, 7.5, 7.3, 7.2],
};

export const mockExecTrend90 = {
  window: "90d",
  deltaPct: -22,
  points: [9.2, 9.0, 8.8, 8.9, 8.7, 8.5, 8.3, 8.1, 7.9, 7.7, 7.5, 7.2],
};

export const mockExecTopRisks = [
  {
    id: "risk-001",
    title: "Broken authentication on customer login API allows account takeover",
    systems: ["auth-svc", "user-api"],
    severity: "Critical",
    exploitPresent: true,
    internetFacing: true,
    isNewOrRegressed: "New",
    recommendedAction: "Apply parameterized queries and add MFA enforcement within 48 hours",
    owner: "Security Team",
    eta: "2025-10-18T23:59:59Z",
    relatedBreachIds: ["equifax-2017", "capital-one-2019"],
  },
  {
    id: "risk-002",
    title: "Excessive data exposure in payment export endpoint risks PCI compliance breach",
    systems: ["payment-svc", "report-api"],
    severity: "High",
    exploitPresent: false,
    internetFacing: true,
    isNewOrRegressed: "Regressed",
    recommendedAction: "Implement field-level filtering and audit logging by end of week",
    owner: "Engineering Team A",
    eta: "2025-10-20T23:59:59Z",
    relatedBreachIds: ["target-2013"],
  },
  {
    id: "risk-003",
    title: "Missing rate limiting on admin settings allows resource exhaustion attack",
    systems: ["admin-svc"],
    severity: "High",
    exploitPresent: true,
    internetFacing: false,
    isNewOrRegressed: "-",
    recommendedAction: "Deploy API gateway rate limits and IP throttling immediately",
    owner: "DevOps Team",
    eta: "2025-10-19T23:59:59Z",
    relatedBreachIds: [],
  },
  {
    id: "risk-004",
    title: "Insufficient authorization checks allow privilege escalation in reporting module",
    systems: ["report-svc", "analytics-api"],
    severity: "High",
    exploitPresent: false,
    internetFacing: true,
    isNewOrRegressed: "-",
    recommendedAction: "Add role-based middleware and integration tests within 5 days",
    owner: "Engineering Team B",
    eta: "2025-10-23T23:59:59Z",
    relatedBreachIds: ["uber-2016"],
  },
  {
    id: "risk-005",
    title: "Unpatched dependency with known CVE in customer-facing web portal",
    systems: ["web-portal"],
    severity: "Medium",
    exploitPresent: true,
    internetFacing: true,
    isNewOrRegressed: "New",
    recommendedAction: "Update dependency to latest secure version and deploy next sprint",
    owner: "Frontend Team",
    eta: "2025-10-25T23:59:59Z",
    relatedBreachIds: ["apache-log4j-2021"],
  },
];

export const mockExecCompliance = {
  owaspCounts: {
    "API1:2023 Broken Object Level Authorization": 3,
    "API2:2023 Broken Authentication": 4,
    "API3:2023 Excessive Data Exposure": 2,
    "API5:2023 Broken Function Level Authorization": 1,
    "API8:2023 Security Misconfiguration": 2,
  },
  cweCounts: {
    "CWE-287": 4,
    "CWE-639": 3,
    "CWE-200": 2,
    "CWE-284": 1,
    "CWE-770": 2,
  },
  nistCsf: {
    Identify: 12,
    Protect: 8,
    Detect: 5,
    Respond: 3,
    Recover: 2,
  },
  nist80053: {
    AC: 6,
    IA: 5,
    SC: 4,
    CM: 3,
  },
};

export const mockExecSlaOwners = [
  {
    owner: "Security Team",
    critOpen: 2,
    highOpen: 1,
    pastSLA: 1,
    dueNext7: 2,
  },
  {
    owner: "Engineering Team A",
    critOpen: 1,
    highOpen: 3,
    pastSLA: 2,
    dueNext7: 1,
  },
  {
    owner: "DevOps Team",
    critOpen: 0,
    highOpen: 2,
    pastSLA: 1,
    dueNext7: 1,
  },
  {
    owner: "Engineering Team B",
    critOpen: 0,
    highOpen: 1,
    pastSLA: 0,
    dueNext7: 1,
  },
];
