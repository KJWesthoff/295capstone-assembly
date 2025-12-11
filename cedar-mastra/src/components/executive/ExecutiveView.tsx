"use client";

import { useState, useEffect, useMemo } from "react";
import { ExecutiveKPICards } from "./ExecutiveKPICards";
import { ExecutiveTrendChart } from "./ExecutiveTrendChart";
import { ExecutiveTopRisks } from "./ExecutiveTopRisks";
import { ExecutiveComplianceSnapshot } from "./ExecutiveComplianceSnapshot";
import { ExecutiveOwnershipTable } from "./ExecutiveOwnershipTable";
import { ChatPresets } from "@/components/shared/ChatPresets";
import { executivePresets } from "@/config/chatPresets";
import { BoardBriefWizard } from "./BoardBriefWizard";
import { DashboardHeader } from "@/components/shared/DashboardHeader";
import { useExecutiveReportBridge } from "@/hooks/useExecutiveReportBridge";
import { useRegisterExecutiveData } from "@/lib/cedar/useRegisterExecutiveData";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useScanResultsState } from "@/app/cedar-os/scanState";
import { useScanManager } from "@/hooks/useScanManager";
import { ScanLauncher, ScanProgressTracker } from "@/components/scanner";
import { ScanSelector } from "@/components/shared/ScanSelector";
import { ExecutiveCostOfInaction } from "./ExecutiveCostOfInaction";
import { MerchantCenterStatus } from "./MerchantCenterStatus";

export const ExecutiveView = () => {
  const [wizardOpen, setWizardOpen] = useState(false);

  // Get findings from Cedar state (populated by ScanSelector)
  const { scanResults } = useScanResultsState();

  // NOTE: useSecurityContext() is now centralized in PageContextProvider
  // to prevent duplicate "Scan Summary" badges in the chat

  const scanFindings = useMemo(() => {
    return scanResults?.findings || [];
  }, [scanResults]);

  // Use centralized scan manager (needed for TrendChart and Launcher)
  const {
    isScanning,
    currentScanStatus,
    activeScanId,
    scans,
    startScan,
  } = useScanManager();

  // Detect "Sally Mode" for the demo
  // Detect "Sally Mode" for the demo
  // Hardcoded to true per user request for demo verification
  const isSallyMode = true;
  console.log("DEBUG: Sally Mode is", isSallyMode);

  // Transform database findings into executive-level metrics
  const execSummary = useMemo(() => {
    if (isSallyMode) {
      return {
        riskScore: 8.9,
        critical: 2,
        high: 1,
        pastSlaPct: 0,
        mttrMedian: 0,
        mttrP95: 0,
        publicExploitCount: 1, // Mocked per user request (was 0)
        internetFacingCount: 2, // Mocked per user request (was 1)
      };
    }

    if (!scanFindings || scanFindings.length === 0) {
      return {
        riskScore: 0,
        critical: 0,
        high: 0,
        pastSlaPct: 0,
        mttrMedian: 0,
        mttrP95: 0,
        publicExploitCount: 0,
        internetFacingCount: 0,
      };
    }

    const criticalCount = scanFindings.filter((f: any) => f.severity === 'Critical').length;
    const highCount = scanFindings.filter((f: any) => f.severity === 'High').length;

    // Calculate risk score based on severity distribution and CVSS scores
    const avgCvss = scanFindings.reduce((sum: number, f: any) => sum + (f.score || 0), 0) / scanFindings.length;
    const severityWeight = (criticalCount * 10 + highCount * 7) / Math.max(scanFindings.length, 1);
    const riskScore = Math.min(10, (avgCvss * 0.6 + severityWeight * 0.4));

    return {
      riskScore: riskScore,
      critical: criticalCount,
      high: highCount,
      pastSlaPct: 0, // Would need historical data
      mttrMedian: 0, // Would need remediation tracking
      mttrP95: 0, // Would need remediation tracking
      publicExploitCount: 0, // Would need exploit database integration
      internetFacingCount: 0, // Would need infrastructure data
    };
  }, [scanFindings, isSallyMode]);

  const topRisks = useMemo(() => {
    if (isSallyMode) {
      return [
        {
          id: "PETAL-001",
          title: "SQL Injection in Delivery Scheduling Plugin",
          severity: "Critical",
          score: 9.8,
          owasp: "Injection",
          affectedEndpoints: 1,
          businessImpact: "Customer Database Exposed",
          systems: ["Delivery Plugin"],
          exploitPresent: true,
          internetFacing: true,
          isNewOrRegressed: "New",
          recommendedAction: "Use prepared statements",
          owner: "Marcus (Dev)",
          eta: "2 hours",
          relatedBreachIds: []
        },
        {
          id: "PETAL-002",
          title: "Broken Object Level Authorization (BOLA)",
          severity: "Critical",
          score: 7.5,
          owasp: "BOLA",
          affectedEndpoints: 1,
          businessImpact: "Order History Exposed",
          systems: ["Order API"],
          exploitPresent: true,
          internetFacing: true,
          isNewOrRegressed: "New",
          recommendedAction: "Add permission check",
          owner: "Marcus (Dev)",
          eta: "4 hours",
          relatedBreachIds: []
        },
        {
          id: "PETAL-003",
          title: "Broken Authentication",
          severity: "High",
          score: 8.1,
          owasp: "Auth",
          affectedEndpoints: 1,
          businessImpact: "Customer Account Takeover",
          systems: ["Auth Service"],
          exploitPresent: false,
          internetFacing: true,
          isNewOrRegressed: "New",
          recommendedAction: "Enforce strong auth",
          owner: "Marcus (Dev)",
          eta: "1 day",
          relatedBreachIds: []
        }
      ];
    }

    if (!scanFindings || scanFindings.length === 0) return [];

    const severityOrder: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

    // Sort by severity and score, take top 5
    return scanFindings
      .sort((a: any, b: any) => {
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        return (b.score || 0) - (a.score || 0);
      })
      .slice(0, 5)
      .map((f: any) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        score: f.score || 0,
        owasp: f.rule || '',
        affectedEndpoints: 1,
        businessImpact: f.description,
        systems: ["API Gateway", "User Service"],
        exploitPresent: f.exploit_available || false,
        internetFacing: true,
        isNewOrRegressed: "-",
        recommendedAction: "Review and patch",
        owner: "Security Team",
        eta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        relatedBreachIds: []
      }));
  }, [scanFindings, isSallyMode]);

  const complianceSnapshot = useMemo(() => {
    if (!scanFindings || scanFindings.length === 0) {
      return {
        owaspCounts: {},
        cweCounts: {},
        nistCsf: {
          Identify: 0,
          Protect: 0,
          Detect: 0,
          Respond: 0,
          Recover: 0,
        },
        nist80053: {},
      };
    }

    // Count findings by OWASP category
    const owaspCounts: Record<string, number> = {};
    scanFindings.forEach((f: any) => {
      if (f.rule) {
        owaspCounts[f.rule] = (owaspCounts[f.rule] || 0) + 1;
      }
    });

    // Count findings by CWE (if available in evidence)
    const cweCounts: Record<string, number> = {};
    // For now, using placeholder data since CWE info may not be in findings
    // In production, you'd extract this from finding.evidence or finding.cwe

    // Map findings to NIST CSF functions (simplified)
    const nistCsf = {
      Identify: scanFindings.filter((f: any) => f.scanner === 'zap').length,
      Protect: scanFindings.filter((f: any) => f.severity === 'Critical').length,
      Detect: scanFindings.filter((f: any) => f.severity === 'High').length,
      Respond: scanFindings.filter((f: any) => f.severity === 'Medium').length,
      Recover: scanFindings.filter((f: any) => f.severity === 'Low').length,
    };

    // NIST 800-53 families (placeholder)
    const nist80053: Record<string, number> = {
      'AC': scanFindings.filter((f: any) => f.rule?.includes('Auth')).length || 0,
      'SI': scanFindings.filter((f: any) => f.rule?.includes('Injection')).length || 0,
    };

    return {
      owaspCounts,
      cweCounts,
      nistCsf,
      nist80053,
    };
  }, [scanFindings]);

  const trendData = useMemo(() => {
    // Mock Trend for Sally Mode
    if (isSallyMode) {
      return {
        window: '30d',
        deltaPct: 45,
        // Interesting curve: increasing risk
        points: [2.1, 2.3, 2.2, 3.5, 4.1, 3.8, 5.2, 6.5, 8.1, 9.8]
      };
    }

    // Create trend data with points array for the chart
    if (!scans || scans.length === 0) {
      return {
        window: '30d',
        deltaPct: 0,
        points: [0],
      };
    }

    // Get last 30 scans (or as many as available) and calculate risk scores
    const recentScans = scans.slice(0, 30).reverse();
    const points = recentScans.map((scan: any) => {
      // Simple risk score based on findings count
      // In a real implementation, you'd fetch each scan's findings and calculate properly
      const findingsCount = scan.findings_count || 0;
      // Normalize to 0-10 scale (assuming max of 50 findings maps to score of 10)
      return Math.min(10, (findingsCount / 50) * 10);
    });

    // Calculate delta percentage (change from first to last)
    const deltaPct = points.length > 1
      ? Math.round(((points[points.length - 1] - points[0]) / Math.max(points[0], 1)) * 100)
      : 0;

    return {
      window: '30d',
      deltaPct,
      points: points.length > 0 ? points : [0],
    };
  }, [scans, isSallyMode]);

  const slaOwners = useMemo(() => {
    if (!scanFindings || scanFindings.length === 0) return [];

    // Group findings by scanner/service
    const byService = scanFindings.reduce((acc: Record<string, any>, f: any) => {
      const service = f.scanner || 'unknown';
      if (!acc[service]) {
        acc[service] = {
          name: service,
          totalFindings: 0,
          criticalFindings: 0,
          overdueSLA: 0,
        };
      }
      acc[service].totalFindings++;
      if (f.severity === 'Critical') acc[service].criticalFindings++;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(byService);
  }, [scanFindings]);

  // Register executive data with Cedar for @mention functionality
  const { risks, owners } = useRegisterExecutiveData(topRisks, slaOwners);

  // Memoize the report bridge config to prevent render loops
  const reportBridgeConfig = useMemo(() => ({
    kpis: execSummary,
    topRiskCards: risks,
    complianceSnapshot: complianceSnapshot,
    ownershipRows: owners
  }), [execSummary, risks, complianceSnapshot, owners]);

  const { addCardToReport, setReportMeta, reportItems, reportMeta } = useExecutiveReportBridge(reportBridgeConfig);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Risk & Compliance Overview"
        description="Current security posture, trends, and prioritized business risks"
        action={
          <Button onClick={() => setWizardOpen(true)} size="lg">
            <FileText className="h-4 w-4 mr-2" />
            Generate Board Brief
          </Button>
        }
      />

      {/* Scanner Controls */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <ScanSelector />
          </div>
          <ScanLauncher
            onStartScan={startScan}
            isScanning={isScanning}
            variant="secondary"
          />
        </div>
      </div>

      {/* Scan Progress Tracker */}
      {isScanning && currentScanStatus && (
        <ScanProgressTracker
          scanStatus={currentScanStatus}
          scanId={activeScanId ?? undefined}
        />
      )}

      <ExecutiveKPICards summary={execSummary} onAddToReport={addCardToReport} hideSLA={isSallyMode} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <ExecutiveTrendChart trend={trendData} />
        </div>
        <div className="lg:col-span-5">
          <ExecutiveTrendChart trend={trendData} isSLA />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ExecutiveTopRisks risks={risks} onAddToReport={addCardToReport} />
        </div>
        <div className="lg:col-span-4 space-y-6">
          {isSallyMode ? (
            <>
              <MerchantCenterStatus />
              <ExecutiveCostOfInaction />
            </>
          ) : (
            <ExecutiveComplianceSnapshot compliance={complianceSnapshot} onAddToReport={addCardToReport} />
          )}
        </div>
      </div>

      {!isSallyMode && (
        <ExecutiveOwnershipTable owners={owners} onAddToReport={addCardToReport} />
      )}

      <ChatPresets
        presets={executivePresets}
        title="Quick AI Actions (Executive)"
        gridCols={{ base: 1, md: 2, lg: 4 }}
        variant="card-wrapped"
      />

      <BoardBriefWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        reportMeta={reportMeta}
        setReportMeta={setReportMeta}
        reportItems={reportItems}
      />
    </div>
  );
};
