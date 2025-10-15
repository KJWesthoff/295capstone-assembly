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

// Security context hook - subscribes scan SUMMARY to agent context (not all findings)
export function useSecurityContext() {
  // Subscribe only the scan summary to agent context by default
  // This provides a better UX - users can then add specific findings as needed
  useSubscribeStateToAgentContext(
    'scanResults',
    (scanResults: ScanResultsState | null) => {
      if (!scanResults) {
        return { message: 'No scan results available yet.' };
      }

      // Only include summary information by default, not all findings
      // Users can manually add specific findings they want to discuss
      return {
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
        // Note: We're NOT including the full findings array here
        // Users can add specific findings using the "+" button
        message: `Scan ${scanResults.scanId} completed with ${scanResults.summary.total} findings. Use the + buttons to add specific vulnerabilities to discuss.`,
      };
    },
    {
      icon: React.createElement(Shield, { size: 16 }),
      color: '#3B82F6', // Blue color for scan summary (less alarming than red)
      labelField: () => 'Scan Summary', // Custom label for the context badge
    },
  );
}
