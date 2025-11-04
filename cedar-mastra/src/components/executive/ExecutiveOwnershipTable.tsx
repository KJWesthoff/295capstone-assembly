"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Bell } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cedar, cedarPayloadShapes, cedarEstimateTokens } from "@/lib/cedar/actions";
import { useCedarActions } from "@/lib/cedar/hooks";

interface OwnerRow {
  owner: string;
  critOpen: number;
  highOpen: number;
  pastSLA: number;
  dueNext7: number;
}

interface ExecutiveOwnershipTableProps {
  owners: OwnerRow[];
  onAddToReport?: (label: string, payload: any) => void;
}

export const ExecutiveOwnershipTable = ({ owners, onAddToReport }: ExecutiveOwnershipTableProps) => {
  const { addToContext } = useCedarActions();

  const handleAddToChat = (owner: OwnerRow) => {
    const payload = { ...owner };
    const label = `Owner: ${owner.owner}`;

    addToContext(
      `owner-${owner.owner}`,
      payload,
      label,
      "#003262"
    );
  };

  return (
    <Card className="p-6 bg-card border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Ownership & SLA</h3>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Owner/Team</TableHead>
              <TableHead className="text-center">Critical</TableHead>
              <TableHead className="text-center">High</TableHead>
              <TableHead className="text-center">Past SLA</TableHead>
              <TableHead className="text-center">Due (7d)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {owners.map((owner) => (
              <TableRow key={owner.owner} className="hover:bg-muted/30">
                <TableCell className="font-semibold text-foreground">{owner.owner}</TableCell>
                <TableCell className="text-center">
                  {owner.critOpen > 0 ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive font-semibold text-sm">
                      {owner.critOpen}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {owner.highOpen > 0 ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--chart-1))]/10 text-[hsl(var(--chart-1))] font-semibold text-sm">
                      {owner.highOpen}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {owner.pastSLA > 0 ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive font-semibold text-sm">
                      {owner.pastSLA}
                    </span>
                  ) : (
                    <span className="text-success font-semibold">✓</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {owner.dueNext7 > 0 ? (
                    <span className="font-semibold text-foreground">{owner.dueNext7}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cedar.workflow.nudge({ owner: owner.owner, message: "Please review and update SLA items." })}
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      Nudge
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddToChat(owner)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
