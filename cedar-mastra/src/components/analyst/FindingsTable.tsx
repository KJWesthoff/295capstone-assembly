"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus, Filter, Download, GitCompare, Info, Shield, Globe, AlertTriangle, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { Finding } from "@/types/finding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useFindingActions } from "@/lib/cedar/useFindingActions";
import { getSeverityColor, Severity } from "@/lib/utils/severity";
import { SeverityTooltip } from "@/components/shared/SeverityTooltip";
import { DataTable, DataTableColumn, KeyboardShortcut } from "@/components/shared/DataTable";

interface FindingsTableProps {
  findings: Finding[];
  onRowClick: (finding: Finding) => void;
  onOpenDiff: () => void;
  diffCounts?: {
    new: number;
    regressed: number;
    resolved: number;
  };
  selectedFindings?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
}

const getEvidenceQuality = (finding: Finding): { label: string; icon: React.ReactNode; color: string } => {
  const hasEvidence = finding.evidenceId && finding.evidenceId.length > 0;
  const hasExploit = finding.exploitPresent;

  if (hasEvidence && hasExploit) {
    return { label: "Complete", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-success" };
  } else if (hasEvidence) {
    return { label: "Partial", icon: <AlertCircle className="h-3 w-3" />, color: "text-medium" };
  } else {
    return { label: "Missing", icon: <HelpCircle className="h-3 w-3" />, color: "text-muted-foreground" };
  }
};

const getAuthIcon = (exposure: number) => {
  if (exposure >= 9) return { icon: <Globe className="h-3 w-3" />, label: "No auth", color: "text-critical" };
  if (exposure >= 6) return { icon: <Shield className="h-3 w-3" />, label: "User", color: "text-medium" };
  return { icon: <Shield className="h-3 w-3" />, label: "Admin", color: "text-info" };
};

const getOwaspRank = (owaspString: string): string | null => {
  // Extract "API1" from "API1:2023 Broken Object Level Authorization"
  const match = owaspString.match(/^(API\d+)/);
  return match ? match[1] : null;
};

export const FindingsTable = ({
  findings,
  onRowClick,
  onOpenDiff,
  diffCounts,
  selectedFindings,
  onSelectionChange
}: FindingsTableProps) => {
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [addedFindings, setAddedFindings] = useState<Set<string>>(new Set());
  const { addItem } = useContextBasket();
  const { addToContext, sendMessage } = useCedarActions();
  const { visualizeFinding } = useFindingActions();

  const handleAddToChat = (finding: Finding, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    console.log('🔘 Add button clicked for finding:', finding.id);
    console.log('📋 Finding data:', finding);

    const payload = cedarPayloadShapes.fullFinding(finding);
    const label = `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;

    console.log('📦 Adding to context with label:', label);

    addToContext(
      `finding-${finding.id}`,
      payload,
      label,
      getSeverityColor(finding.severity as Severity, 'hex')
    );

    setAddedFindings(prev => {
      const newSet = new Set(prev);
      newSet.add(finding.id);
      console.log('✅ Updated addedFindings. Now contains:', Array.from(newSet));
      return newSet;
    });
  };

  const handleAddAllFiltered = (filteredFindings: Finding[]) => {
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

  const handleAddSelectedToChat = (selectedFindingsArray: Finding[]) => {
    selectedFindingsArray.forEach(finding => {
      const payload = cedarPayloadShapes.fullFinding(finding);
      const label = `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`;

      addToContext(
        `finding-${finding.id}`,
        payload,
        label,
        finding.severity === "Critical" ? "#dc2626" :
          finding.severity === "High" ? "#ea580c" :
            finding.severity === "Medium" ? "#ca8a04" : "#16a34a"
      );
    });
    toast.success(`Added ${selectedFindingsArray.length} selected findings to Chat`);
    onSelectionChange?.(new Set());
  };

  const handleMarkFalsePositive = (selectedFindingsArray: Finding[]) => {
    if (selectedFindingsArray.length === 0) return;
    cedar.workflow.findings.markFalsePositive({ id: selectedFindingsArray[0].id });
    onSelectionChange?.(new Set());
  };

  const handleMergeDuplicates = (selectedFindingsArray: Finding[]) => {
    if (selectedFindingsArray.length < 2) {
      toast.error("Select at least 2 findings to merge");
      return;
    }
    const ids = selectedFindingsArray.map(f => f.id);
    cedar.workflow.findings.mergeDuplicates({ ids, primaryId: ids[0] });
    onSelectionChange?.(new Set());
  };

  const handleAcceptRisk = (selectedFindingsArray: Finding[]) => {
    if (selectedFindingsArray.length === 0) return;
    cedar.workflow.risk.accept({ id: selectedFindingsArray[0].id, reason: "Manual risk acceptance" });
  };

  // Apply severity and status filters
  const applyFilters = useCallback((data: Finding[]) => {
    return data.filter((f) => {
      const matchSeverity = severityFilter.length === 0 || severityFilter.includes(f.severity);
      const matchStatus = statusFilter.length === 0 || statusFilter.includes(f.status);
      return matchSeverity && matchStatus;
    });
  }, [severityFilter, statusFilter]);

  // Define columns
  const columns: DataTableColumn<Finding>[] = useMemo(() => [
    {
      id: "signals",
      header: "Signals",
      className: "w-[120px]",
      cell: ({ row: finding }) => {
        const authInfo = getAuthIcon(finding.exposure);
        const owaspRank = getOwaspRank(finding.owasp);
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {owaspRank && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-[#5B21B6]/10 text-[#5B21B6] border-[#5B21B6]/40 font-semibold">
                    {owaspRank}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{finding.owasp}</p>
                </TooltipContent>
              </Tooltip>
            )}

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
        );
      },
    },
    {
      id: "endpoint",
      header: "Endpoint",
      className: "w-[280px]",
      enableSorting: false, // Disabled: endpoint is an object, not sortable
      cell: ({ row: finding }) => (
        <div className="font-mono text-sm">
          <code className="text-primary font-semibold">{finding.endpoint.method}</code>{" "}
          {finding.endpoint.path}
          <div className="text-xs text-muted-foreground mt-1">
            {finding.endpoint.service}
          </div>
        </div>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      className: "w-[110px]",
      enableSorting: true,
      accessorKey: "severity",
      cell: ({ row: finding }) => (
        <SeverityTooltip
          severity={finding.severity}
          onFilterBySeverity={() => {
            setSeverityFilter([finding.severity]);
            toast.success(`Filtered to ${finding.severity} severity findings`);
          }}
          onExplainSeverity={() => {
            handleAddToChat(finding);
            sendMessage?.(`Why is this finding rated as ${finding.severity} severity? Explain the CVSS calculation and risk factors.`);
          }}
          onShowRemediation={() => {
            handleAddToChat(finding);
            sendMessage?.(`@finding-${finding.id} Provide step-by-step remediation guidance for this ${finding.severity} severity vulnerability.`);
          }}
        >
          <Badge className={cn("uppercase text-xs font-semibold cursor-help", getSeverityColor(finding.severity as Severity, 'border'))}>
            {finding.severity}
          </Badge>
        </SeverityTooltip>
      ),
    },
    {
      id: "cvss",
      header: "CVSS",
      className: "w-[90px]",
      enableSorting: true,
      accessorKey: "cvss",
      cell: ({ row: finding }) => (
        <span className="font-semibold">{finding.cvss.toFixed(1)}</span>
      ),
    },
    {
      id: "exploitability",
      header: "Exploitability",
      className: "w-[140px]",
      cell: ({ row: finding }) => (
        finding.exploitPresent ? (
          <span className="text-critical font-medium">Public exploit</span>
        ) : (
          <span className="text-muted-foreground">None found</span>
        )
      ),
    },
    {
      id: "evidence",
      header: "Evidence",
      className: "w-[120px]",
      cell: ({ row: finding }) => {
        const evidenceQuality = getEvidenceQuality(finding);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
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
        );
      },
    },
    {
      id: "scanners",
      header: "Scanner(s)",
      className: "w-[140px]",
      accessorKey: "scanners",
      cell: ({ row: finding }) => (
        <span className="text-sm">{finding.scanners.join(", ")}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "w-[140px]",
      enableSorting: true,
      accessorKey: "status",
      cell: ({ row: finding }) => (
        <Badge variant="outline" className="text-xs">
          {finding.status}
        </Badge>
      ),
    },
    {
      id: "priority",
      header: (
        <div className="flex items-center justify-end gap-1">
          Priority
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help inline-flex">
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Priority = 0.4×CVSS + 0.25×Exploit + 0.15×OWASP + 0.10×Exposure + 0.05×Recency + 0.05×BlastRadius</p>
            </TooltipContent>
          </Tooltip>
        </div>
      ),
      headerClassName: "w-[110px] text-right",
      className: "text-right",
      enableSorting: true,
      accessorKey: "priorityScore",
      cell: ({ row: finding }) => (
        <Tooltip>
          <TooltipTrigger>
            <span className="font-semibold">{finding.priorityScore.toFixed(1)}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{getPriorityTooltip(finding)}</p>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-[140px]",
      cell: ({ row: finding }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              visualizeFinding(finding);
            }}
            className="h-7 text-xs text-primary bg-primary/10 hover:bg-primary/20"
            title="Visualize Attack Path"
          >
            <GitCompare className="h-3 w-3 mr-1" />
            Visualize
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleAddToChat(finding, e)}
            disabled={addedFindings.has(finding.id)}
            className={cn(
              "h-7 text-xs transition-all",
              addedFindings.has(finding.id)
                ? "bg-success/20 hover:bg-success/30 text-success cursor-default"
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
        </div>
      ),
    },
  ], [addedFindings, sendMessage, setSeverityFilter, handleAddToChat]);

  // Define keyboard shortcuts
  const keyboardShortcuts: KeyboardShortcut<Finding>[] = useMemo(() => [
    {
      key: 'Enter',
      handler: (selected) => {
        if (selected.length === 1) {
          onRowClick(selected[0]);
        }
      },
      description: 'Open details',
      condition: (selected) => selected.length === 1,
    },
    {
      key: 'A',
      modifiers: ['shift'],
      handler: handleAddSelectedToChat,
      description: 'Add to chat',
      condition: (selected) => selected.length > 0,
    },
    {
      key: 'F',
      modifiers: ['shift'],
      handler: handleMarkFalsePositive,
      description: 'Mark FP',
      condition: (selected) => selected.length >= 1,
    },
    {
      key: 'M',
      modifiers: ['shift'],
      handler: handleMergeDuplicates,
      description: 'Merge',
      condition: (selected) => selected.length >= 2,
    },
    {
      key: 'R',
      modifiers: ['shift'],
      handler: handleAcceptRisk,
      description: 'Accept risk',
      condition: (selected) => selected.length === 1,
    },
  ], [onRowClick, handleAddSelectedToChat, handleMarkFalsePositive, handleMergeDuplicates, handleAcceptRisk]);

  return (
    <TooltipProvider>
      <DataTable
        data={findings}
        columns={columns}
        enableSearch={true}
        searchPlaceholder="Search endpoint, CWE, CVE, text…"
        enablePagination={true}
        itemsPerPageOptions={[10, 20, 50, 100]}
        initialItemsPerPage={20}
        enableSorting={true}
        enableSelection={true}
        selectedRows={selectedFindings}
        onSelectionChange={onSelectionChange}
        applyExternalFilters={applyFilters}
        enableKeyboardShortcuts={true}
        keyboardShortcuts={keyboardShortcuts}
        onRowClick={onRowClick}
        getRowKey={(finding) => finding.id}
        rowClassName={(finding, _, isSelected) => cn(isSelected && "bg-primary/5")}
        renderLegend={() => (
          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground bg-card px-4 py-2 rounded-lg border border-border">
            <span className="font-semibold text-foreground">Legend:</span>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-[#5B21B6]/10 text-[#5B21B6] border-[#5B21B6]/40 font-semibold">API#</Badge>
              <span>OWASP Top 10</span>
            </div>
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
        )}
        renderToolbarActions={(filteredData, selectedRows) => (
          <>
            {selectedRows.size > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const selected = findings.filter(f => selectedRows.has(f.id));
                  handleAddSelectedToChat(selected);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add {selectedRows.size} to chat context
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddAllFiltered(filteredData)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add all filtered to chat
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Severity
                  {severityFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5">
                      {severityFilter.length}
                    </Badge>
                  )}
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
                  {statusFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5">
                      {statusFilter.length}
                    </Badge>
                  )}
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
                  <Badge variant="outline" className="ml-1 bg-success/10 text-success border-success/30">
                    {diffCounts.resolved}
                  </Badge>
                </span>
              )}
            </Button>

            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </>
        )}
        renderHelpText={() => (
          <div className="text-xs text-muted-foreground">
            Keyboard: <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> open details ·
            <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+A</kbd> add to chat ·
            <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+F</kbd> mark FP ·
            <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+M</kbd> merge ·
            <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Shift+R</kbd> accept risk ·
            <kbd className="px-1.5 py-0.5 bg-muted rounded ml-2">Ctrl+/</kbd> chat
          </div>
        )}
      />
    </TooltipProvider>
  );
};
