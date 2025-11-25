import { useEffect } from "react";
import { useCedarState, useSubscribeStateToAgentContext } from "cedar-os";
import type { Finding } from "@/types/finding";

interface FindingsSelectionBridgeProps {
  selectedFindings: Finding[];
  stateKey: string; // Unique key per page to prevent duplicate subscriptions
  description?: string;
}

export function FindingsSelectionBridge({
  selectedFindings,
  stateKey,
  description = "Selected findings in the current view"
}: FindingsSelectionBridgeProps) {
  const [selection, setSelection] = useCedarState({
    key: stateKey,
    initialValue: selectedFindings,
    description,
  });

  useEffect(() => {
    setSelection(selectedFindings);
  }, [selectedFindings, setSelection]);

  useSubscribeStateToAgentContext(
    stateKey,
    (findings: Finding[]) => {
      // Don't show context if no findings are selected
      if (!findings || findings.length === 0) {
        return null;
      }

      return {
        findings: findings.map((f) => ({
          id: f.id,
          endpoint: `${f.endpoint.method} ${f.endpoint.path}`,
          service: f.endpoint.service,
          repo: f.repo,
          severity: f.severity,
          cvss: f.cvss,
          exploitPresent: f.exploitPresent,
          owasp: f.owasp,
          cwe: f.cwe,
          status: f.status,
          priorityScore: f.priorityScore,
        })),
      };
    },
    {
      labelField: (f: Finding) => `${f.severity}: ${f.endpoint.method} ${f.endpoint.path}`,
      order: 5,
    }
  );

  return null;
}

interface ExecutiveDataBridgeProps {
  summary: any;
}

export function ExecutiveDataBridge({ summary }: ExecutiveDataBridgeProps) {
  const [execState, setExecState] = useCedarState({
    key: "executive-summary",
    initialValue: summary,
    description: "Executive risk summary and KPIs",
  });

  useEffect(() => {
    setExecState(summary);
  }, [summary, setExecState]);

  useSubscribeStateToAgentContext(
    "executive-summary",
    (data: any) => ({
      riskScore: data?.riskScore,
      critical: data?.critical,
      high: data?.high,
      pastSlaPct: data?.pastSlaPct,
      mttrMedian: data?.mttrMedian,
      mttrP95: data?.mttrP95,
      publicExploitCount: data?.publicExploitCount,
      internetFacingCount: data?.internetFacingCount,
    }),
    {
      labelField: () => "Executive Risk Summary",
      order: 1,
    }
  );

  return null;
}
