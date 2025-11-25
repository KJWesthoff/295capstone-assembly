"use client";

import { useState } from "react";
import { SecurityAnalystView } from "@/components/analyst/SecurityAnalystView";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { Shield } from "lucide-react";
import { useScanResultsState } from "@/app/cedar-os/scanState";
import { useCedarStore } from "cedar-os";
import { PageHeader } from "@/components/shared/PageHeader";

export default function DashboardPage() {
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());
  const { scanResults } = useScanResultsState();
  const addContextEntry = useCedarStore(s => s.addContextEntry);

  return (
    <ContextBasketProvider>
      {/* Note: Checkbox selection is for UI filtering only.
          Use "Add to Chat" buttons to manually add findings to Cedar context. */}

      <div className="min-h-screen bg-background">
        <PageHeader
          icon={Shield}
          title="VentiAPI Security Dashboard"
          description="Security Analyst View - Vulnerability Analysis & Remediation"
        />

        <main className="container mx-auto px-6 py-12">
          {/* Scan ID Section */}
          {scanResults?.scanId && (
            <div className="mb-6 p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Scan ID</div>
                  <div className="font-mono text-sm text-foreground flex items-center gap-2">
                    {scanResults.scanId}
                    <button
                      onClick={() => navigator.clipboard.writeText(scanResults.scanId)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Scan ID"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    addContextEntry(`scan-id-${scanResults.scanId}`, {
                      id: `scan-id-${scanResults.scanId}`,
                      source: 'manual',
                      data: { scanId: scanResults.scanId },
                      metadata: {
                        label: `🔍 Scan ${scanResults.scanId.slice(0, 8)}...`,
                        icon: '🔍',
                        color: 'hsl(210 100% 19%)', // UC Berkeley Blue from brand colors
                        showInChat: true,
                      },
                    });
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-md transition-colors"
                  title="Add Scan ID to Cedar Context"
                >
                  + Add to Context
                </button>
              </div>
            </div>
          )}

          <SecurityAnalystView
            selectedFindings={selectedFindingIds}
            onSelectionChange={setSelectedFindingIds}
          />
        </main>
      </div>
    </ContextBasketProvider>
  );
}
