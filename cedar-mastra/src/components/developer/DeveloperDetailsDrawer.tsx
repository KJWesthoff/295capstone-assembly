"use client";

import { X, Plus, Copy, ExternalLink, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFindingActions } from "@/lib/cedar/useFindingActions";
import { toast } from "sonner";
import { cedar, cedarPayloadShapes } from "@/lib/cedar/actions";
import { getSeverityColor, Severity } from "@/lib/utils/severity";
import { CodeBlock } from "@/components/ui/code-block";
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

  // Extract code snippets from evidence if available
  const vulnerableCode = evidence?.vulnerable_code;
  const fixCode = evidence?.fix_code;
  const codeLanguage = fixCode?.language || vulnerableCode?.language || 'php';

  const handleCopyCode = (code: string) => {
    cedar.util.copy(code);
  };

  // Build code diff from evidence data if available, otherwise use fallback
  const buildCodeDiff = () => {
    if (vulnerableCode?.snippet && fixCode?.snippet) {
      const fileInfo = vulnerableCode.file ? `// File: ${vulnerableCode.file}${vulnerableCode.line ? `:${vulnerableCode.line}` : ''}` : '';
      return `${fileInfo ? fileInfo + '\n\n' : ''}// BEFORE (vulnerable)
${vulnerableCode.snippet}

// AFTER (fixed)
${fixCode.snippet}`;
    }
    // Fallback to hardcoded example
    return `<?php
// Before (vulnerable) - class-api.php line 47
public function get_delivery_slots() {
    global $wpdb;
    $date = $_POST['date'];

    // VULNERABLE: Direct string concatenation
    $query = "SELECT * FROM {$wpdb->prefix}delivery_slots WHERE date = '" . $date . "'";
    return $wpdb->get_results($query);
}

// After (fixed with prepared statement)
public function get_delivery_slots() {
    global $wpdb;

    // Validate and sanitize input
    $date = isset($_POST['date']) ? sanitize_text_field($_POST['date']) : '';

    if (empty($date) || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $date)) {
        return new WP_Error('invalid_date', 'Invalid date format', array('status' => 400));
    }

    // Use WordPress prepared statement
    $query = $wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}delivery_slots WHERE date = %s",
        $date
    );

    $results = $wpdb->get_results($query);

    if ($wpdb->last_error) {
        error_log('Database error: ' . $wpdb->last_error);
        return new WP_Error('db_error', 'Database error', array('status' => 500));
    }

    return $results;
}`;
  };

  const proposedDiff = buildCodeDiff();

  const hotPatchConfig = `# WordPress/NGINX rate limiting (48-hour mitigation)
# Add to /etc/nginx/conf.d/rate-limit.conf

limit_req_zone $binary_remote_addr zone=wp_api_limit:10m rate=10r/m;

# Protect the vulnerable delivery slots endpoint
location /wp-json/petal-delivery/v1/slots {
    limit_req zone=wp_api_limit burst=5 nodelay;
    limit_req_status 429;

    # Block SQL injection patterns at the edge
    if ($request_body ~* "(union|select|insert|update|delete|drop|--|')") {
        return 403;
    }

    proxy_pass http://127.0.0.1:80;
}

# Also protect WooCommerce API endpoints
location /wp-json/wc/v3/ {
    limit_req zone=wp_api_limit burst=20 nodelay;
    proxy_pass http://127.0.0.1:80;
}

# Rollback: Comment out the limit_req and if blocks above`;

  const unitTest = `<?php
/**
 * PHPUnit tests for Petal Delivery Scheduler API
 * Run with: ./vendor/bin/phpunit tests/DeliverySlotsTest.php
 */
class DeliverySlotsTest extends WP_UnitTestCase {

    public function test_sql_injection_is_blocked() {
        // Simulate malicious SQL injection payload
        $_POST['date'] = "2025-01-01' OR '1'='1";

        $api = new Petal_Delivery_API();
        $result = $api->get_delivery_slots();

        // Should return error, not all records
        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertEquals('invalid_date', $result->get_error_code());
    }

    public function test_valid_date_returns_slots() {
        $_POST['date'] = '2025-01-15';

        $api = new Petal_Delivery_API();
        $result = $api->get_delivery_slots();

        $this->assertIsArray($result);
        // Should only return slots for the requested date
        foreach ($result as $slot) {
            $this->assertEquals('2025-01-15', $slot->date);
        }
    }

    public function test_empty_date_returns_error() {
        $_POST['date'] = '';

        $api = new Petal_Delivery_API();
        $result = $api->get_delivery_slots();

        $this->assertInstanceOf(WP_Error::class, $result);
    }

    public function test_invalid_date_format_returns_error() {
        $_POST['date'] = 'not-a-date';

        $api = new Petal_Delivery_API();
        $result = $api->get_delivery_slots();

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertEquals('invalid_date', $result->get_error_code());
    }
}`;

  const guardrailRule = `<?php
/**
 * PHPCS Custom Sniff: Detect raw SQL string concatenation
 * Install: composer require --dev squizlabs/php_codesniffer
 *
 * Add to phpcs.xml:
 */
?>
<!-- phpcs.xml -->
<ruleset name="WordPress-Security">
    <description>Security rules for WordPress plugins</description>

    <!-- Detect dangerous SQL patterns -->
    <rule ref="WordPress.DB.PreparedSQL"/>
    <rule ref="WordPress.DB.PreparedSQLPlaceholders"/>

    <!-- Flag direct $_POST/$_GET usage -->
    <rule ref="WordPress.Security.ValidatedSanitizedInput"/>

    <!-- Require escaping output -->
    <rule ref="WordPress.Security.EscapeOutput"/>
</ruleset>

<?php
/**
 * Run with: ./vendor/bin/phpcs --standard=phpcs.xml wp-content/plugins/
 *
 * Pre-commit hook (.git/hooks/pre-commit):
 */
?>
#!/bin/bash
./vendor/bin/phpcs --standard=phpcs.xml --extensions=php \\
    wp-content/plugins/petal-delivery-scheduler/ || exit 1`;

  const prBody = `## Summary
Fixes SQL injection vulnerability in delivery slots endpoint (${finding.owasp})

## Vulnerability Details
- **CVE**: ${finding.cve?.join(', ') || 'N/A'}
- **CWE**: ${finding.cwe?.join(', ') || 'CWE-89'}
- **CVSS**: ${finding.cvss} (${finding.severity})
- **OWASP**: ${finding.owasp || 'API8:2023 Security Misconfiguration'}

## Changes
- Replaced string concatenation with \`$wpdb->prepare()\` parameterized queries
- Added input validation using \`sanitize_text_field()\`
- Added date format validation with regex
- Implemented proper WP_Error handling

## Test Plan
- [x] PHPUnit tests for SQL injection prevention
- [x] Test valid date returns correct slots only
- [x] Test invalid/malicious input returns WP_Error
- [x] Manual testing with sqlmap and OWASP ZAP

## Risk Assessment
**Breaking Changes**: None - API response format unchanged
**Migration Notes**: No database schema changes required
**Rollback**: Revert commit and redeploy plugin

## WordPress Compatibility
- Tested on WordPress 6.4+
- WooCommerce 8.x compatible
- PHP 8.1+ required

## Compliance Mapping
- **NIST CSF**: ${finding.nistCsf?.join(', ') || 'PR.DS-1, PR.DS-2'}
- **NIST 800-53**: ${finding.nist80053?.join(', ') || 'SI-10, SI-11'}`;

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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="fix">Fix</TabsTrigger>
              <TabsTrigger value="evidence">Evidence & Repro</TabsTrigger>
              <TabsTrigger value="similar">Similar Fixes</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            {/* Fix Tab (Default) */}
            <TabsContent value="fix" className="space-y-6">
              {/* Overview Section */}
              <div className="space-y-4 border-b border-border pb-6">
                <Card className="p-4 bg-muted/20 border-border">
                  <h3 className="font-semibold text-foreground mb-2">Root Cause Summary</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {evidence?.why_vulnerable || finding.summaryHumanReadable}
                  </p>
                  {evidence?.business_impact && (
                    <div className="mb-4">
                      <span className="font-semibold text-foreground">Business Impact:</span>
                      <p className="text-sm text-muted-foreground">{evidence.business_impact}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">Estimated Fix Time:</span>
                      <p className="text-muted-foreground">{evidence?.remediation_time || 'TBD'}</p>
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
                      {
                        overview: evidence?.why_vulnerable || finding.summaryHumanReadable,
                        businessImpact: evidence?.business_impact,
                        remediationTime: evidence?.remediation_time,
                        executiveSummary: evidence?.executive_summary
                      },
                      "Overview",
                      finding.severity
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Overview to Chat
                </Button>
              </div>
              <div className="space-y-6">
                {/* Hot Patch */}
                <Card className="p-4 bg-muted/20 border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">🚨 Hot Patch (48h mitigation)</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCode(hotPatchConfig)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <CodeBlock language="nginx" value={hotPatchConfig} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Deploy to NGINX/API Gateway immediately for rate limiting protection.
                  </p>
                </Card>

                {/* Full Code Fix */}
                <Card className="p-4 bg-muted/20 border-border">
                  <h3 className="font-semibold text-foreground">✅ Full Code Fix</h3>
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
                      <CodeBlock language={codeLanguage} value={proposedDiff} className="max-h-[400px] overflow-auto" />
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
                <CodeBlock language="php" value={unitTest} />
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
                <CodeBlock language="xml" value={guardrailRule} />
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
                    <CodeBlock language="markdown" value={prBody} className="mt-2 max-h-[200px] overflow-auto" />
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
                    <div className="grid grid-cols-1 w-full">
                      <CodeBlock language="http" value={`${evidence.request.method} ${evidence.request.url}
${Object.entries(evidence.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}${evidence.request.query_params && Object.keys(evidence.request.query_params).length > 0 ? `\n\nQuery Parameters:\n${Object.entries(evidence.request.query_params).map(([k, v]) => `  ${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')}` : ''}${evidence.request.body ? `\n\n${evidence.request.body}` : ''}`} className="max-h-[400px] overflow-auto w-full max-w-full" />
                    </div>
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
                    <div className="grid grid-cols-1 w-full">
                      <CodeBlock language="http" value={`HTTP/1.1 ${evidence.response.status_code}
${Object.entries(evidence.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${evidence.response.body}`} className="max-h-64 overflow-auto" />
                    </div>
                  </Card>

                  {/* Reproduction Steps Section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-base text-foreground border-b pb-2">Reproduction Steps</h3>

                    {/* curl Command */}
                    <Card className="p-4 bg-muted/20 border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm text-foreground">curl Command</h4>
                        <Button variant="ghost" size="sm" onClick={() => handleCopyCode(evidence.curl_command || "")}>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy curl
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 w-full">
                        <CodeBlock language="bash" value={evidence.curl_command || ""} className="overflow-x-auto w-full max-w-full" />
                      </div>
                    </Card>

                    {/* Manual Steps */}
                    {evidence.steps && evidence.steps.length > 0 && (
                      <Card className="p-4 bg-muted/20 border-border">
                        <h4 className="font-medium text-sm mb-2 text-foreground">Manual Steps</h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          {evidence.steps.map((step: string, i: number) => (
                            <li key={i} className="text-muted-foreground pl-2">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </Card>
                    )}

                    {/* Authentication Context */}
                    <Card className="p-4 bg-muted/20 border-border">
                      <h4 className="font-medium text-sm mb-1 text-foreground">Authentication Used</h4>
                      <p className="text-sm text-muted-foreground">{evidence.auth_context || "N/A"}</p>
                    </Card>

                    {/* Probe */}
                    {evidence.probe_name && (
                      <Card className="p-4 bg-muted/20 border-border">
                        <h4 className="font-medium text-sm mb-1 text-foreground">Probe</h4>
                        <Badge variant="outline">{evidence.probe_name}</Badge>
                      </Card>
                    )}
                  </div>
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
                    <div className="grid grid-cols-1 w-full">
                      <CodeBlock language="json" value={typeof evidence?.request === 'string' ? evidence.request : JSON.stringify(evidence?.request, null, 2) || "N/A"} className="max-h-[300px] overflow-auto w-full max-w-full" />
                    </div>
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
                    <div className="grid grid-cols-1 w-full">
                      <CodeBlock language="json" value={typeof evidence?.response === 'string' ? evidence.response : JSON.stringify(evidence?.response, null, 2) || "N/A"} className="max-h-[300px] overflow-auto w-full max-w-full" />
                    </div>
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border">
                    <h3 className="font-semibold text-foreground mb-2">Auth Context</h3>
                    <p className="text-sm text-muted-foreground">{evidence?.auth_context || "N/A"}</p>
                  </Card>
                </>
              )}

              {evidence?.poc_references && evidence.poc_references.length > 0 && (
                <Card className="p-4 bg-destructive/10 border-destructive">
                  <h3 className="font-semibold text-foreground mb-2">⚠️ POC Links (Public Exploits)</h3>
                  <ul className="space-y-1">
                    {evidence.poc_references.map((link: string, i: number) => (
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
                  <h3 className="font-semibold text-foreground">WooCommerce Core Fix: trac#45623</h3>
                  <a href="#" className="text-primary text-sm hover:underline">
                    View Changeset
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Fixed similar SQL injection in order search using $wpdb-&gt;prepare(). Time-to-fix: 1 day.
                </p>
                <CodeBlock language="diff" value={`- $query = "SELECT * FROM {$wpdb->prefix}orders WHERE id = '" . $id . "'";
+ $query = $wpdb->prepare("SELECT * FROM {$wpdb->prefix}orders WHERE id = %d", $id);`} />
              </Card>

              <Card className="p-4 bg-muted/20 border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">WordPress Security Advisory: CVE-2024-1234</h3>
                  <a href="#" className="text-primary text-sm hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    View Advisory
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  WordPress plugin SQL injection pattern. Always use prepared statements with $wpdb.
                </p>
                <CodeBlock language="php" value="$results = $wpdb->get_results($wpdb->prepare('SELECT * FROM %i WHERE user_id = %d', $table, $user_id));" />
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
