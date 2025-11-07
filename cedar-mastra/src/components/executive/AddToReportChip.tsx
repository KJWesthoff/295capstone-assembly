"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddToReportChipProps {
  label: string;
  payload: any;
  onAdd: (label: string, payload: any) => void;
}

export function AddToReportChip({ label, payload, onAdd }: AddToReportChipProps) {
  const handleClick = () => {
    onAdd(label, payload);
    toast.success(`Added ${label} to Report`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="gap-2"
    >
      <Plus className="h-3 w-3" />
      Add to Report
    </Button>
  );
}
