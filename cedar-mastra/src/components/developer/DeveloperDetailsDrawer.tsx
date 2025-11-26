"use client";

import { X, Plus, Copy, ExternalLink, Code, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFindingActions } from "@/lib/cedar/useFindingActions";
import { toast } from "sonner";
import { cedar, cedarPayloadShapes } from "@/lib/cedar/actions";
import { getSeverityColor, Severity } from "@/lib/utils/severity";
import type { Finding } from "@/types/finding";

interface DeveloperDetailsDrawerProps {
  finding: Finding | null;
  onClose: () => void;
}

export const DeveloperDetailsDrawer = ({ finding, onClose }: DeveloperDetailsDrawerProps) => {
  const { addCustomToChat } = useFindingActions();

  if (!finding) return null;

  // Evidence is now embedded directly in the finding from the scanner API
  // Handle both old and new evidence formats
  const evidence = finding.evidence;

  // Check if this is the new structured evidence format
  const isNewFormat = evidence && evidence.request && typeof evidence.request === 'object' && evidence.request.method;

  const handleCopyCode = (code: string) => {
    cedar.util.copy(code);
  };

  // Sample diff for demonstration
  const proposedDiff = `// Before (vulnerable)
app.post('/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  const query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;
  db.query(query, (err, result) => {
    if (result.length > 0) {
      res.json({ token: generateToken(result[0]) });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

// After (fixed with parameterized query)
app.post('/v1/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Validate inputs
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Use parameterized query
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(query, [username, hashedPassword], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (result.length > 0) {
      res.json({ token: generateToken(result[0]) });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});`;

  const hotPatchConfig = `# NGINX rate limiting (48-hour mitigation)
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

location /v1/auth/login {
    limit_req zone=login_limit burst=10 nodelay;
    limit_req_status 429;
    proxy_pass http://auth-service;
}

# Rollback: Comment out the limit_req lines above`;

  const unitTest = `describe('POST /v1/auth/login', () => {
  it('should prevent SQL injection', async () => {
    const maliciousPayload = {
      username: "admin' OR '1'='1",
      password: "anything"
    };

    const response = await request(app)
      .post('/v1/auth/login')
      .send(maliciousPayload)
      .expect(401);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Invalid credentials');
  });

  it('should authenticate valid users', async () => {
    const validUser = {
      username: 'testuser',
      password: 'validpassword123'
    };

    const response = await request(app)
      .post('/v1/auth/login')
      .send(validUser)
      .expect(200);

    expect(response.body).toHaveProperty('token');
  });
});`;

  const guardrailRule = `// ESLint rule to prevent raw string interpolation in SQL
// .eslintrc.js
module.exports = {
  rules: {
    'no-template-curly-in-string': 'error',
    'security/detect-sql-injection': 'error'
  },
  plugins: ['security']
};

// Install: npm install --save-dev eslint-plugin-security`;

  const prBody = `## Summary
Fixes SQL injection vulnerability in login endpoint (${finding.owasp})

## Vulnerability Details
- **CVE**: ${finding.cve.join(', ') || 'N/A'}
- **CWE**: ${finding.cwe.join(', ')}
- **CVSS**: ${finding.cvss} (${finding.severity})
- **OWASP**: ${finding.owasp}

## Changes
- Replaced string concatenation with parameterized queries
- Added input validation using validator.js
- Implemented proper error handling
- Added bcrypt for password hashing

## Test Plan
- [x] Unit tests for SQL injection prevention
- [x] Integration tests for valid authentication flow
- [x] Manual testing with OWASP ZAP

## Risk Assessment
**Breaking Changes**: None
**Migration Notes**: No database schema changes required
**Rollback**: Revert commit if issues arise

## Compliance Mapping
- **NIST CSF**: ${finding.nistCsf?.join(', ')}
- **NIST 800-53**: ${finding.nist80053?.join(', ')}`;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col bg-card border-border">
        {/* Header */}
        <div className="p-6 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getSeverityColor(finding.severity as Severity)}>{finding.severity}</Badge>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {finding.endpoint.method} {finding.endpoint.path}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {finding.endpoint.service} · {finding.repo} · {finding.file}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">{finding.owasp}</Badge>
                {finding.cwe.map((cwe) => (
                  <Badge key={cwe} variant="outline">{cwe}</Badge>
                ))}
                {finding.cve.map((cve) => (
                  <Badge key={cve} variant="outline">{cve}</Badge>
                ))}
                {finding.exploitPresent && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Public Exploit
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <Button
            onClick={() =>
              addCustomToChat(
                `developer-full-${finding.id}`,
                cedarPayloadShapes.devFix(finding, {
                  proposedDiff,
                  hotPatchConfig,
                  testsOutline: { unit: unitTest },
                  guardrailRule,
                  prBody,
                }),
                "Full Developer Details",
                finding.severity
              )
            }
            size="sm"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Full Details to Chat
          </Button>
        </div>

        {/* Tabs */}
        <ScrollArea className="flex-1">
          <Tabs defaultValue="fix" className="p-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="fix">Fix</TabsTrigger>
              <TabsTrigger value="evidence">Evidence & Repro</TabsTrigger>
              <TabsTrigger value="similar">Similar Fixes</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card className="p-4 bg-muted/20 border-border">
                <h3 className="font-semibold text-foreground mb-2">Root Cause Summary</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {finding.summaryHumanReadable}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">Impact Scope:</span>
                    <p className="text-muted-foreground">Blast Radius: {finding.blastRadius}/10</p>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Breaking Risk:</span>
                    <p className="text-muted-foreground">Low (backward compatible fix)</p>
                  </div>
                </div>
              </Card>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addCustomToChat(
                    `developer-overview-${finding.id}`,
                    { overview: finding.summaryHumanReadable },
                    "Overview",
                    finding.severity
                  )
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Overview to Chat
              </Button>
            </TabsContent>

            {/* Fix Tab (Default) */}
            <TabsContent value="fix" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Hot Patch */}
                <Card className="p-4 bg-muted/20 border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">🚨 Hot Patch (48h mitigation)</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCode(hotPatchConfig)}
                        >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                    {hotPatchConfig}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Deploy to NGINX/API Gateway immediately for rate limiting protection.
                  </p>
                </Card>

                {/* Full Code Fix */}
                <Card className="p-4 bg-muted/20 border-border">
                  <h3 className="font-semibold text-foreground mb-3">✅ Full Code Fix</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">Framework: {finding.framework}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCode(proposedDiff)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono max-h-[400px]">
                        {proposedDiff}
                      </pre>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tests */}
              <Card className="p-4 bg-muted/20 border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Unit & Integration Tests</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyCode(unitTest)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                  {unitTest}
                </pre>
              </Card>

              {/* Guardrail */}
              <Card className="p-4 bg-muted/20 border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Guardrail: Lint/Policy Rule</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyCode(guardrailRule)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                  {guardrailRule}
                </pre>
              </Card>

              {/* Create PR Panel */}
              <Card className="p-4 bg-primary/10 border-primary">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <GitPullRequest className="h-5 w-5" />
                  Create Pull Request
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">Branch:</span>
                    <code className="ml-2 bg-background px-2 py-1 rounded text-xs border border-border font-mono">
                      fix/{finding.endpoint.service}/{finding.cwe[0]?.toLowerCase()}/sql-injection
                    </code>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Commit message:</span>
                    <code className="ml-2 bg-background px-2 py-1 rounded text-xs border border-border font-mono block mt-1">
                      fix: prevent SQL injection in auth endpoint ({finding.cve[0] || finding.cwe[0]})
                    </code>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">PR Body:</span>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono mt-2 max-h-[200px]">
                      {prBody}
                    </pre>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => toast.info("PR stub - This would open a PR in your repo")}>
                      <GitPullRequest className="h-4 w-4 mr-2" />
                      Open PR
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCopyCode(prBody)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy PR Body
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    addCustomToChat(
                      `developer-fix-${finding.id}`,
                      { proposedDiff, hotPatchConfig },
                      "Fix Details",
                      finding.severity
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Fix to Chat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    addCustomToChat(
                      `developer-tests-${finding.id}`,
                      { unitTest },
                      "Tests",
                      finding.severity
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tests to Chat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    addCustomToChat(
                      `developer-guardrail-${finding.id}`,
                      { guardrailRule },
                      "Guardrail",
                      finding.severity
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Guardrail to Chat
                </Button>
              </div>
            </TabsContent>

            {/* Evidence & Repro Tab */}
            <TabsContent value="evidence" className="space-y-4">
              {isNewFormat ? (
                // New structured evidence format
                <>
                  <Card className="p-4 bg-muted/20 border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">Request</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCode(evidence.curl_command || "")}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          cURL
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCode(
                            `${evidence.request.method} ${evidence.request.url}\n` +
                            Object.entries(evidence.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n') +
                            (evidence.request.body ? `\n\n${evidence.request.body}` : '')
                          )}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Raw
                        </Button>
                      </div>
                    </div>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
{`${evidence.request.method} ${evidence.request.url}
${Object.entries(evidence.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}${evidence.request.query_params && Object.keys(evidence.request.query_params).length > 0 ? `\n\nQuery Parameters:\n${Object.entries(evidence.request.query_params).map(([k, v]) => `  ${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')}` : ''}${evidence.request.body ? `\n\n${evidence.request.body}` : ''}`}
                    </pre>
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">Response ({evidence.response.status_code})</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(
                          `HTTP/1.1 ${evidence.response.status_code}\n` +
                          Object.entries(evidence.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n') +
                          `\n\n${evidence.response.body}`
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono max-h-64">
{`HTTP/1.1 ${evidence.response.status_code}
${Object.entries(evidence.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${evidence.response.body}`}
                    </pre>
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border">
                    <h3 className="font-semibold text-foreground mb-2">Auth Context</h3>
                    <p className="text-sm text-muted-foreground">{evidence.auth_context || "N/A"}</p>
                  </Card>
                </>
              ) : (
                // Old evidence format fallback
                <>
                  <Card className="p-4 bg-muted/20 border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">Request</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCode(typeof evidence?.request === 'string' ? evidence.request : JSON.stringify(evidence?.request, null, 2))}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                      {typeof evidence?.request === 'string' ? evidence.request : JSON.stringify(evidence?.request, null, 2) || "N/A"}
                    </pre>
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">Response</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(typeof evidence?.response === 'string' ? evidence.response : JSON.stringify(evidence?.response, null, 2))}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                      {typeof evidence?.response === 'string' ? evidence.response : JSON.stringify(evidence?.response, null, 2) || "N/A"}
                    </pre>
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border">
                    <h3 className="font-semibold text-foreground mb-2">Auth Context</h3>
                    <p className="text-sm text-muted-foreground">{evidence?.authContext || evidence?.auth_context || "N/A"}</p>
                  </Card>
                </>
              )}

              {((evidence?.pocLinks && evidence.pocLinks.length > 0) || (evidence?.poc_references && evidence.poc_references.length > 0)) && (
                <Card className="p-4 bg-destructive/10 border-destructive">
                  <h3 className="font-semibold text-foreground mb-2">⚠️ POC Links (Public Exploits)</h3>
                  <ul className="space-y-1">
                    {(evidence.pocLinks || evidence.poc_references || []).map((link, i) => (
                      <li key={i}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addCustomToChat(
                    `developer-evidence-${finding.id}`,
                    cedarPayloadShapes.evidenceLite(evidence),
                    "Evidence & Repro",
                    finding.severity
                  )
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Evidence to Chat
              </Button>
            </TabsContent>

            {/* Similar Fixes Tab */}
            <TabsContent value="similar" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Semantically similar fixes from internal repos and GitHub Security Advisories (via embeddings).
              </p>
              <Card className="p-4 bg-muted/20 border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">Internal Fix: auth-service PR#123</h3>
                  <a href="#" className="text-primary text-sm hover:underline">
                    View PR
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Fixed similar SQL injection by using ORM parameterized queries. Time-to-fix: 2 days.
                </p>
                <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                  {`- const query = \`SELECT * FROM users WHERE id='\${id}'\`;
+ const user = await User.findByPk(id);`}
                </pre>
              </Card>

              <Card className="p-4 bg-muted/20 border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">GitHub Advisory: GHSA-xxxx-yyyy</h3>
                  <a href="#" className="text-primary text-sm hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    View Advisory
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Node.js Express SQL injection pattern. Use prepared statements.
                </p>
                <pre className="bg-background p-3 rounded text-xs overflow-x-auto border border-border font-mono">
                  db.query('SELECT * FROM users WHERE id = ?', [userId], callback);
                </pre>
              </Card>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addCustomToChat(
                    `developer-similar-${finding.id}`,
                    cedarPayloadShapes.similarCases([{ source: "PR#123", summary: "...", diffPointer: "...", link: "#" }]),
                    "Similar Cases",
                    finding.severity
                  )
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Similar Cases to Chat
              </Button>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-4">
              <Card className="p-4 bg-muted/20 border-border">
                <h3 className="font-semibold text-foreground mb-3">OWASP API Top 10</h3>
                <Badge variant="outline" className="mb-2">{finding.owasp}</Badge>
                <p className="text-sm text-muted-foreground">
                  This finding maps to {finding.owasp.split('—')[0].trim()} in the OWASP API Security Top 10 2023.
                </p>
              </Card>

              <Card className="p-4 bg-muted/20 border-border">
                <h3 className="font-semibold text-foreground mb-3">CWE (Common Weakness Enumeration)</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {finding.cwe.map((cwe) => (
                    <Badge key={cwe} variant="outline">{cwe}</Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Root cause patterns related to {finding.cwe.join(", ")}.
                </p>
              </Card>

              {finding.nistCsf && finding.nistCsf.length > 0 && (
                <Card className="p-4 bg-muted/20 border-border">
                  <h3 className="font-semibold text-foreground mb-3">NIST Cybersecurity Framework</h3>
                  <div className="flex flex-wrap gap-2">
                    {finding.nistCsf.map((func) => (
                      <Badge key={func} variant="outline">{func}</Badge>
                    ))}
                  </div>
                </Card>
              )}

              {finding.nist80053 && finding.nist80053.length > 0 && (
                <Card className="p-4 bg-muted/20 border-border">
                  <h3 className="font-semibold text-foreground mb-3">NIST 800-53 Families</h3>
                  <div className="flex flex-wrap gap-2">
                    {finding.nist80053.map((family) => (
                      <Badge key={family} variant="outline">{family}</Badge>
                    ))}
                  </div>
                </Card>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addCustomToChat(
                    `developer-compliance-${finding.id}`,
                    cedarPayloadShapes.complianceRef(finding),
                    "Compliance Mapping",
                    finding.severity
                  )
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Compliance to Chat
              </Button>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </Card>
    </div>
  );
};
