import React, { useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { useSubscribeStateToAgentContext, useCedarStore } from 'cedar-os';
import { Box, Shield } from 'lucide-react';
import { FeatureNodeData } from '@/components/react-flow/FeatureNode';
import { ScanResultsState } from './scanState';

// [STEP 6]: To automatically make any part of your application state available to AI agents as context,
// We use the subscribeInputContext function. In this example, we subscribe to the selected nodes and specify how we want them to appear in the chat as "selected context".
// We also specify how we want to transform the selected nodes into a format that should be visible to the agent in its context.

export function useRoadmapContext() {
  useSubscribeStateToAgentContext(
    'selectedNodes',
    (nodes: Node<FeatureNodeData>[]) => ({
      selectedFeatures: nodes.map((node) => ({
        id: node.id,
        title: node.data.title,
        description: node.data.description,
        status: node.data.status,
        type: node.data.nodeType,
        upvotes: node.data.upvotes,
        commentCount: node.data.comments?.length || 0,
      })),
    }),
    {
      icon: React.createElement(Box, { size: 16 }),
      color: '#8B5CF6', // Purple color for selected nodes
    },
  );

  useSubscribeStateToAgentContext('nodes', (nodes: Node<FeatureNodeData>[]) => ({
    features: nodes.map((node) => ({
      id: node.id,
      title: node.data.title,
      description: node.data.description,
      status: node.data.status,
      type: node.data.nodeType,
      upvotes: node.data.upvotes,
      commentCount: node.data.comments?.length || 0,
    })),
  }));
}

// Security context hook - subscribes scan SUMMARY to agent context (not all findings)
// Uses addContextEntry directly to prevent duplicate badge issues with useSubscribeStateToAgentContext
export function useSecurityContext() {
  const scanResults = useCedarStore((state) => state.getCedarState('scanResults')) as ScanResultsState | null;
  const addContextEntry = useCedarStore((state) => state.addContextEntry);
  const removeContextEntry = useCedarStore((state) => state.removeContextEntry);
  const hasAddedRef = useRef(false);
  const lastScanIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only update if scan results changed
    const currentScanId = scanResults?.scanId || null;

    // If scan ID changed, remove old entry first
    if (lastScanIdRef.current && lastScanIdRef.current !== currentScanId) {
      removeContextEntry('scanResults', 'scan-summary');
      hasAddedRef.current = false;
    }

    // Skip if no scan results
    if (!scanResults) {
      lastScanIdRef.current = null;
      return;
    }

    // Skip if already added for this scan
    if (hasAddedRef.current && lastScanIdRef.current === currentScanId) {
      return;
    }

    // Include summary AND top findings so agent has actionable context
    // Sort by severity (Critical > High > Medium > Low) and take top 5
    const severityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const topFindings = [...(scanResults.findings || [])]
      .sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4))
      .slice(0, 5)
      .map(f => ({
        id: f.id,
        title: f.summaryHumanReadable || f.owasp,
        severity: f.severity,
        endpoint: f.endpoint,
        method: f.endpoint.method,
        owasp: f.owasp,
        cwe: f.cwe,
        description: f.suggestedFix || '',
        scanners: f.scanners,
      }));

    const contextData = {
      scanId: scanResults.scanId,
      apiBaseUrl: scanResults.apiBaseUrl,
      scanDate: scanResults.scanDate,
      status: scanResults.status,
      summary: {
        total: scanResults.summary.total,
        critical: scanResults.summary.critical,
        high: scanResults.summary.high,
        medium: scanResults.summary.medium,
        low: scanResults.summary.low,
      },
      totalEndpoints: Object.keys(scanResults.groupedByEndpoint).length,
      topFindings,
      message: `Scan ${scanResults.scanId} completed with ${scanResults.summary.total} findings (${scanResults.summary.critical} critical, ${scanResults.summary.high} high).`,
    };

    // Add context entry with fixed ID to prevent duplicates
    addContextEntry('scanResults', {
      id: 'scan-summary',
      source: 'subscription',
      data: contextData,
      metadata: {
        label: 'Scan Summary',
        icon: React.createElement(Shield, { size: 16 }),
        color: '#3B82F6',
        showInChat: true,
      },
    });

    hasAddedRef.current = true;
    lastScanIdRef.current = currentScanId;
  }, [scanResults, addContextEntry, removeContextEntry]);
}
