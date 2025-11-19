import React from 'react';
import { Node, Edge } from 'reactflow';
import { getCedarState, useStateBasedMentionProvider } from 'cedar-os';
import { ArrowRight, Box, AlertTriangle, Shield, Users } from 'lucide-react';
import { FeatureNodeData } from '@/components/react-flow/FeatureNode';
import type { Finding } from '@/types/finding';

// Executive data types
export type ExecutiveRisk = {
  id: string;
  title: string;
  systems: string[];
  severity: string;
  exploitPresent: boolean;
  internetFacing: boolean;
  isNewOrRegressed: string;
  recommendedAction: string;
  owner: string;
  eta: string;
  relatedBreachIds: string[];
};

export type ExecutiveSlaOwner = {
  owner: string;
  critOpen: number;
  highOpen: number;
  pastSLA: number;
  dueNext7: number;
};

// [STEP 5]: To enable @ mentions, we use the useStateBasedMentionProvider hook.
// This allows the user to reference any state value from the chat using something like @nodeName
export function useRoadmapMentions() {
  // We use the useStateBasedMentionProvider hook to register a mention provider that references an existing state that we've registered.
  useStateBasedMentionProvider({
    stateKey: 'nodes',
    trigger: '@',
    labelField: (node: Node<FeatureNodeData>) => node.data.title,
    searchFields: ['data.description'], // The field of the state that the user can use to search after the @
    description: 'Product roadmap features and bugs',
    icon: React.createElement(Box, { size: 16 }),
    color: '#3B82F6', // Blue color for features
  });

  const nodes = getCedarState('nodes') as Node<FeatureNodeData>[];

  useStateBasedMentionProvider({
    stateKey: 'edges',
    trigger: '@',
    labelField: (edge: Edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      const sourceTitle = sourceNode?.data.title || edge.source;
      const targetTitle = targetNode?.data.title || edge.target;
      return `${sourceTitle} → ${targetTitle}`;
    },
    description: 'Feature relationships, dependencies, and connections',
    icon: React.createElement(ArrowRight, { size: 16 }),
    color: '#10B981', // Green color for relationships
  });
}

/**
 * Mention provider for vulnerability findings
 * Allows users to @mention findings in chat
 */
export function useFindingsMentions() {
  useStateBasedMentionProvider({
    stateKey: 'findings',
    trigger: '@',
    labelField: (finding: Finding) =>
      `${finding.severity}: ${finding.endpoint.method} ${finding.endpoint.path}`,
    searchFields: ['summaryHumanReadable', 'owasp', 'cwe'], // Search by description, OWASP, or CWE
    description: 'Vulnerability findings and security issues',
    icon: React.createElement(AlertTriangle, { size: 16 }),
    color: (finding: Finding) => {
      // Dynamic color based on severity
      switch (finding.severity) {
        case 'Critical':
          return '#dc2626';
        case 'High':
          return '#ea580c';
        case 'Medium':
          return '#ca8a04';
        default:
          return '#16a34a'; // Low
      }
    },
  });
}

/**
 * Mention provider for executive top risks
 * Allows executives to @mention high-level business risks in chat
 */
export function useExecutiveRisksMentions() {
  useStateBasedMentionProvider({
    stateKey: 'executiveRisks',
    trigger: '@',
    labelField: (risk: ExecutiveRisk) => `${risk.severity}: ${risk.title}`,
    searchFields: ['title', 'systems', 'recommendedAction', 'owner'],
    description: 'Top executive business risks and security exposures',
    icon: React.createElement(Shield, { size: 16 }),
    color: (risk: ExecutiveRisk) => {
      // Dynamic color based on severity
      switch (risk.severity) {
        case 'Critical':
          return '#dc2626';
        case 'High':
          return '#ea580c';
        case 'Medium':
          return '#ca8a04';
        default:
          return '#16a34a'; // Low
      }
    },
  });
}

/**
 * Mention provider for executive SLA ownership data
 * Allows executives to @mention team ownership and SLA compliance in chat
 */
export function useExecutiveOwnersMentions() {
  useStateBasedMentionProvider({
    stateKey: 'executiveOwners',
    trigger: '@',
    labelField: (owner: ExecutiveSlaOwner) =>
      `${owner.owner} (${owner.critOpen} crit, ${owner.highOpen} high, ${owner.pastSLA} past SLA)`,
    searchFields: ['owner'],
    description: 'Team ownership and SLA compliance metrics',
    icon: React.createElement(Users, { size: 16 }),
    color: (owner: ExecutiveSlaOwner) => {
      // Color based on SLA compliance health
      if (owner.pastSLA > 2) return '#dc2626'; // Red for poor SLA compliance
      if (owner.pastSLA > 0 || owner.critOpen > 0) return '#ea580c'; // Orange for some issues
      return '#16a34a'; // Green for good compliance
    },
  });
}
