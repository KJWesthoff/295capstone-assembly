import React from 'react';
import { Node } from 'reactflow';
import { useSubscribeStateToAgentContext } from 'cedar-os';
import { Box, Shield } from 'lucide-react';
import { FeatureNodeData } from '@/components/react-flow/FeatureNode';
import { ScanResultsState, VulnerabilityFinding } from './scanState';

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

// Security context hook - subscribes scan results to agent context
export function useSecurityContext() {
  // Subscribe scan results to agent context
  useSubscribeStateToAgentContext(
    'scanResults',
    (scanResults: ScanResultsState | null) => {
      if (!scanResults) {
        return { message: 'No scan results available yet.' };
      }

      return {
        scanId: scanResults.scanId,
        apiBaseUrl: scanResults.apiBaseUrl,
        scanDate: scanResults.scanDate,
        status: scanResults.status,
        summary: scanResults.summary,
        totalEndpoints: Object.keys(scanResults.groupedByEndpoint).length,
        findings: scanResults.findings.map((finding: VulnerabilityFinding) => ({
          id: finding.id,
          severity: finding.severity,
          title: finding.title,
          rule: finding.rule,
          endpoint: finding.endpoint,
          method: finding.method,
          description: finding.description,
          scanner: finding.scanner,
          score: finding.score,
          evidence: finding.evidence,
        })),
      };
    },
    {
      icon: React.createElement(Shield, { size: 16 }),
      color: '#EF4444', // Red color for security findings
    },
  );
}
