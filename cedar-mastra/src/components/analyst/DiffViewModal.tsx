"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Finding } from "@/types/finding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useContextBasket } from "@/contexts/ContextBasketContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cedarPayloadShapes, cedarEstimateTokens } from "@/lib/cedar/actions";

interface DiffViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findings: Finding[];
}

type DiffFilter = "New" | "Regressed" | "Resolved" | "Unchanged";

export const DiffViewModal = ({ open, onOpenChange, findings }: DiffViewModalProps) => {
  const [activeFilter, setActiveFilter] = useState<DiffFilter | null>(null);
  const { addItem } = useContextBasket();

  const filteredFindings = findings.filter((f) => {
    if (!activeFilter) return true;
    switch (activeFilter) {
      case "New":
        return f.flags.isNew;
      case "Regressed":
        return f.flags.isRegressed;
      case "Resolved":
        return f.flags.isResolved;
      case "Unchanged":
        return !f.flags.isNew && !f.flags.isRegressed && !f.flags.isResolved;
      default:
        return true;
    }
  });

  const handleAddToChat = (finding: Finding) => {
    let status: "new" | "regressed" | "resolved";
    if (finding.flags.isNew) status = "new";
    else if (finding.flags.isRegressed) status = "regressed";
    else if (finding.flags.isResolved) status = "resolved";
    else status = "new"; // fallback
    
    const payload = cedarPayloadShapes.diffItem(finding, status);
    const tokenEstimate = cedarEstimateTokens(payload);
    addItem({
      type: "vulnerability",
      label: `${status.toUpperCase()}: ${finding.endpoint.method} ${finding.endpoint.path}`,
      data: payload,
      tokens: tokenEstimate,
    });
    toast.success("Added to Context Basket");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare with last scan</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {(["New", "Regressed", "Resolved", "Unchanged"] as DiffFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(activeFilter === filter ? null : filter)}
            >
              {filter}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-auto border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Change</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFindings.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell className="font-mono text-sm">
                    <code className="text-primary font-semibold">{finding.endpoint.method}</code>{" "}
                    {finding.endpoint.path}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {finding.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{finding.status}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(finding.lastSeen).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {finding.flags.isNew && (
                      <Badge className="bg-info/20 text-info text-xs">New</Badge>
                    )}
                    {finding.flags.isRegressed && (
                      <Badge className="bg-high/20 text-high text-xs">Regressed</Badge>
                    )}
                    {finding.flags.isResolved && (
                      <Badge className="bg-low/20 text-low text-xs">Resolved</Badge>
                    )}
                    {!finding.flags.isNew &&
                      !finding.flags.isRegressed &&
                      !finding.flags.isResolved && (
                        <Badge variant="outline" className="text-xs">
                          Unchanged
                        </Badge>
                      )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddToChat(finding)}
                      className="h-7 text-xs bg-primary/10 hover:bg-primary/20 text-primary"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredFindings.length} of {findings.length} findings
        </div>
      </DialogContent>
    </Dialog>
  );
};
