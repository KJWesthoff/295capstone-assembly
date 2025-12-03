import { Mastra } from '@mastra/core/mastra';
import { chatWorkflow } from './workflows/chatWorkflow';
import { databaseQueryWorkflow } from './workflows/database-query-workflow';
import { scanAnalysisWorkflow } from './workflows/scan-analysis-workflow';
import { apiRoutes } from './apiRegistry';
import { productRoadmapAgent } from './agents/productRoadmapAgent';
import { securityAnalystAgent } from './agents/securityAnalystAgent';
import { storage } from './storage';

// Import all tools
import { analyzeScanTool } from './tools/analyze-scan-tool';
import { cveAnalysisTool } from './tools/cve-analysis-tool';
import { databaseIntrospectionTool } from './tools/database-introspection-tool';
import { databaseSeedingTool } from './tools/database-seeding-tool';
import { getSecurityIntelligenceTool } from './tools/get-security-intelligence';
import { remediationPrioritizationTool } from './tools/remediation-prioritization-tool';
import { sqlExecutionTool } from './tools/sql-execution-tool';
import { sqlGenerationTool } from './tools/sql-generation-tool';
import { roadmapTools } from './tools/roadmapTool';
import { visualizeAttackPathTool } from './tools/visualize-attack-path-tool';

// Create Mastra instance
export const mastra = new Mastra({
  agents: { productRoadmapAgent, securityAnalystAgent },
  workflows: {
    chatWorkflow,
    databaseQueryWorkflow,
    scanAnalysisWorkflow
  },
  storage,
  // Enable AI tracing (specialized for AI operations like agents, LLM calls, tools)
  observability: {
    default: { enabled: true },
  },
  // Disable deprecated OTEL telemetry (use AI tracing instead)
  telemetry: {
    enabled: false,
  },
  server: {
    apiRoutes,
  },
});

// Export tools for direct access if needed
export const tools = {
  analyzeScanTool,
  cveAnalysisTool,
  databaseIntrospectionTool,
  databaseSeedingTool,
  getSecurityIntelligenceTool,
  remediationPrioritizationTool,
  sqlExecutionTool,
  sqlGenerationTool,
  visualizeAttackPathTool,
  ...roadmapTools   // Spread the roadmap tools collection
};
