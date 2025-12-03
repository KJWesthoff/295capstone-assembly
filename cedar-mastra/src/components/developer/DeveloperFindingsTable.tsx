"use client";

import { useState, useMemo, useCallback } from "react";
import { Shield, Globe, Plus, Copy, ExternalLink, Wrench, Filter, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getFixabilityTooltip } from "@/types/finding";
import { cedar, cedarPayloadShapes } from "@/lib/cedar/actions";
import { useFindingActions } from "@/lib/cedar/useFindingActions";
import { useCedarActions } from "@/lib/cedar/hooks";
import { getSeverityColor, Severity } from "@/lib/utils/severity";
import { SeverityTooltip } from "@/components/shared/SeverityTooltip";
import type { Finding } from "@/types/finding";
import { DataTable, DataTableColumn, KeyboardShortcut } from "@/components/shared/DataTable";

interface DeveloperFindingsTableProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  selectedFindings?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;
}

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

const getOwaspRank = (owaspString: string): string | null => {
  // Extract "API1" from "API1:2023 Broken Object Level Authorization"
  const match = owaspString.match(/^(API\d+)/);
  return match ? match[1] : null;
};

export const DeveloperFindingsTable = ({
  findings,
  onSelectFinding,
  selectedFindings,
  onSelectionChange
}: DeveloperFindingsTableProps) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedFramework, setSelectedFramework] = useState<string>("all");
  const { addFindingToChat, addFindingsToChat, visualizeFinding } = useFindingActions();
  const { sendMessage } = useCedarActions();

  // Memoize Select handlers to prevent infinite loops
  const handleSeverityChange = useCallback((value: string) => {
    setSelectedSeverity(value);
  }, []);

  const handleFrameworkChange = useCallback((value: string) => {
    setSelectedFramework(value);
  }, []);

  // Apply severity and framework filters
  const applyFilters = useCallback((data: Finding[]) => {
    let filtered = data;

    if (selectedSeverity !== "all") {
      filtered = filtered.filter((f) => f.severity === selectedSeverity);
    }

    if (selectedFramework !== "all") {
      filtered = filtered.filter((f) => f.framework === selectedFramework);
    }

    return filtered;
  }, [selectedSeverity, selectedFramework]);

  const handleAddToChat = useCallback((finding: Finding) => {
    const payload = cedarPayloadShapes.devMinimal(finding);
    addFindingToChat(finding, "finding", payload);
  }, [addFindingToChat]);

  const handleAddSelectedToChat = useCallback((selectedFindingsArray: Finding[]) => {
    addFindingsToChat(selectedFindingsArray, "finding", cedarPayloadShapes.devMinimal);
  }, [addFindingsToChat]);

  const handleAddAllFilteredToChat = useCallback((filteredFindings: Finding[]) => {
    addFindingsToChat(filteredFindings, "finding", cedarPayloadShapes.devMinimal);
  }, [addFindingsToChat]);

  const handleCopyRepro = useCallback((finding: Finding) => {
    const curlCmd = `curl -X ${finding.endpoint.method} https://api.example.com${finding.endpoint.path}`;
    cedar.util.copy(curlCmd);
  }, []);

  const handleGenerateFixPR = useCallback((finding: Finding) => {
    const payload = cedarPayloadShapes.devMinimal(finding);
    cedar.chat.send(
      payload,
      "Generate minimal, safe diff + unit/integration tests. Provide PR body and migration notes. Prefer non-breaking changes; if exploit present, include hot patch (gateway/header/rate limit)."
    );
  }, []);

  const handleMarkSelectedForPR = useCallback((selectedFindingsArray: Finding[]) => {
    const payloads = selectedFindingsArray.map(f => cedarPayloadShapes.devMinimal(f));
    cedar.chat.send(
      payloads,
      "For each selected finding generate: (1) minimal, safe code diff; (2) unit + integration tests; (3) a 48-hour hot patch (gateway/header/rate limit) and the long-term fix; (4) PR body referencing CVE/CWE/OWASP."
    );
  }, []);

  // Memoize frameworks to prevent Select from re-rendering infinitely
  const frameworks = useMemo(() => {
    return Array.from(new Set(findings.map((f) => f.framework).filter(Boolean)));
  }, [findings]);

  // Define columns
  const columns: DataTableColumn<Finding>[] = useMemo(() => [
    {
      id: "service",
      header: "Service/Repo · File/Route",
      cell: ({ row: finding }) => {
        const owaspRank = getOwaspRank(finding.owasp);
        return (
          <div className="space-y-1">
            <div className="font-semibold text-foreground">
              {finding.summaryHumanReadable || finding.owasp || "No Title"}
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {finding.endpoint.method} {finding.endpoint.path}
            </div>
            {finding.file && (
              <div className="text-xs text-muted-foreground">{finding.file}</div>
            )}
            {/* Signal chips */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {owaspRank && (
                <TooltipProvider>
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
                </TooltipProvider>
              )}
              {finding.flags?.isNew && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">NEW</Badge>
              )}
              {finding.flags?.isRegressed && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-destructive/60 text-destructive font-semibold">REG</Badge>
              )}
              {finding.exposure && finding.exposure >= 8 && (
                <Globe className="h-3 w-3 text-primary" aria-label="Internet-facing" />
              )}
              {finding.exploitPresent && (
                <Shield className="h-3 w-3 text-destructive" aria-label="Public exploit available" />
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "severity",
      header: "Severity",
      enableSorting: true,
      accessorKey: "severity",
      cell: ({ row: finding }) => (
        <SeverityTooltip
          severity={finding.severity}
          onFilterBySeverity={() => {
            setSelectedSeverity(finding.severity);
            toast.success(`Filtered to ${finding.severity} severity findings`);
          }}
          onExplainSeverity={() => {
            handleAddToChat(finding);
            sendMessage?.(`Why is this finding rated as ${finding.severity} severity? Provide a developer-focused explanation with impact on code and remediation priority.`);
          }}
          onShowRemediation={() => {
            handleAddToChat(finding);
            sendMessage?.(`@finding-${finding.id} Provide detailed remediation guidance including code examples, testing approach, and PR checklist.`);
          }}
        >
          <Badge className={getSeverityColor(finding.severity as Severity)}>{finding.severity}</Badge>
        </SeverityTooltip>
      ),
    },
    {
      id: "cvss",
      header: "CVSS",
      enableSorting: true,
      accessorKey: "cvss",
      cell: ({ row: finding }) => (
        <span className="font-semibold">{finding.cvss}</span>
      ),
    },
    {
      id: "exploitability",
      header: "Exploitability",
      cell: ({ row: finding }) => (
        <span className={finding.exploitPresent ? "text-destructive font-semibold" : ""}>
          {finding.exploitPresent ? "Yes" : "No"}
        </span>
      ),
    },
    {
      id: "suggestedFix",
      header: "Suggested Fix",
      cell: ({ row: finding }) => (
        <p className="text-sm text-muted-foreground line-clamp-2">{finding.suggestedFix || "N/A"}</p>
      ),
    },
    {
      id: "prStatus",
      header: "PR Status",
      enableSorting: true,
      accessorKey: "prStatus",
      cell: ({ row: finding }) => (
        <Badge className={prStatusColors[finding.prStatus || "None"]}>{finding.prStatus || "None"}</Badge>
      ),
    },
    {
      id: "tests",
      header: "Tests",
      enableSorting: true,
      accessorKey: "testsStatus",
      cell: ({ row: finding }) => (
        <Badge className={testsStatusColors[finding.testsStatus || "None"]}>{finding.testsStatus || "None"}</Badge>
      ),
    },
    {
      id: "fixability",
      header: "Fixability",
      enableSorting: true,
      accessorKey: "fixabilityScore",
      cell: ({ row: finding }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1 font-semibold text-primary">
                {finding.fixabilityScore?.toFixed(1) || "N/A"}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="text-xs">{getFixabilityTooltip(finding)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row: finding }) => (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateFixPR(finding);
                }}>
                  <Wrench className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generate Fix PR</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  handleAddToChat(finding);
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add to Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  handleCopyRepro(finding);
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy cURL</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  cedar.workflow.repo.open({ repo: finding.repo || '', file: finding.file || '' });
                }}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in Repo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={(e) => {
                  e.stopPropagation();
                  visualizeFinding(finding);
                }}>
                  <GitCompare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visualize Attack Path</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ], [handleAddToChat, handleGenerateFixPR, handleCopyRepro, sendMessage, setSelectedSeverity]);

  // Define keyboard shortcuts
  const keyboardShortcuts: KeyboardShortcut<Finding>[] = useMemo(() => [
    {
      key: 'Enter',
      handler: (selected) => {
        if (selected.length === 1) {
          onSelectFinding(selected[0]);
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
      key: 'P',
      modifiers: ['shift'],
      handler: handleMarkSelectedForPR,
      description: 'Mark for PR',
      condition: (selected) => selected.length > 0,
    },
  ], [onSelectFinding, handleAddSelectedToChat, handleMarkSelectedForPR]);

  // Memoize SelectTrigger children to prevent Radix UI from detecting changes
  const severityTriggerContent = useMemo(() => (
    <>
      <Filter className="h-4 w-4 mr-2" />
      <SelectValue placeholder="Severity" />
    </>
  ), []);

  const frameworkTriggerContent = useMemo(() => (
    <>
      <Filter className="h-4 w-4 mr-2" />
      <SelectValue placeholder="Framework" />
    </>
  ), []);

  return (
    <Card className="p-6 bg-card border-border">
      <TooltipProvider>
        <DataTable
          data={findings}
          columns={columns}
          enableSearch={true}
          searchPlaceholder="Search by service, repo, file, or path..."
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
          onRowClick={onSelectFinding}
          getRowKey={(finding) => finding.id}
          renderLegend={() => (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/20 p-3 rounded">
              <span className="font-semibold">Legend:</span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-[#5B21B6]/10 text-[#5B21B6] border-[#5B21B6]/40 font-semibold">API#</Badge>
                <span>OWASP Top 10</span>
              </div>
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
              <div className="text-xs font-semibold text-foreground ml-2">
                Keyboard: Enter=details · Shift+A=add to chat · Shift+P=mark for PR
              </div>
            </div>
          )}
          renderToolbarActions={(filteredData, selectedRows) => (
            <>
              <Select value={selectedSeverity} onValueChange={handleSeverityChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  {severityTriggerContent}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedFramework} onValueChange={handleFrameworkChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  {frameworkTriggerContent}
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

              {selectedRows.size > 0 && (
                <>
                  <Button size="sm" onClick={() => {
                    const selected = findings.filter(f => selectedRows.has(f.id));
                    handleMarkSelectedForPR(selected);
                  }}>
                    <Wrench className="h-4 w-4 mr-1" />
                    Generate Fix PR ({selectedRows.size} selected)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const selected = findings.filter(f => selectedRows.has(f.id));
                    handleAddSelectedToChat(selected);
                  }}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add to Chat ({selectedRows.size} selected)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onSelectionChange?.(new Set())}>
                    Clear Selection
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => handleAddAllFilteredToChat(filteredData)}>
                <Plus className="h-4 w-4 mr-1" />
                Add all filtered to chat
              </Button>
            </>
          )}
        />
      </TooltipProvider>
    </Card>
  );
};
