"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Info, Shield, Globe, User, GitPullRequest, Plus, Copy, ExternalLink, FileText, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { getFixabilityTooltip } from "@/types/finding";
import { cedar, cedarPayloadShapes, cedarEstimateTokens, cedarKeyboardShortcuts } from "@/lib/cedar/actions";
import { useCedarActions } from "@/lib/cedar/hooks";
import type { Finding } from "@/types/finding";

interface DeveloperFindingsTableProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

const severityColors = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-destructive/80 text-destructive-foreground",
  Medium: "bg-[hsl(var(--chart-3))] text-foreground font-semibold",
  Low: "bg-muted text-foreground font-semibold",
};

const prStatusColors = {
  None: "bg-muted text-muted-foreground",
  Open: "bg-[hsl(var(--chart-3))] text-foreground font-semibold",
  Merged: "bg-success text-success-foreground",
};

const testsStatusColors = {
  None: "bg-muted text-muted-foreground",
  Failing: "bg-destructive text-destructive-foreground",
  Passing: "bg-success text-success-foreground",
};

export const DeveloperFindingsTable = ({
  findings,
  onSelectFinding,
  selectedFindings: controlledSelectedFindings,
  onSelectionChange
}: DeveloperFindingsTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedFramework, setSelectedFramework] = useState<string>("all");
  const [internalSelectedFindings, setInternalSelectedFindings] = useState<Set<string>>(new Set());
  const [filteredFindings, setFilteredFindings] = useState<Finding[]>(findings);
  const { addItem } = useContextBasket();
  const { addToContext } = useCedarActions();

  // Use controlled state if provided, otherwise use internal state
  const selectedFindings = controlledSelectedFindings ?? internalSelectedFindings;
  const setSelectedFindings = (newSelection: Set<string>) => {
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedFindings(newSelection);
    }
  };

  useEffect(() => {
    let filtered = findings;

    if (searchQuery) {
      filtered = filtered.filter(
        (f) =>
          f.endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.endpoint.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.repo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.file?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedSeverity !== "all") {
      filtered = filtered.filter((f) => f.severity === selectedSeverity);
    }

    if (selectedFramework !== "all") {
      filtered = filtered.filter((f) => f.framework === selectedFramework);
    }

    // Sort by FixabilityScore desc, then CVSS desc
    filtered = [...filtered].sort((a, b) => {
      const scoreA = a.fixabilityScore ?? 0;
      const scoreB = b.fixabilityScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.cvss - a.cvss;
    });

    setFilteredFindings(filtered);
  }, [findings, searchQuery, selectedSeverity, selectedFramework]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFindings(new Set(filteredFindings.map((f) => f.id)));
    } else {
      setSelectedFindings(new Set());
    }
  };

  const handleSelectFinding = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedFindings);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedFindings(newSelected);
  };

  const handleAddToChat = (finding: Finding) => {
    const payload = cedarPayloadShapes.devMinimal(finding);
    const label = `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;

    // Use Cedar's native context system
    addToContext(
      `finding-${finding.id}`,
      payload,
      label,
      finding.severity === "Critical" ? "#dc2626" :
      finding.severity === "High" ? "#ea580c" :
      finding.severity === "Medium" ? "#ca8a04" : "#16a34a"
    );
  };

  const handleAddSelectedToChat = () => {
    const selected = filteredFindings.filter((f) => selectedFindings.has(f.id));
    selected.forEach((finding) => {
      const payload = cedarPayloadShapes.devMinimal(finding);
      const label = `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;

      // Use Cedar's native context system
      addToContext(
        `finding-${finding.id}`,
        payload,
        label,
        finding.severity === "Critical" ? "#dc2626" :
        finding.severity === "High" ? "#ea580c" :
        finding.severity === "Medium" ? "#ca8a04" : "#16a34a"
      );
    });
    toast.success(`${selected.length} findings added to Chat`);
  };

  const handleAddAllFilteredToChat = () => {
    filteredFindings.forEach((finding) => {
      const payload = cedarPayloadShapes.devMinimal(finding);
      const tokens = cedarEstimateTokens(payload);
      addItem({
        type: "vulnerability",
        label: `${finding.endpoint.method} ${finding.endpoint.path}`,
        data: payload,
        tokens,
      });
    });
    const totalTokens = filteredFindings.reduce((sum, f) => sum + cedarEstimateTokens(cedarPayloadShapes.devMinimal(f)), 0);
    toast.success(`${filteredFindings.length} findings added to Context Basket (≈${totalTokens} tokens)`);
  };

  const handleCopyRepro = (finding: Finding) => {
    const curlCmd = `curl -X ${finding.endpoint.method} https://api.example.com${finding.endpoint.path}`;
    cedar.util.copy(curlCmd);
  };

  const handleGenerateFixPR = (finding: Finding) => {
    const payload = cedarPayloadShapes.devMinimal(finding);
    cedar.chat.send(
      payload,
      "Generate minimal, safe diff + unit/integration tests. Provide PR body and migration notes. Prefer non-breaking changes; if exploit present, include hot patch (gateway/header/rate limit)."
    );
  };

  const handleMarkSelectedForPR = () => {
    const selected = filteredFindings.filter((f) => selectedFindings.has(f.id));
    const payloads = selected.map(f => cedarPayloadShapes.devMinimal(f));
    cedar.chat.send(
      payloads,
      "For each selected finding generate: (1) minimal, safe code diff; (2) unit + integration tests; (3) a 48-hour hot patch (gateway/header/rate limit) and the long-term fix; (4) PR body referencing CVE/CWE/OWASP."
    );
  };

  const frameworks = Array.from(new Set(findings.map((f) => f.framework).filter(Boolean)));

  // Keyboard shortcuts (CedarOS spec)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedFindings.size === 1) {
        const finding = findings.find((f) => selectedFindings.has(f.id));
        if (finding) onSelectFinding(finding);
      }
      if (e.shiftKey && e.key === "A" && selectedFindings.size > 0) {
        e.preventDefault();
        handleAddSelectedToChat();
      }
      if (e.shiftKey && e.key === "P" && selectedFindings.size > 0) {
        e.preventDefault();
        handleMarkSelectedForPR();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFindings, findings, onSelectFinding]);

  return (
    <Card className="p-6 bg-card border-border">
      {/* Filters and Actions */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by service, repo, file, or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedFramework} onValueChange={setSelectedFramework}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {frameworks.map((fw) => (
                <SelectItem key={fw} value={fw!}>
                  {fw}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedFindings.size > 0 && (
            <>
              <Button size="sm" onClick={handleMarkSelectedForPR}>
                <Wrench className="h-4 w-4 mr-1" />
                Generate Fix PR ({selectedFindings.size} selected)
              </Button>
              <Button size="sm" variant="outline" onClick={handleAddSelectedToChat}>
                <Plus className="h-4 w-4 mr-1" />
                Add to Chat (≈{filteredFindings.filter(f => selectedFindings.has(f.id)).reduce((sum, f) => sum + cedarEstimateTokens(cedarPayloadShapes.devMinimal(f)), 0)} tokens)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedFindings(new Set())}>
                Clear Selection
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleAddAllFilteredToChat}>
            <Plus className="h-4 w-4 mr-1" />
            Add all filtered to chat
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/20 p-3 rounded">
          <span className="font-semibold">Legend:</span>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-destructive" />
            <span>Public exploit</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="destructive" className="text-xs px-1.5 py-0">NEW</Badge>
            <span>New this week</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-destructive/60 text-destructive font-semibold">REG</Badge>
            <span>Regressed</span>
          </div>
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-primary" />
            <span>Internet-facing</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>Auth context</span>
          </div>
          <div className="text-xs font-semibold text-foreground ml-2">
            Keyboard: Enter=details · Shift+A=add to chat · Shift+P=mark for PR
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedFindings.size === filteredFindings.length && filteredFindings.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Service/Repo · File/Route</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>CVSS</TableHead>
              <TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      Exploitability
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on Exploit-DB public exploit signal</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead>Suggested Fix</TableHead>
              <TableHead>PR Status</TableHead>
              <TableHead>Tests</TableHead>
              <TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      Fixability
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Score (0-10) based on:</p>
                      <ul className="list-disc list-inside text-xs mt-1">
                        <li>Known pattern (35%)</li>
                        <li>Exploitability (25%)</li>
                        <li>CVSS (20%)</li>
                        <li>Blast radius (10%)</li>
                        <li>Code ownership (10%)</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFindings.map((finding) => (
              <TableRow
                key={finding.id}
                className="hover:bg-muted/30 cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, input")) return;
                  onSelectFinding(finding);
                }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedFindings.has(finding.id)}
                    onCheckedChange={(checked) => handleSelectFinding(finding.id, !!checked)}
                    aria-label={`Select ${finding.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground">
                      {finding.endpoint.service} · {finding.repo || "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {finding.endpoint.method} {finding.endpoint.path}
                    </div>
                    {finding.file && (
                      <div className="text-xs text-muted-foreground">{finding.file}</div>
                    )}
                    {/* Signal chips */}
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {finding.flags.isNew && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">NEW</Badge>
                      )}
                      {finding.flags.isRegressed && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 border-destructive/60 text-destructive font-semibold">REG</Badge>
                      )}
                      {finding.exposure >= 8 && (
                        <Globe className="h-3 w-3 text-primary" aria-label="Internet-facing" />
                      )}
                      {finding.exploitPresent && (
                        <Shield className="h-3 w-3 text-destructive" aria-label="Public exploit available" />
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={severityColors[finding.severity]}>{finding.severity}</Badge>
                </TableCell>
                <TableCell className="font-semibold">{finding.cvss}</TableCell>
                <TableCell>
                  <span className={finding.exploitPresent ? "text-destructive font-semibold" : ""}>
                    {finding.exploitPresent ? "Yes" : "No"}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs">
                  <p className="text-sm text-muted-foreground line-clamp-2">{finding.suggestedFix || "N/A"}</p>
                </TableCell>
                <TableCell>
                  <Badge className={prStatusColors[finding.prStatus || "None"]}>{finding.prStatus || "None"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={testsStatusColors[finding.testsStatus || "None"]}>{finding.testsStatus || "None"}</Badge>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1 font-semibold text-primary">
                          {finding.fixabilityScore?.toFixed(1) || "N/A"}
                          <Info className="h-3 w-3" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-xs">{getFixabilityTooltip(finding)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => handleGenerateFixPR(finding)}>
                            <Wrench className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Generate Fix PR</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => handleAddToChat(finding)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add to Chat</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => handleCopyRepro(finding)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy cURL</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => cedar.workflow.repo.open({ repo: finding.repo || '', file: finding.file || '' })}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open in Repo</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredFindings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No findings match your filters.</p>
        </div>
      )}
    </Card>
  );
};
