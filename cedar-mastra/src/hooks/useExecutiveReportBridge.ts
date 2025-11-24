import { useCedarStore } from "cedar-os";
import { useState, useCallback, useMemo } from "react";

interface ReportItem {
  type: "kpis" | "topRisks" | "compliance" | "ownership";
  data: any;
}

interface ReportMeta {
  tone: "Board" | "Technical" | "Executive";
  length: number;
  window: "7d" | "30d" | "90d";
}

interface UseExecutiveReportBridgeProps {
  selectedCards?: any[];
  topRiskCards?: any[];
  ownershipRows?: any[];
  complianceSnapshot?: any;
  kpis?: any;
}

export function useExecutiveReportBridge({
  kpis,
  topRiskCards,
  complianceSnapshot,
  ownershipRows
}: UseExecutiveReportBridgeProps = {}) {
  const [reportMeta, setReportMeta] = useState<ReportMeta>({
    tone: "Board",
    length: 150,
    window: "30d"
  });

  // Memoize reportItems to prevent recreation on every render
  const reportItems = useMemo<ReportItem[]>(() => [
    { type: "kpis", data: kpis },
    { type: "topRisks", data: topRiskCards },
    { type: "compliance", data: complianceSnapshot },
    { type: "ownership", data: ownershipRows }
  ], [kpis, topRiskCards, complianceSnapshot, ownershipRows]);

  // Add items manually to Cedar context
  const addContextEntry = useCedarStore(s => s.addContextEntry);
  const addCardToReport = useCallback((label: string, payload: any) => {
    addContextEntry("exec_report", {
      id: crypto.randomUUID(),
      source: "manual" as const,
      data: payload,
      metadata: { label }
    });
  }, [addContextEntry]);

  return { addCardToReport, setReportMeta, reportItems, reportMeta };
}
