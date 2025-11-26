# VentiAPI AI Security Platform: Feature Roadmap

**Last Updated**: 2025-11-07
**Project**: Master's Capstone - AI-Powered API Security Explainability
**Target Market**: Small to Medium Businesses (SMBs)

---

## Quick Reference: Top 10 Features to Build Next

| # | Feature | Persona | Impact | Effort | Priority |
|---|---------|---------|--------|--------|----------|
| 1 | Connect Real Data to Dashboards | All | 🔥 CRITICAL | 3-5 days | **P0** |
| 2 | Scan History & Trending | All | 🔥 CRITICAL | 1 week | **P0** |
| 3 | Triage Workflow (Status, Assignee, Notes) | Analyst | 🔥 HIGH | 1 week | **P0** |
| 4 | False Positive Suppression | Analyst | 🔥 HIGH | 3-5 days | **P1** |
| 5 | Exploit Intelligence (CISA KEV, GitHub) | Analyst | 🔥 HIGH | 1 week | **P1** |
| 6 | Automated GitHub PR Creation | Developer | 🔥 HIGH | 1-2 weeks | **P1** |
| 7 | Test Code Generation | Developer | 🔥 HIGH | 1 week | **P1** |
| 8 | Hot Patch Validation | Developer | 🔥 MEDIUM | 3-5 days | **P1** |
| 9 | Financial Risk Quantification | Executive | 🟡 MEDIUM | 2-4 days | **P2** |
| 10 | Board-Ready PDF Reports | Executive | 🟡 MEDIUM | 3-5 days | **P2** |

---

## Phase 1: Production Readiness (Weeks 1-4) 🚀

**Goal**: Make existing features production-ready for beta customers

### Week 1: Connect Real Data to Dashboards ⚠️ **CRITICAL BLOCKER**

**Current Problem**: Executive, Analyst, and Developer dashboards use mock data

**What to Build**:
1. **Update Dashboard Pages**:
   - `/dashboard/page.tsx` (Analyst)
   - `/executive/page.tsx` (Executive)
   - `/developer/page.tsx` (Developer)

2. **Load Real Scan Data**:
   ```typescript
   // In each dashboard page
   useEffect(() => {
     const scanId = router.query.scanId || localStorage.getItem('lastScanId');
     if (scanId) {
       loadScanResults(scanId); // Cedar state setter
     }
   }, []);
   ```

3. **Replace Mock Data Components**:
   - `mockFindings.ts` → Use `scanResults.findings` from Cedar state
   - `mockExecutiveData.ts` → Calculate KPIs from real findings

4. **Add Scan Selector**:
   - Dropdown to choose from recent scans
   - "Load Scan" button with scan ID input

**Acceptance Criteria**:
- [ ] All three dashboards display real scan results
- [ ] Switching scans updates dashboard data
- [ ] KPIs calculated from actual findings
- [ ] No mock data visible in production mode

**Files to Modify**:
- `cedar-mastra/src/app/dashboard/page.tsx`
- `cedar-mastra/src/app/executive/page.tsx`
- `cedar-mastra/src/app/developer/page.tsx`
- `cedar-mastra/src/components/analyst/SecurityAnalystView.tsx`
- `cedar-mastra/src/components/executive/ExecutiveView.tsx`

**Effort**: 3-5 days
**Priority**: **P0 - BLOCKS EVERYTHING**

---

### Week 2: Scan History & Trending

**Current Problem**: Each scan overwrites previous results; no historical comparison

**What to Build**:

1. **PostgreSQL Schema**:
   ```sql
   CREATE TABLE scans (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     scan_id TEXT UNIQUE NOT NULL,
     api_base_url TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     status TEXT NOT NULL, -- 'completed', 'failed', 'running'
     total_findings INT DEFAULT 0,
     critical_count INT DEFAULT 0,
     high_count INT DEFAULT 0,
     medium_count INT DEFAULT 0,
     low_count INT DEFAULT 0,
     scanner_engines TEXT[], -- ['ventiapi', 'zap']
     metadata JSONB -- scan configuration
   );

   CREATE TABLE findings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     scan_id UUID REFERENCES scans(id),
     rule TEXT NOT NULL, -- 'API1', 'API2', etc.
     title TEXT NOT NULL,
     severity TEXT NOT NULL,
     score FLOAT,
     endpoint TEXT,
     method TEXT,
     description TEXT,
     evidence JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE INDEX idx_scans_created ON scans(created_at DESC);
   CREATE INDEX idx_findings_scan ON findings(scan_id);
   CREATE INDEX idx_findings_rule_endpoint ON findings(rule, endpoint);
   ```

2. **Scanner API Updates** (optional - if you have permission):
   - Store scan results in PostgreSQL on completion
   - Add `/api/scans` endpoint to list historical scans
   - Add `/api/scans/{scanId}/compare/{previousScanId}` for diff

3. **Cedar Dashboard Features**:
   - Scan history list component
   - Date range filter (last 7 days, 30 days, 90 days)
   - Comparison view: side-by-side findings
   - Trend charts with real data

4. **New Mastra Tools**:
   ```typescript
   // scan-history-tool.ts
   export const scanHistoryTool = createTool({
     id: 'scan-history',
     description: 'Fetch historical scans and compare results over time',
     inputSchema: z.object({
       timeRange: z.enum(['7d', '30d', '90d', 'all']),
       compareWith: z.string().optional(), // Previous scan ID
     }),
     execute: async ({ context }) => {
       // Query database for scan history
       // Return: scans list, trend data, comparison results
     }
   });
   ```

**Acceptance Criteria**:
- [ ] All scans stored in database with timestamp
- [ ] Dashboard shows scan history (last 30 days)
- [ ] Trend charts display real data (not mock)
- [ ] Compare mode shows new/resolved/regressed findings
- [ ] AI agent can query scan history

**Files to Create**:
- `database/migrations/002_scan_history.sql`
- `cedar-mastra/src/backend/src/mastra/tools/scan-history-tool.ts`
- `cedar-mastra/src/components/shared/ScanHistoryList.tsx`
- `cedar-mastra/src/components/shared/ScanComparisonView.tsx`

**Effort**: 1 week
**Priority**: **P0 - REQUIRED FOR TRENDING**

---

### Week 3: Triage Workflow for Analysts

**Current Problem**: Analysts can't validate findings, assign work, or track remediation status

**What to Build**:

1. **Database Schema**:
   ```sql
   CREATE TABLE finding_triage (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     finding_id UUID REFERENCES findings(id),
     status TEXT NOT NULL, -- 'new', 'validated', 'false_positive', 'duplicate', 'risk_accepted', 'in_progress', 'resolved'
     assigned_to TEXT, -- User email or name
     assigned_at TIMESTAMP,
     notes TEXT[],
     sla_deadline TIMESTAMP,
     validated_by TEXT,
     validated_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE finding_comments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     finding_id UUID REFERENCES findings(id),
     author TEXT NOT NULL,
     comment TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

2. **UI Components**:
   - Status dropdown with color coding
   - Assignee selector (list of team members)
   - SLA countdown timer
   - Notes/comments section
   - History timeline ("Status changed: New → Validated by john@company.com")

3. **Triage Tool**:
   ```typescript
   // triage-management-tool.ts
   export const triageManagementTool = createTool({
     id: 'triage-management',
     description: 'Update finding status, assign to team member, add notes',
     inputSchema: z.object({
       findingId: z.string(),
       action: z.enum(['validate', 'mark_false_positive', 'assign', 'add_note', 'set_sla']),
       assignee: z.string().optional(),
       note: z.string().optional(),
       slaDays: z.number().optional(),
     }),
     execute: async ({ context }) => {
       // Update database
       // Return: updated finding with triage status
     }
   });
   ```

4. **Analyst Dashboard Updates**:
   - Add status column to findings table
   - Filter by status: "Show only New" / "Show only False Positives"
   - Assignee filter: "My findings" vs "All findings"
   - SLA warning badges: "⚠️ Due in 2 days" / "🔴 Overdue"

**Acceptance Criteria**:
- [ ] Analysts can change finding status (7 states)
- [ ] Analysts can assign findings to team members
- [ ] SLA deadlines calculated automatically (P0=24h, P1=7d, P2=30d, P3=90d)
- [ ] SLA countdown timer shows days remaining
- [ ] Notes/comments persist and display in timeline
- [ ] Filter findings by status, assignee, SLA status
- [ ] AI agent can update triage status via tool

**Files to Create**:
- `database/migrations/003_triage_workflow.sql`
- `cedar-mastra/src/backend/src/mastra/tools/triage-management-tool.ts`
- `cedar-mastra/src/components/analyst/TriagePanel.tsx`
- `cedar-mastra/src/components/analyst/FindingComments.tsx`
- `cedar-mastra/src/components/analyst/SLATimer.tsx`

**Effort**: 1 week
**Priority**: **P0 - ANALYSTS NEED THIS**

---

### Week 4: RBAC & Security Hardening

**Current Problem**: All personas see all data; no multi-tenant isolation

**What to Build**:

1. **Role-Based Access Control**:
   ```typescript
   // Add to JWT token
   interface UserToken {
     userId: string;
     email: string;
     role: 'executive' | 'analyst' | 'developer' | 'admin';
     organizationId: string; // For multi-tenancy
     permissions: string[]; // Fine-grained permissions
   }
   ```

2. **Route Protection**:
   ```typescript
   // middleware.ts
   export function middleware(request: NextRequest) {
     const token = parseJWT(request.cookies.get('auth_token'));

     // Executive routes
     if (request.nextUrl.pathname.startsWith('/executive')) {
       if (token.role !== 'executive' && token.role !== 'admin') {
         return NextResponse.redirect('/unauthorized');
       }
     }

     // Analyst routes
     if (request.nextUrl.pathname.startsWith('/dashboard')) {
       if (!['analyst', 'admin'].includes(token.role)) {
         return NextResponse.redirect('/unauthorized');
       }
     }
   }
   ```

3. **Data Filtering**:
   ```sql
   -- Row-level security (RLS) in PostgreSQL
   ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

   CREATE POLICY scans_org_isolation ON scans
     USING (organization_id = current_setting('app.current_org_id'));

   CREATE POLICY findings_org_isolation ON findings
     USING (scan_id IN (
       SELECT id FROM scans WHERE organization_id = current_setting('app.current_org_id')
     ));
   ```

4. **Security Audit**:
   - Review all API endpoints for auth
   - Add rate limiting per role
   - Implement API key rotation
   - Add audit logging for sensitive actions

**Acceptance Criteria**:
- [ ] Executives only see `/executive` dashboard
- [ ] Analysts only see `/dashboard` view
- [ ] Developers only see `/developer` view
- [ ] Admin role can access all dashboards
- [ ] Multi-tenant data isolation (if applicable)
- [ ] All sensitive actions logged (status changes, assignments)
- [ ] Rate limits enforced per role

**Files to Modify**:
- `cedar-mastra/middleware.ts`
- `scanner-service/web-api/security.py` (if backend changes needed)
- `database/migrations/004_rbac.sql`

**Effort**: 3-5 days
**Priority**: **P1 - SECURITY REQUIREMENT**

---

## Phase 2: Analyst Power Features (Weeks 5-8) 🔍

**Goal**: Make security analysts 10x more efficient

### Week 5: False Positive Suppression

**Problem**: API3 (Excessive Data Exposure) has high false positive rate

**What to Build**:

1. **Confidence Scoring**:
   ```typescript
   interface FindingWithConfidence extends Finding {
     confidence: number; // 0.0 - 1.0
     confidenceFactors: {
       evidenceQuality: 'complete' | 'partial' | 'weak';
       historicalAccuracy: number; // % of similar findings that were real
       probeReliability: number; // Known FP rate for this probe
     };
   }
   ```

2. **False Positive Learning**:
   ```sql
   CREATE TABLE false_positive_patterns (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     rule TEXT NOT NULL, -- 'API3'
     pattern_type TEXT NOT NULL, -- 'field_name', 'endpoint_pattern', 'response_pattern'
     pattern_value TEXT NOT NULL, -- 'email', 'username', '/public/*'
     reason TEXT,
     created_by TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Suppression Rules UI**:
   - "Mark as False Positive" button
   - Reason dropdown: "Public data", "Expected behavior", "Test endpoint"
   - "Apply rule to similar findings" checkbox
   - Whitelist management page

4. **Mastra Tool**:
   ```typescript
   export const falsePosi tiveAnalyzerTool = createTool({
     id: 'false-positive-analyzer',
     description: 'Analyze finding for false positive likelihood',
     inputSchema: z.object({
       findingId: z.string(),
       rule: z.string(),
       endpoint: z.string(),
       evidence: z.any(),
     }),
     execute: async ({ context }) => {
       // Check against FP patterns
       // Calculate confidence score
       // Return: confidence, isFalsePositive, reasoning
     }
   });
   ```

**Acceptance Criteria**:
- [ ] Confidence score displayed on each finding
- [ ] Low-confidence findings flagged: "⚠️ 35% confidence - likely false positive"
- [ ] "Mark as FP" creates suppression rule
- [ ] Similar findings auto-suppressed in future scans
- [ ] Whitelist rules page shows all suppression patterns
- [ ] AI agent suggests FP likelihood when analyzing

**Effort**: 3-5 days
**Priority**: **P1 - HIGH ANALYST PAIN POINT**

---

### Week 6: Exploit Intelligence Integration

**Problem**: Analysts don't know if vulnerabilities are actively exploited

**What to Build**:

1. **CISA KEV Integration**:
   ```typescript
   // cisa-kev-tool.ts
   export const cisaKevTool = createTool({
     id: 'cisa-kev-lookup',
     description: 'Check if vulnerability is on CISA Known Exploited Vulnerabilities list',
     inputSchema: z.object({
       cveId: z.string().optional(),
       cweId: z.string().optional(),
     }),
     execute: async ({ context }) => {
       const response = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
       const kevData = await response.json();

       // Check if CVE/CWE is in KEV
       const isKnownExploited = kevData.vulnerabilities.some(v =>
         v.cveID === context.cveId
       );

       return {
         isKnownExploited,
         dueDate: isKnownExploited ? kevData.dueDate : null,
         requiredAction: isKnownExploited ? kevData.requiredAction : null,
       };
     }
   });
   ```

2. **Exploit-DB / GitHub PoC Detection**:
   ```typescript
   // exploit-intelligence-tool.ts
   export const exploitIntelligenceTool = createTool({
     id: 'exploit-intelligence',
     description: 'Search for public exploits (Exploit-DB, GitHub, Metasploit)',
     inputSchema: z.object({
       cveId: z.string().optional(),
       cweId: z.string().optional(),
       vulnerability: z.string(),
     }),
     execute: async ({ context }) => {
       // Search GitHub for PoC repos
       const githubResults = await fetch(
         `https://api.github.com/search/repositories?q=${context.cveId}+exploit`
       );

       // Search Exploit-DB via API (if available)

       return {
         publicExploitsFound: githubResults.total_count > 0,
         githubRepos: githubResults.items.slice(0, 5),
         metasploitModules: [], // If Metasploit API available
         exploitAvailability: 'high' | 'medium' | 'low',
       };
     }
   });
   ```

3. **UI Indicators**:
   ```tsx
   {finding.isKnownExploited && (
     <Badge variant="destructive" className="animate-pulse">
       🚨 CISA KEV - Active Exploitation
     </Badge>
   )}

   {finding.publicExploitsFound > 0 && (
     <Badge variant="warning">
       ⚠️ {finding.publicExploitsFound} Public PoCs Available
     </Badge>
   )}
   ```

**Acceptance Criteria**:
- [ ] CISA KEV status shown on findings
- [ ] Public PoC count displayed
- [ ] Exploit availability increases priority score
- [ ] Links to GitHub repos / Exploit-DB entries
- [ ] AI agent mentions exploit status in analysis
- [ ] Findings auto-prioritize if CISA KEV flagged

**Effort**: 1 week
**Priority**: **P1 - HIGH SECURITY VALUE**

---

### Week 7: Evidence Collection Automation

**Problem**: Analysts need to manually reproduce findings for developers

**What to Build**:

1. **cURL Command Generator**:
   ```typescript
   // curl-generator-tool.ts
   export const curlGeneratorTool = createTool({
     id: 'curl-generator',
     description: 'Generate curl command to reproduce vulnerability',
     inputSchema: z.object({
       findingId: z.string(),
       endpoint: z.string(),
       method: z.string(),
       evidence: z.any(),
     }),
     execute: async ({ context }) => {
       const { method, endpoint, evidence } = context;

       // Generate curl command from evidence
       let curlCommand = `curl -X ${method} '${endpoint}'`;

       if (evidence.headers) {
         Object.entries(evidence.headers).forEach(([key, value]) => {
           curlCommand += ` \\\n  -H '${key}: ${value}'`;
         });
       }

       if (evidence.body) {
         curlCommand += ` \\\n  -d '${JSON.stringify(evidence.body)}'`;
       }

       return {
         curlCommand,
         expectedResponse: evidence.sample?.excerpt,
         reproductionSteps: [
           '1. Copy the curl command above',
           '2. Run in terminal',
           '3. Verify response matches expected output',
         ],
       };
     }
   });
   ```

2. **Screenshot Automation** (Playwright):
   ```typescript
   // screenshot-tool.ts
   import { chromium } from 'playwright';

   export const screenshotTool = createTool({
     id: 'vulnerability-screenshot',
     description: 'Capture screenshot of vulnerability in browser',
     inputSchema: z.object({
       findingId: z.string(),
       url: z.string(),
       steps: z.array(z.string()),
     }),
     execute: async ({ context }) => {
       const browser = await chromium.launch();
       const page = await browser.newPage();

       // Execute steps (navigate, fill forms, click buttons)
       for (const step of context.steps) {
         // Parse and execute step
       }

       const screenshot = await page.screenshot({ fullPage: true });
       await browser.close();

       // Save to /shared/evidence/
       return {
         screenshotPath: `/evidence/${context.findingId}.png`,
         timestamp: new Date().toISOString(),
       };
     }
   });
   ```

3. **Jira Ticket Export**:
   ```typescript
   // jira-export-tool.ts
   export const jiraExportTool = createTool({
     id: 'jira-export',
     description: 'Export finding as Jira ticket (markdown format)',
     inputSchema: z.object({
       findingId: z.string(),
       finding: z.any(),
     }),
     execute: async ({ context }) => {
       const markdown = `
# ${context.finding.title} (${context.finding.severity})

## Summary
${context.finding.description}

## Affected Endpoint
\`\`\`
${context.finding.method} ${context.finding.endpoint}
\`\`\`

## Evidence
\`\`\`json
${JSON.stringify(context.finding.evidence, null, 2)}
\`\`\`

## Reproduction Steps
${context.finding.curlCommand}

## Security Impact
- **OWASP**: ${context.finding.rule}
- **CVSS Score**: ${context.finding.score}
- **Risk Level**: ${context.finding.severity}

## Remediation
(See attached analysis)
`;

       return {
         markdown,
         jiraFormat: markdown, // Jira-compatible markdown
       };
     }
   });
   ```

4. **UI Features**:
   - "Generate cURL" button on each finding
   - Copy-to-clipboard functionality
   - "Export to Jira" button
   - "Capture Screenshot" button (if applicable)

**Acceptance Criteria**:
- [ ] cURL commands generated for all findings with HTTP evidence
- [ ] Commands include headers, auth tokens, request body
- [ ] Expected response shown next to command
- [ ] Jira export creates markdown-formatted ticket
- [ ] AI agent can generate reproduction steps on request

**Effort**: 3-5 days
**Priority**: **P1 - SPEEDS UP REMEDIATION**

---

### Week 8: Correlation Engine

**Problem**: Multiple findings often share same root cause

**What to Build**:

1. **Finding Clustering**:
   ```typescript
   // correlation-engine-tool.ts
   export const correlationEngineTool = createTool({
     id: 'correlation-engine',
     description: 'Group findings by common root cause',
     inputSchema: z.object({
       scanId: z.string(),
       findings: z.array(z.any()),
     }),
     execute: async ({ context }) => {
       const clusters: FindingCluster[] = [];

       // Cluster by rule + similar evidence
       const ruleGroups = groupBy(context.findings, 'rule');

       for (const [rule, findings] of Object.entries(ruleGroups)) {
         // Check if findings share common characteristics
         const commonEndpointPrefix = findCommonPrefix(
           findings.map(f => f.endpoint)
         );

         if (findings.length >= 3 && commonEndpointPrefix.length > 1) {
           clusters.push({
             id: `cluster-${rule}-${Date.now()}`,
             rule,
             findingIds: findings.map(f => f.id),
             rootCause: `Missing authentication middleware in ${commonEndpointPrefix}* endpoints`,
             confidence: 0.85,
             recommendedFix: `Add authentication middleware to all routes under ${commonEndpointPrefix}`,
           });
         }
       }

       return {
         clusters,
         reduction: `${context.findings.length} findings → ${clusters.length} root issues`,
       };
     }
   });
   ```

2. **Root Cause Analysis**:
   - AI agent analyzes patterns across findings
   - Example: "8 API2 findings all missing `@require_auth` decorator"
   - Suggests single fix: "Add decorator to base controller class"

3. **UI Visualization**:
   ```tsx
   <ClusterView>
     <ClusterCard>
       <h3>🔍 Root Cause: Missing JWT Middleware</h3>
       <p>8 findings grouped</p>
       <FindingList>
         <FindingItem>API2: /api/users</FindingItem>
         <FindingItem>API2: /api/profiles</FindingItem>
         <FindingItem>API2: /api/settings</FindingItem>
         ...
       </FindingList>
       <RecommendedFix>
         Add authentication middleware to Express.js router:
         <CodeBlock language="javascript">
           app.use('/api/*', requireAuth);
         </CodeBlock>
       </RecommendedFix>
     </ClusterCard>
   </ClusterView>
   ```

**Acceptance Criteria**:
- [ ] Findings automatically grouped by common patterns
- [ ] Root cause detected with confidence score
- [ ] Single fix suggested for entire cluster
- [ ] UI shows clustered view vs flat list toggle
- [ ] AI agent explains why findings are related

**Effort**: 3-5 days
**Priority**: **P1 - REDUCES COGNITIVE LOAD**

---

## Phase 3: Developer Superpowers (Weeks 9-12) 💻

**Goal**: Enable developers to fix vulnerabilities without security expertise

### Week 9: Automated GitHub PR Creation

**Problem**: Developers get vague tickets with no code

**What to Build**:

1. **GitHub Integration Tool**:
   ```typescript
   // github-pr-creator-tool.ts
   import { Octokit } from '@octokit/rest';

   export const githubPRCreatorTool = createTool({
     id: 'github-pr-creator',
     description: 'Create GitHub PR with vulnerability fix',
     inputSchema: z.object({
       findingId: z.string(),
       repoOwner: z.string(),
       repoName: z.string(),
       finding: z.any(),
       fixCode: z.string(), // AI-generated fix
     }),
     execute: async ({ context }) => {
       const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

       // 1. Get current file content
       const file = await octokit.rest.repos.getContent({
         owner: context.repoOwner,
         repo: context.repoName,
         path: context.finding.filePath,
       });

       // 2. Create new branch
       const branchName = `security/fix-${context.finding.rule}-${context.finding.id.slice(0, 8)}`;
       const mainBranch = await octokit.rest.repos.getBranch({
         owner: context.repoOwner,
         repo: context.repoName,
         branch: 'main',
       });

       await octokit.rest.git.createRef({
         owner: context.repoOwner,
         repo: context.repoName,
         ref: `refs/heads/${branchName}`,
         sha: mainBranch.data.commit.sha,
       });

       // 3. Commit fix
       await octokit.rest.repos.createOrUpdateFileContents({
         owner: context.repoOwner,
         repo: context.repoName,
         path: context.finding.filePath,
         message: `fix: ${context.finding.title} in ${context.finding.endpoint}`,
         content: Buffer.from(context.fixCode).toString('base64'),
         branch: branchName,
       });

       // 4. Create PR
       const pr = await octokit.rest.pulls.create({
         owner: context.repoOwner,
         repo: context.repoName,
         title: `[Security] Fix ${context.finding.rule}: ${context.finding.title}`,
         head: branchName,
         base: 'main',
         body: generatePRBody(context.finding),
       });

       return {
         prUrl: pr.data.html_url,
         prNumber: pr.data.number,
         branch: branchName,
       };
     }
   });

   function generatePRBody(finding: any): string {
     return `
## 🔒 Security Fix: ${finding.title}

### Vulnerability Details
- **OWASP Category**: ${finding.rule} - ${finding.title}
- **Severity**: ${finding.severity} (CVSS ${finding.score})
- **Affected Endpoint**: \`${finding.method} ${finding.endpoint}\`

### What Was Wrong
${finding.description}

### What Changed
This PR fixes the vulnerability by:
- [ ] Adding authentication middleware
- [ ] Implementing input validation
- [ ] Using parameterized queries
(Auto-generated based on vulnerability type)

### Testing
\`\`\`bash
# Run tests to verify fix
npm test

# Run security scan
npm run scan:security
\`\`\`

### References
- OWASP API Security Top 10: https://owasp.org/API-Security/
- CWE-${finding.cweId}: https://cwe.mitre.org/data/definitions/${finding.cweId}.html

---
*This PR was automatically generated by VentiAPI Security Scanner*
`;
   }
   ```

2. **Code Fix Generation**:
   - AI agent analyzes vulnerable code
   - Generates minimal code diff
   - Preserves existing functionality
   - Adds comments explaining fix

3. **UI Workflow**:
   ```tsx
   <Button onClick={() => createPR(finding)}>
     🚀 Generate Fix PR
   </Button>

   {prCreated && (
     <Alert>
       ✅ PR created successfully!
       <Link href={prUrl}>View PR #{prNumber}</Link>
     </Alert>
   )}
   ```

**Acceptance Criteria**:
- [ ] GitHub token configured in environment
- [ ] Repo owner/name detected or configurable
- [ ] Branch created automatically: `security/fix-API2-abc123`
- [ ] PR body includes OWASP reference, CWE, fix explanation
- [ ] Code diff shows only security-relevant changes
- [ ] PR assignable to specific developer
- [ ] AI agent can create PR on command

**Effort**: 1-2 weeks
**Priority**: **P1 - HIGHEST DEVELOPER VALUE**

---

### Week 10: Test Code Generation

**Problem**: Developers skip writing tests; need ready-to-use code

**What to Build**:

1. **Test Template Generator**:
   ```typescript
   // test-generator-tool.ts
   export const testGeneratorTool = createTool({
     id: 'test-generator',
     description: 'Generate test code that fails before fix, passes after',
     inputSchema: z.object({
       findingId: z.string(),
       rule: z.string(), // 'API1', 'API2', etc.
       endpoint: z.string(),
       method: z.string(),
       framework: z.enum(['pytest', 'jest', 'junit', 'go-test']),
     }),
     execute: async ({ context }) => {
       const templates = {
         'API2-pytest': `
import pytest
from fastapi.testclient import TestClient

def test_unauthenticated_access_blocked(client: TestClient):
    """Test that ${context.endpoint} requires authentication"""
    # This test should FAIL before fix (returns 200)
    # This test should PASS after fix (returns 401)

    response = client.${context.method.toLowerCase()}("${context.endpoint}")
    assert response.status_code == 401, "Endpoint should require authentication"
    assert "unauthorized" in response.json().get("message", "").lower()

def test_invalid_token_rejected(client: TestClient):
    """Test that invalid tokens are rejected"""
    response = client.${context.method.toLowerCase()}(
        "${context.endpoint}",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    assert response.status_code == 401
    assert "invalid" in response.json().get("message", "").lower()

def test_valid_token_accepted(client: TestClient, auth_token: str):
    """Test that valid authentication works"""
    response = client.${context.method.toLowerCase()}(
        "${context.endpoint}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code in [200, 201], "Valid auth should succeed"
`,
         'API2-jest': `
import request from 'supertest';
import app from '../app';

describe('${context.endpoint} Authentication', () => {
  test('should reject unauthenticated requests', async () => {
    // This test should FAIL before fix (returns 200)
    // This test should PASS after fix (returns 401)

    const response = await request(app)
      .${context.method.toLowerCase()}('${context.endpoint}');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/unauthorized/i);
  });

  test('should reject invalid tokens', async () => {
    const response = await request(app)
      .${context.method.toLowerCase()}('${context.endpoint}')
      .set('Authorization', 'Bearer invalid_token_12345');

    expect(response.status).toBe(401);
  });

  test('should accept valid tokens', async () => {
    const token = await getValidToken(); // Helper function

    const response = await request(app)
      .${context.method.toLowerCase()}('${context.endpoint}')
      .set('Authorization', \`Bearer \${token}\`);

    expect(response.status).toBeLessThan(300);
  });
});
`,
       };

       const testCode = templates[`${context.rule}-${context.framework}`];

       return {
         testCode,
         framework: context.framework,
         runCommand: `${context.framework === 'pytest' ? 'pytest' : 'npm test'} ${context.endpoint.replace(/\//g, '_')}_test`,
         instructions: [
           '1. Copy test code to your test directory',
           '2. Run tests - they should FAIL (proving vulnerability exists)',
           '3. Apply security fix',
           '4. Run tests again - they should PASS (proving fix works)',
         ],
       };
     }
   });
   ```

2. **Framework Detection**:
   - Scan `package.json` / `requirements.txt` / `go.mod`
   - Detect: pytest, Jest, JUnit, Go testing, RSpec
   - Generate tests matching existing test structure

3. **UI Features**:
   ```tsx
   <Button onClick={() => generateTests(finding)}>
     📝 Generate Test Code
   </Button>

   {tests && (
     <div>
       <CodeBlock language={tests.framework}>
         {tests.testCode}
       </CodeBlock>
       <CopyButton content={tests.testCode} />
       <Alert>
         Run: <code>{tests.runCommand}</code>
       </Alert>
     </div>
   )}
   ```

**Acceptance Criteria**:
- [ ] Tests generated for all OWASP API Top 10 rules
- [ ] Framework-specific test syntax (pytest vs Jest vs JUnit)
- [ ] Tests fail before fix (proves vulnerability)
- [ ] Tests pass after fix (validates remediation)
- [ ] Copy-to-clipboard button works
- [ ] Run command provided for each framework
- [ ] AI agent generates tests on request

**Effort**: 1 week
**Priority**: **P1 - COMPLETES DEV WORKFLOW**

---

### Week 11: Hot Patch Validation

**Problem**: Developers apply quick fixes but don't verify they work

**What to Build**:

1. **Selective Re-Scan Tool**:
   ```typescript
   // hot-patch-validator-tool.ts
   export const hotPatchValidatorTool = createTool({
     id: 'hot-patch-validator',
     description: 'Re-scan single endpoint to validate fix',
     inputSchema: z.object({
       findingId: z.string(),
       endpoint: z.string(),
       method: z.string(),
       rule: z.string(), // 'API2'
       apiBaseUrl: z.string(),
     }),
     execute: async ({ context }) => {
       // Call scanner service with single-endpoint mode
       const response = await fetch('http://web-api:8000/api/scans/validate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           endpoint: context.endpoint,
           method: context.method,
           probes: [context.rule], // Only run specific probe
           server: context.apiBaseUrl,
         }),
       });

       const result = await response.json();

       const stillVulnerable = result.findings.some(
         f => f.endpoint === context.endpoint && f.rule === context.rule
       );

       return {
         isFixed: !stillVulnerable,
         confidence: result.findings.length === 0 ? 1.0 : 0.5,
         message: stillVulnerable
           ? `❌ Hot patch failed: ${context.endpoint} still vulnerable`
           : `✅ Hot patch verified: ${context.endpoint} now secure`,
         evidence: result.findings[0]?.evidence || null,
       };
     }
   });
   ```

2. **Scanner Service Update** (optional):
   ```python
   # In scanner-service/web-api/main.py
   @app.post("/api/scans/validate")
   async def validate_fix(request: ValidationRequest):
       """Re-scan single endpoint to verify fix"""
       # Run only specified probe on specified endpoint
       findings = await run_probe(
           probe=request.probes[0],
           endpoint=request.endpoint,
           method=request.method,
           server=request.server
       )
       return {"findings": findings}
   ```

3. **UI Workflow**:
   ```tsx
   // After developer applies fix
   <Button onClick={() => validateFix(finding)}>
     ✅ Validate Hot Patch
   </Button>

   {validationResult && (
     <Alert variant={validationResult.isFixed ? 'success' : 'destructive'}>
       {validationResult.message}
       {!validationResult.isFixed && (
         <Details>
           Still seeing: {validationResult.evidence}
         </Details>
       )}
     </Alert>
   )}
   ```

**Acceptance Criteria**:
- [ ] Single endpoint re-scan completes in < 10 seconds
- [ ] Only specified probe runs (not full scan)
- [ ] Clear pass/fail message displayed
- [ ] If still vulnerable, shows why (evidence)
- [ ] Can re-validate multiple times
- [ ] AI agent suggests validation after fix discussed

**Effort**: 3-5 days
**Priority**: **P1 - CONFIDENCE BUILDER**

---

### Week 12: Stack-Specific Code Examples

**Problem**: Generic examples don't match developer's framework

**What to Build**:

1. **Framework Detection**:
   ```typescript
   // framework-detector-tool.ts
   export const frameworkDetectorTool = createTool({
     id: 'framework-detector',
     description: 'Detect framework from OpenAPI spec or repo',
     inputSchema: z.object({
       repoUrl: z.string().optional(),
       openApiSpec: z.any().optional(),
       packageFiles: z.array(z.string()).optional(), // ['package.json', 'requirements.txt']
     }),
     execute: async ({ context }) => {
       const frameworks: string[] = [];

       // Check package.json for Node.js frameworks
       if (context.packageFiles?.includes('package.json')) {
         const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
         if (pkg.dependencies?.express) frameworks.push('express');
         if (pkg.dependencies?.fastify) frameworks.push('fastify');
         if (pkg.dependencies?.['@nestjs/core']) frameworks.push('nestjs');
       }

       // Check requirements.txt for Python frameworks
       if (context.packageFiles?.includes('requirements.txt')) {
         const reqs = fs.readFileSync('requirements.txt', 'utf8');
         if (reqs.includes('fastapi')) frameworks.push('fastapi');
         if (reqs.includes('flask')) frameworks.push('flask');
         if (reqs.includes('django')) frameworks.push('django');
       }

       // Check go.mod for Go frameworks
       if (context.packageFiles?.includes('go.mod')) {
         const gomod = fs.readFileSync('go.mod', 'utf8');
         if (gomod.includes('gin-gonic/gin')) frameworks.push('gin');
         if (gomod.includes('gofiber/fiber')) frameworks.push('fiber');
       }

       return {
         detectedFrameworks: frameworks,
         primaryFramework: frameworks[0] || 'unknown',
         language: frameworks[0]?.includes('express') ? 'javascript' :
                   frameworks[0]?.includes('fastapi') ? 'python' :
                   frameworks[0]?.includes('gin') ? 'go' : 'unknown',
       };
     }
   });
   ```

2. **Framework-Specific Fix Examples**:
   ```typescript
   const fixExamples = {
     'API2-express': {
       vulnerable: `
app.get('/api/users', (req, res) => {
  const users = db.getAllUsers();
  res.json(users); // ❌ No authentication
});
`,
       fixed: `
import jwt from 'express-jwt';

// Add authentication middleware
const requireAuth = jwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256']
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.getAllUsers();
  res.json(users); // ✅ Now requires valid JWT
});
`,
       explanation: 'Use express-jwt middleware to validate JWT tokens on protected routes'
     },
     'API2-fastapi': {
       vulnerable: `
@app.get("/api/users")
def get_users():
    users = db.get_all_users()
    return users  # ❌ No authentication
`,
       fixed: `
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user = verify_jwt_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

@app.get("/api/users")
def get_users(current_user: User = Depends(get_current_user)):
    users = db.get_all_users()
    return users  # ✅ Now requires valid JWT
`,
       explanation: 'Use FastAPI dependency injection to enforce authentication'
     },
   };
   ```

3. **AI Agent Integration**:
   - When generating fix, detect framework first
   - Select framework-specific template
   - Explain why this approach is idiomatic for that framework

**Acceptance Criteria**:
- [ ] Framework auto-detected from repo
- [ ] Code examples match detected framework
- [ ] Supports Express.js, FastAPI, Flask, Django, Gin, Fiber
- [ ] Explanation tailored to framework idioms
- [ ] Dependency installation instructions included
- [ ] AI agent says "For your Express.js app, use..." not generic "Use middleware..."

**Effort**: 1 week
**Priority**: **P1 - MASSIVE UX IMPROVEMENT**

---

## Phase 4: Executive Intelligence (Weeks 13-16) 👔

**Goal**: Enable data-driven security investment decisions

### Week 13: Financial Risk Quantification

**Problem**: Executives don't understand technical severity

**What to Build**:

1. **Breach Cost Calculator**:
   ```typescript
   // financial-impact-calculator-tool.ts
   import breachCostData from './ponemon-2024-data.json';

   export const financialImpactCalculatorTool = createTool({
     id: 'financial-impact-calculator',
     description: 'Calculate potential financial impact of vulnerability',
     inputSchema: z.object({
       finding: z.any(),
       affectedRecords: z.number().optional(),
       dataType: z.enum(['pii', 'phi', 'pci', 'general']).optional(),
       industry: z.enum(['healthcare', 'finance', 'retail', 'saas', 'other']).optional(),
     }),
     execute: async ({ context }) => {
       // Ponemon 2024: Average cost per record breach
       const costPerRecord = {
         'pii': 240,    // Personal Identifiable Information
         'phi': 429,    // Protected Health Information (HIPAA)
         'pci': 180,    // Payment Card Information
         'general': 150,
       };

       // Industry multipliers
       const industryMultiplier = {
         'healthcare': 1.5,
         'finance': 1.4,
         'retail': 1.1,
         'saas': 1.2,
         'other': 1.0,
       };

       const dataType = context.dataType || 'pii';
       const industry = context.industry || 'other';
       const records = context.affectedRecords || estimateRecords(context.finding);

       const baseCost = records * costPerRecord[dataType];
       const adjustedCost = baseCost * industryMultiplier[industry];

       // Additional costs
       const notificationCost = records * 5; // $5 per notification
       const regulatoryFine = dataType === 'phi' ? 50000 : 0; // HIPAA fine
       const reputationDamage = adjustedCost * 0.3; // 30% reputation impact

       const totalCost = adjustedCost + notificationCost + regulatoryFine + reputationDamage;

       return {
         potentialCost: totalCost,
         breakdown: {
           directBreachCost: adjustedCost,
           notificationCost,
           regulatoryFine,
           reputationDamage,
         },
         affectedRecords: records,
         costPerRecord: costPerRecord[dataType],
         confidence: records > 1000 ? 'high' : 'medium',
         comparison: `This is equivalent to ${Math.floor(totalCost / 100000)} developer salaries`,
       };
     }
   });

   function estimateRecords(finding: any): number {
     // Estimate based on endpoint
     if (finding.endpoint.includes('/users')) return 10000;
     if (finding.endpoint.includes('/customers')) return 5000;
     if (finding.endpoint.includes('/payments')) return 2000;
     return 1000; // Default
   }
   ```

2. **ROI Calculator**:
   ```typescript
   // Calculate ROI of fixing vulnerabilities
   const fixCost = estimateEffortHours(finding) * hourlyRate;
   const breachCost = calculateFinancialImpact(finding);
   const roi = ((breachCost - fixCost) / fixCost) * 100;

   return {
     fixCost: '$2,400 (30 hours @ $80/hr)',
     potentialLoss: '$240,000 (1,000 records breached)',
     roi: '9,900%',
     message: 'Every $1 spent fixing this prevents $100 in breach costs',
   };
   ```

3. **Executive Dashboard Updates**:
   ```tsx
   <KPICard title="Financial Risk Exposure">
     <div className="text-3xl font-bold">${totalRisk}</div>
     <p>Potential breach cost across all findings</p>
     <Progress value={riskMitigated} />
     <p className="text-sm">45% mitigated this quarter</p>
   </KPICard>
   ```

**Acceptance Criteria**:
- [ ] Every finding shows dollar-value impact
- [ ] Breach cost based on Ponemon 2024 data
- [ ] Industry-specific multipliers applied
- [ ] ROI calculated: fix cost vs breach cost
- [ ] Executive dashboard shows total risk exposure
- [ ] AI agent explains financial impact in business terms

**Effort**: 2-4 days
**Priority**: **P2 - HIGH EXEC VALUE**

---

### Week 14: Compliance Gap Analysis

**Problem**: SMBs need SOC 2, PCI-DSS, HIPAA certifications

**What to Build**:

1. **Compliance Mapping Database**:
   ```sql
   CREATE TABLE compliance_mappings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     framework TEXT NOT NULL, -- 'SOC2', 'PCI-DSS', 'HIPAA', 'ISO27001'
     control_id TEXT NOT NULL, -- 'CC6.1', 'Req 6.5.1'
     control_name TEXT NOT NULL,
     owasp_rules TEXT[], -- ['API1', 'API2']
     cwe_ids TEXT[], -- ['CWE-89', 'CWE-79']
     description TEXT,
     audit_question TEXT, -- What auditors ask
     evidence_required TEXT -- What to provide auditors
   );

   INSERT INTO compliance_mappings VALUES
     (gen_random_uuid(), 'SOC2', 'CC6.1', 'Logical and Physical Access Controls',
      ARRAY['API2'], ARRAY['CWE-287'],
      'The entity implements logical access security software, infrastructure, and architectures over protected information assets',
      'How do you ensure only authorized users can access systems?',
      'Authentication logs, access control lists, vulnerability scan results'),
     (gen_random_uuid(), 'PCI-DSS', 'Req 6.5.1', 'Injection Flaws',
      ARRAY['API8'], ARRAY['CWE-89', 'CWE-79'],
      'Application must prevent injection flaws (SQL, XSS, etc.)',
      'How do you prevent SQL injection in payment processing?',
      'Code review evidence, SAST/DAST results, parameterized query implementation');
   ```

2. **Compliance Gap Tool**:
   ```typescript
   // compliance-gap-analysis-tool.ts
   export const complianceGapAnalysisTool = createTool({
     id: 'compliance-gap-analysis',
     description: 'Identify compliance gaps based on findings',
     inputSchema: z.object({
       framework: z.enum(['SOC2', 'PCI-DSS', 'HIPAA', 'ISO27001', 'NIST-CSF']),
       findings: z.array(z.any()),
     }),
     execute: async ({ context }) => {
       // Query database for compliance mappings
       const mappings = await db.query(`
         SELECT DISTINCT control_id, control_name, audit_question, evidence_required
         FROM compliance_mappings
         WHERE framework = $1
           AND (owasp_rules && $2 OR cwe_ids && $3)
       `, [
         context.framework,
         context.findings.map(f => f.rule),
         context.findings.flatMap(f => f.relatedCWEs || []),
       ]);

       const failingControls = mappings.rows;
       const totalControls = await db.query(`
         SELECT COUNT(DISTINCT control_id) FROM compliance_mappings WHERE framework = $1
       `, [context.framework]);

       const passingControls = totalControls.rows[0].count - failingControls.length;
       const complianceScore = (passingControls / totalControls.rows[0].count) * 100;

       return {
         framework: context.framework,
         complianceScore: Math.round(complianceScore),
         status: complianceScore >= 90 ? 'Audit Ready' :
                 complianceScore >= 70 ? 'Needs Work' : 'High Risk',
         failingControls: failingControls.map(c => ({
           controlId: c.control_id,
           controlName: c.control_name,
           auditQuestion: c.audit_question,
           evidenceRequired: c.evidence_required,
           relatedFindings: context.findings.filter(f =>
             mappings.rows.some(m => m.owasp_rules.includes(f.rule))
           ),
         })),
         recommendations: [
           `Fix ${failingControls.length} findings to achieve compliance`,
           'Document remediation efforts for auditor evidence',
           'Schedule re-scan before audit date',
         ],
       };
     }
   });
   ```

3. **Executive Compliance Dashboard**:
   ```tsx
   <ComplianceCard framework="SOC 2">
     <ScoreRing score={72} />
     <Status>Needs Work</Status>
     <FailingControls>
       <Control>
         <ControlId>CC6.1</ControlId>
         <ControlName>Logical Access Controls</ControlName>
         <Gap>7 authentication vulnerabilities found</Gap>
         <AuditQuestion>How do you ensure only authorized users can access systems?</AuditQuestion>
         <ActionRequired>Fix API2 findings in /api/users, /api/admin</ActionRequired>
       </Control>
     </FailingControls>
     <Timeline>
       <p>Audit in 45 days - Recommended fix deadline: 30 days</p>
     </Timeline>
   </ComplianceCard>
   ```

**Acceptance Criteria**:
- [ ] Compliance score calculated for SOC 2, PCI-DSS, HIPAA
- [ ] Failing controls mapped to specific findings
- [ ] Audit questions shown for each gap
- [ ] Evidence requirements listed
- [ ] Recommendations for achieving compliance
- [ ] AI agent explains compliance gaps in business terms

**Effort**: 1 week
**Priority**: **P2 - HIGH SMB VALUE**

---

## Summary: Implementation Priority

### **Must Do First (P0)** 🔥
1. Week 1: Real Data Integration
2. Week 2: Scan History
3. Week 3: Triage Workflow
4. Week 4: RBAC

### **High Value (P1)** 🎯
5. Week 5: False Positive Suppression
6. Week 6: Exploit Intelligence
7. Week 7: Evidence Automation
8. Week 9: GitHub PR Creation
9. Week 10: Test Generation
10. Week 11: Hot Patch Validation

### **Nice to Have (P2)** 💎
11. Week 13: Financial Impact
12. Week 14: Compliance Gaps
13. Week 15: PDF Reports

---

**Next Steps**: Start with Week 1 (Real Data Integration). This unblocks everything else.

Need help implementing any of these? Ask in chat! 💬
