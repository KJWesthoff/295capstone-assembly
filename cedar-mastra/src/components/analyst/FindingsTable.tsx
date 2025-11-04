"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, Download, GitCompare, Info, Shield, Globe, AlertTriangle, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { Finding } from "@/types/finding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { getPriorityTooltip } from "@/types/finding";
import { cedar, cedarPayloadShapes, cedarEstimateTokens } from "@/lib/cedar/actions";
import { useCedarActions } from "@/lib/cedar/hooks";

interface FindingsTableProps {
  findings: Finding[];
  onRowClick: (finding: Finding) => void;
  onOpenDiff: () => void;
  diffCounts?: {
    new: number;
    regressed: number;
    resolved: number;
  };
  selectedFindings?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

const severityColors = {
  Critical: "bg-critical/20 text-critical border-critical/40",
  High: "bg-high/20 text-high border-high/40",
  Medium: "bg-medium/20 text-medium border-medium/40",
  Low: "bg-low/20 text-low border-low/40",
};

const getEvidenceQuality = (finding: Finding): { label: string; icon: React.ReactNode; color: string } => {
  // Simplified logic: check if we have evidence ID and if exploit is present
  const hasEvidence = finding.evidenceId && finding.evidenceId.length > 0;
  const hasExploit = finding.exploitPresent;

  if (hasEvidence && hasExploit) {
    return { label: "Complete", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-green-600" };
  } else if (hasEvidence) {
    return { label: "Partial", icon: <AlertCircle className="h-3 w-3" />, color: "text-yellow-600" };
  } else {
    return { label: "Missing", icon: <HelpCircle className="h-3 w-3" />, color: "text-muted-foreground" };
  }
};

const getAuthIcon = (exposure: number) => {
  if (exposure >= 9) return { icon: <Globe className="h-3 w-3" />, label: "No auth", color: "text-critical" };
  if (exposure >= 6) return { icon: <Shield className="h-3 w-3" />, label: "User", color: "text-medium" };
  return { icon: <Shield className="h-3 w-3" />, label: "Admin", color: "text-info" };
};

export const FindingsTable = ({
  findings,
  onRowClick,
  onOpenDiff,
  diffCounts,
  selectedFindings: controlledSelectedFindings,
  onSelectionChange
}: FindingsTableProps) => {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [internalSelectedFindings, setInternalSelectedFindings] = useState<Set<string>>(new Set());
  const [addedFindings, setAddedFindings] = useState<Set<string>>(new Set());
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

  const filteredFindings = findings.filter((f) => {
    const matchSearch =
      search === "" ||
      f.endpoint.path.toLowerCase().includes(search.toLowerCase()) ||
      f.cwe.some((c) => c.toLowerCase().includes(search.toLowerCase())) ||
      f.cve.some((c) => c.toLowerCase().includes(search.toLowerCase()));

    const matchSeverity = severityFilter.length === 0 || severityFilter.includes(f.severity);
    const matchStatus = statusFilter.length === 0 || statusFilter.includes(f.status);

    return matchSearch && matchSeverity && matchStatus;
  });

  const handleAddToChat = (finding: Finding, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    console.log('🔘 Add button clicked for finding:', finding.id);
    console.log('📋 Finding data:', finding);

    const payload = cedarPayloadShapes.fullFinding(finding);
    const label = `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;

    console.log('📦 Adding to context with label:', label);

    // Use Cedar's native context system
    addToContext(
      `finding-${finding.id}`,
      payload,
      label,
      finding.severity === "Critical" ? "#dc2626" :
      finding.severity === "High" ? "#ea580c" :
      finding.severity === "Medium" ? "#ca8a04" : "#16a34a"
    );

    // Mark this finding as added
    setAddedFindings(prev => {
      const newSet = new Set(prev);
      newSet.add(finding.id);
      console.log('✅ Updated addedFindings. Now contains:', Array.from(newSet));
      return newSet;
    });
  };

  const handleAddAllFiltered = () => {
    let totalTokens = 0;
    filteredFindings.forEach(finding => {
      const payload = cedarPayloadShapes.minimalFinding(finding);
      const tokens = cedarEstimateTokens(payload);
      totalTokens += tokens;
      addItem({
        type: "vulnerability",
        label: `${finding.endpoint.method} ${finding.endpoint.path}`,
        data: payload,
        tokens,
      });
    });
    toast.success(`Added ${filteredFindings.length} findings (≈${totalTokens} tokens) to Context Basket`);
  };

  const handleToggleSelect = (findingId: string) => {
    const newSelected = new Set(selectedFindings);
    if (newSelected.has(findingId)) {
      newSelected.delete(findingId);
    } else {
      newSelected.add(findingId);
    }
    setSelectedFindings(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (selectedFindings.size === filteredFindings.length) {
      setSelectedFindings(new Set());
    } else {
      setSelectedFindings(new Set(filteredFindings.map(f => f.id)));
    }
  };

  const handleAddSelectedToChat = () => {
    const selected = filteredFindings.filter(f => selectedFindings.has(f.id));
    selected.forEach(finding => {
      const payload = cedarPayloadShapes.fullFinding(finding);
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
    toast.success(`Added ${selected.length} selected findings to Chat`);
    setSelectedFindings(new Set());
  };

  const handleMarkFalsePositive = (findingId: string) => {
    cedar.workflow.findings.markFalsePositive({ id: findingId });
    setSelectedFindings(new Set());
  };

  const handleMergeDuplicates = () => {
    if (selectedFindings.size < 2) {
      toast.error("Select at least 2 findings to merge");
      return;
    }
    const ids = Array.from(selectedFindings);
    cedar.workflow.findings.mergeDuplicates({ ids, primaryId: ids[0] });
    setSelectedFindings(new Set());
  };

  const handleAcceptRisk = (findingId: string) => {
    cedar.workflow.risk.accept({ id: findingId, reason: "Manual risk acceptance" });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter' && selectedFindings.size === 1) {
        const findingId = Array.from(selectedFindings)[0];
        const finding = findings.find(f => f.id === findingId);
        if (finding) onRowClick(finding);
      } else if (e.shiftKey && e.key === 'A' && selectedFindings.size > 0) {
        e.preventDefault();
        handleAddSelectedToChat();
      } else if (e.shiftKey && e.key === 'F' && selectedFindings.size >= 1) {
        e.preventDefault();
        const findingId = Array.from(selectedFindings)[0];
        handleMarkFalsePositive(findingId);
      } else if (e.shiftKey && e.key === 'M' && selectedFindings.size >= 2) {
        e.preventDefault();
        handleMergeDuplicates();
      } else if (e.shiftKey && e.key === 'R' && selectedFindings.size === 1) {
        e.preventDefault();
        const findingId = Array.from(selectedFindings)[0];
        handleAcceptRisk(findingId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFindings, findings]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground bg-card px-4 py-2 rounded-lg border border-border">
          <span className="font-semibold text-foreground">Legend:</span>
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-critical" />
            <span>No auth</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-medium" />
            <span>User auth</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-info" />
            <span>Admin auth</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-critical" />
            <span>Public exploit</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-critical/10 text-critical border-critical/40">NEW</Badge>
            <span>New finding</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-high/10 text-high border-high/40">REG</Badge>
            <span>Regressed</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search endpoint, CWE, CVE, text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            {selectedFindings.size > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleAddSelectedToChat}
              >
                <Plus className="mr-2 h-4 w-4" />
                Apply to {selectedFindings.size} selected (≈{selectedFindings.size * 200} tokens)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAllFiltered}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add all filtered to chat
            </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Severity
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["Critical", "High", "Medium", "Low"].map((sev) => (
                <DropdownMenuCheckboxItem
                  key={sev}
                  checked={severityFilter.includes(sev)}
                  onCheckedChange={(checked) => {
                    setSeverityFilter(
                      checked
                        ? [...severityFilter, sev]
                        : severityFilter.filter((s) => s !== sev)
                    );
                  }}
                >
                  {sev}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["New", "Open", "In Review", "Resolved", "Accepted Risk", "False Positive"].map(
                (status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statusFilter.includes(status)}
                    onCheckedChange={(checked) => {
                      setStatusFilter(
                        checked
                          ? [...statusFilter, status]
                          : statusFilter.filter((s) => s !== status)
                      );
                    }}
                  >
                    {status}
                  </DropdownMenuCheckboxItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={onOpenDiff}>
            <GitCompare className="mr-2 h-4 w-4" />
            Diff vs Last Scan
            {diffCounts && (
              <span className="ml-2 text-xs">
                <Badge variant="outline" className="ml-1 bg-critical/10 text-critical border-critical/40">
                  {diffCounts.new}
                </Badge>
                <Badge variant="outline" className="ml-1 bg-high/10 text-high border-high/40">
                  {diffCounts.regressed}
                </Badge>
                <Badge variant="outline" className="ml-1 bg-green-100 text-green-700 border-green-300">
                  {diffCounts.resolved}
                </Badge>
              </span>
            )}
          </Button>

          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

        {/* Quick keyboard help */}
        <div className="text-xs text-muted-foreground">
          Keyboard: <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> open details ·
          <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+A</kbd> add to chat ·
          <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+F</kbd> mark FP ·
          <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+M</kbd> merge ·
          <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+R</kbd> accept risk ·
          <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Ctrl+/</kbd> chat
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedFindings.size === filteredFindings.length && filteredFindings.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Select all findings"
                  />
                </TableHead>
                <TableHead className="w-[80px]">Signals</TableHead>
                <TableHead className="w-[280px]">Endpoint</TableHead>
                <TableHead className="w-[110px]">Severity</TableHead>
                <TableHead className="w-[90px]">CVSS</TableHead>
                <TableHead className="w-[140px]">Exploitability</TableHead>
                <TableHead className="w-[120px]">Evidence</TableHead>
                <TableHead className="w-[140px]">Scanner(s)</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[110px] text-right">
                  <div className="flex items-center justify-end gap-1">
                    Priority
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Priority = 0.4×CVSS + 0.25×Exploit + 0.15×OWASP + 0.10×Exposure + 0.05×Recency + 0.05×BlastRadius</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFindings.map((finding) => {
                const authInfo = getAuthIcon(finding.exposure);
                const evidenceQuality = getEvidenceQuality(finding);
                const isSelected = selectedFindings.has(finding.id);

                return (
                  <TableRow
                    key={finding.id}
                    onClick={() => onRowClick(finding)}
                    className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(finding.id)}
                        aria-label={`Select ${finding.endpoint.path}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className={authInfo.color}>{authInfo.icon}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{authInfo.label}</p>
                          </TooltipContent>
                        </Tooltip>

                        {finding.exploitPresent && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3 w-3 text-critical" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Public exploit available</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {finding.flags.isNew && (
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-critical/10 text-critical border-critical/40">
                            NEW
                          </Badge>
                        )}

                        {finding.flags.isRegressed && (
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-high/10 text-high border-high/40">
                            REG
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <code className="text-primary font-semibold">{finding.endpoint.method}</code>{" "}
                      {finding.endpoint.path}
                      <div className="text-xs text-muted-foreground mt-1">
                        {finding.endpoint.service}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("uppercase text-xs font-semibold", severityColors[finding.severity])}>
                        {finding.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{finding.cvss.toFixed(1)}</TableCell>
                    <TableCell>
                      {finding.exploitPresent ? (
                        <span className="text-critical font-medium">Public exploit</span>
                      ) : (
                        <span className="text-muted-foreground">None found</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-1">
                            <span className={evidenceQuality.color}>{evidenceQuality.icon}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {finding.evidenceId.slice(0, 8)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Evidence quality: {evidenceQuality.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm">{finding.scanners.join(", ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {finding.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="font-semibold">{finding.priorityScore.toFixed(1)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{getPriorityTooltip(finding)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleAddToChat(finding, e)}
                        disabled={addedFindings.has(finding.id)}
                        className={cn(
                          "h-7 text-xs transition-all",
                          addedFindings.has(finding.id)
                            ? "bg-green-600/20 hover:bg-green-600/30 text-green-600 cursor-default"
                            : "bg-primary/10 hover:bg-primary/20 text-primary"
                        )}
                        title={addedFindings.has(finding.id) ? "Added to chat context" : "Add to chat context"}
                      >
                        {addedFindings.has(finding.id) ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
        </Table>
      </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredFindings.length} of {findings.length} findings
          {selectedFindings.size > 0 && ` · ${selectedFindings.size} selected`}
        </div>
      </div>
    </TooltipProvider>
  );
};
