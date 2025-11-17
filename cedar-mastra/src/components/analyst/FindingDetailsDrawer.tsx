"use client";

import { X, Copy, Plus } from "lucide-react";
import { Finding } from "@/types/finding";
import { mockEvidence } from "@/data/mockFindings";
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

  const evidence = mockEvidence[finding.evidenceId];

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

  return (
    <div className="fixed inset-y-0 right-0 w-[720px] bg-card border-l border-border shadow-lg z-50 flex flex-col">
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
            {evidence ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-foreground">Request</h4>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyCode(evidence.request)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-secondary p-4 rounded text-xs font-mono overflow-x-auto">
                    {evidence.request}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm text-foreground">Response (redacted)</h4>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyCode(evidence.response)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-secondary p-4 rounded text-xs font-mono overflow-x-auto">
                    {evidence.response}
                  </pre>
                </div>

                {evidence.pocLinks.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 text-foreground">POC Links</h4>
                    <ul className="space-y-1">
                      {evidence.pocLinks.map((link, i) => (
                        <li key={i}>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                            {link}
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
  );
};
