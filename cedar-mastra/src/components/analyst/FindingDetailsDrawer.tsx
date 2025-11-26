"use client";

import { X, Copy, Plus } from "lucide-react";
import { Finding } from "@/types/finding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cedar, cedarPayloadShapes } from "@/lib/cedar/actions";
import { getSeverityColor, Severity } from "@/lib/utils/severity";
import { useFindingActions } from "@/lib/cedar/useFindingActions";

interface FindingDetailsDrawerProps {
  finding: Finding | null;
  onClose: () => void;
}

export const FindingDetailsDrawer = ({ finding, onClose }: FindingDetailsDrawerProps) => {
  const { addCustomToChat } = useFindingActions();

  if (!finding) return null;

  // Evidence is now embedded directly in the finding from the scanner API
  // Handle both old and new evidence formats
  const evidence = finding.evidence;

  // Check if this is the new structured evidence format
  const isNewFormat = evidence && evidence.request && evidence.response && evidence.curl_command;

  const handleCopyCode = (code: string) => {
    cedar.util.copy(code);
  };

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
        label = `Evidence: ${finding.id}`;
        break;
      case "compliance":
        payload = cedarPayloadShapes.complianceOnly(finding);
        label = `Compliance: ${finding.endpoint.method} ${finding.endpoint.path}`;
        break;
    }

    addCustomToChat(`analyst-${type}-${finding.id}`, payload, label, finding.severity);
    toast.success("Added to Context Basket");
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col bg-card border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-border p-6 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Badge className={cn("uppercase text-xs font-semibold", getSeverityColor(finding.severity as Severity, 'border'))}>
                {finding.severity}
              </Badge>
              <span className="font-mono text-sm">
                <code className="text-primary font-semibold">{finding.endpoint.method}</code>{" "}
                {finding.endpoint.path}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              CVSS {finding.cvss} · {finding.exploitPresent ? "Public exploit" : "No known exploit"} · {finding.status}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">OWASP: {finding.owasp}</Badge>
              <Badge variant="outline" className="text-xs">CWE: {finding.cwe.join(", ")}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleAddToChat("full")}
            size="sm"
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="mr-2 h-3 w-3" />
            Add Full Details to Chat
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ScrollArea className="flex-1">
        <Tabs defaultValue="overview" className="p-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="evidence">Evidence & Repro</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground">{finding.summaryHumanReadable}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-foreground">Service:</span>{" "}
                <span className="text-muted-foreground">{finding.endpoint.service}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">Scanners:</span>{" "}
                <span className="text-muted-foreground">{finding.scanners.join(", ")}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">First seen:</span>{" "}
                <span className="text-muted-foreground">{new Date(finding.firstSeen).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">Last seen:</span>{" "}
                <span className="text-muted-foreground">{new Date(finding.lastSeen).toLocaleDateString()}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleAddToChat("overview")}>
              <Plus className="mr-2 h-3 w-3" />
              Add Overview to Chat
            </Button>
          </TabsContent>

          <TabsContent value="evidence" className="space-y-4 mt-4">
            {evidence && isNewFormat ? (
              <>
                {/* HTTP Transaction Section */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-base text-foreground border-b pb-2">HTTP Transaction</h3>

                  {/* Request */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">Request</h4>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyCode(
                        `${evidence.request.method} ${evidence.request.url}\n` +
                        Object.entries(evidence.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n') +
                        (evidence.request.body ? `\n\n${evidence.request.body}` : '')
                      )}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Request
                      </Button>
                    </div>
                    <pre className="bg-secondary p-4 rounded text-xs font-mono overflow-x-auto">
{`${evidence.request.method} ${evidence.request.url}
${Object.entries(evidence.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}${evidence.request.query_params && Object.keys(evidence.request.query_params).length > 0 ? `\n\nQuery Parameters:\n${Object.entries(evidence.request.query_params).map(([k, v]) => `  ${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')}` : ''}${evidence.request.body ? `\n\n${evidence.request.body}` : ''}`}
                    </pre>
                  </div>

                  {/* Response */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">
                        Response <span className="text-xs text-muted-foreground">({evidence.response.status_code})</span>
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyCode(
                        `HTTP/1.1 ${evidence.response.status_code}\n` +
                        Object.entries(evidence.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n') +
                        `\n\n${evidence.response.body}`
                      )}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Response
                      </Button>
                    </div>
                    <pre className="bg-secondary p-4 rounded text-xs font-mono overflow-x-auto max-h-64">
{`HTTP/1.1 ${evidence.response.status_code}
${Object.entries(evidence.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${evidence.response.body}`}
                    </pre>
                  </div>
                </div>

                {/* Reproduction Steps Section */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-base text-foreground border-b pb-2">Reproduction Steps</h3>

                  {/* curl Command */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">curl Command</h4>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyCode(evidence.curl_command)}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy curl
                      </Button>
                    </div>
                    <pre className="bg-secondary p-4 rounded text-xs font-mono overflow-x-auto">
{evidence.curl_command}
                    </pre>
                  </div>

                  {/* Manual Steps */}
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-foreground">Manual Steps</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      {evidence.steps.map((step, i) => (
                        <li key={i} className="text-muted-foreground pl-2">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Authentication Context */}
                  <div>
                    <h4 className="font-medium text-sm mb-1 text-foreground">Authentication Used</h4>
                    <p className="text-sm text-muted-foreground">{evidence.auth_context}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-1 text-foreground">Probe</h4>
                    <Badge variant="outline">{evidence.probe_name}</Badge>
                  </div>
                </div>

                {/* Vulnerability Analysis Section */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-base text-foreground border-b pb-2">Why This Is Vulnerable</h3>

                  <div>
                    <h4 className="font-medium text-sm mb-2 text-foreground">Root Cause</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {evidence.why_vulnerable}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2 text-foreground">Attack Scenario</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {evidence.attack_scenario}
                    </p>
                  </div>

                  {evidence.additional_requests && evidence.additional_requests.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-foreground">Additional Context</h4>
                      <div className="space-y-2">
                        {evidence.additional_requests.map((req, i) => (
                          <div key={i} className="border border-border rounded p-3 bg-secondary/50">
                            <p className="text-sm font-medium text-foreground">{req.description}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">{req.url} → {req.status}</p>
                            {req.note && <p className="text-xs text-muted-foreground mt-1">{req.note}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* PoC References Section */}
                {evidence.poc_references && evidence.poc_references.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-base text-foreground border-b pb-2">Proof-of-Concept Resources</h3>
                    <ul className="space-y-2">
                      {evidence.poc_references.map((link, i) => (
                        <li key={i}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm flex items-center gap-2"
                          >
                            <span className="text-muted-foreground">📄</span>
                            {link.includes('owasp.org') ? 'OWASP Documentation' :
                             link.includes('portswigger.net') ? 'PortSwigger Web Security' :
                             link.includes('cheatsheetseries.owasp.org') ? 'OWASP Cheat Sheet' :
                             link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={() => handleAddToChat("evidence")}>
                  <Plus className="mr-2 h-3 w-3" />
                  Add Evidence to Chat
                </Button>
              </>
            ) : evidence ? (
              <>
                {/* Old Evidence Format Fallback */}
                <div className="space-y-3">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <h4 className="font-medium text-sm text-yellow-600 dark:text-yellow-500 mb-2">
                      📋 Legacy Evidence Format
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      This finding uses the old evidence format. Structured evidence with HTTP requests, reproduction steps,
                      and vulnerability analysis is available for:
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside">
                      <li>BOLA (Broken Object Level Authorization) - API1</li>
                      <li>Injection Vulnerabilities - API8</li>
                      <li>BFLA (Broken Function Level Authorization) - API5</li>
                    </ul>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">Raw Evidence Data</h4>
                      <Button variant="ghost" size="sm" onClick={() => handleCopyCode(JSON.stringify(evidence, null, 2))}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="bg-secondary p-4 rounded text-xs font-mono overflow-x-auto max-h-96">
{JSON.stringify(evidence, null, 2)}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No evidence available</p>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-2 text-foreground">OWASP</h4>
                <Badge variant="outline">{finding.owasp}</Badge>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2 text-foreground">CWE</h4>
                <div className="flex gap-2 flex-wrap">
                  {finding.cwe.map((c) => (
                    <Badge key={c} variant="outline">{c}</Badge>
                  ))}
                </div>
              </div>
              {finding.nistCsf && finding.nistCsf.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-foreground">NIST CSF</h4>
                  <div className="flex gap-2 flex-wrap">
                    {finding.nistCsf.map((n) => (
                      <Badge key={n} variant="outline">{n}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {finding.nist80053 && finding.nist80053.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-foreground">NIST 800-53</h4>
                  <div className="flex gap-2 flex-wrap">
                    {finding.nist80053.map((n) => (
                      <Badge key={n} variant="outline">{n}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => handleAddToChat("compliance")}>
              <Plus className="mr-2 h-3 w-3" />
              Add Compliance to Chat
            </Button>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex gap-2">
                {finding.flags.isNew && <Badge className="bg-info/20 text-info">New</Badge>}
                {finding.flags.isRegressed && <Badge className="bg-high/20 text-high">Regressed</Badge>}
                {finding.flags.isResolved && <Badge className="bg-low/20 text-low">Resolved</Badge>}
              </div>
              <div className="text-sm space-y-2">
                <div>
                  <span className="font-medium text-foreground">Owner:</span>{" "}
                  <span className="text-muted-foreground">{finding.owner}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">SLA Due:</span>{" "}
                  <span className="text-muted-foreground">{new Date(finding.slaDue).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
      </div>
    </div>
  );
};
