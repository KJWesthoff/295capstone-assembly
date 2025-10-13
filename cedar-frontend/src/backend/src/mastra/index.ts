import { Mastra } from '@mastra/core/mastra';
import { chatWorkflow } from './workflows/chatWorkflow';
import { apiRoutes } from './apiRegistry';
import { productRoadmapAgent } from './agents/productRoadmapAgent';
import { securityAnalystAgent } from './agents/securityAnalystAgent';
import { storage } from './storage';

// Create Mastra instance
export const mastra = new Mastra({
  agents: { productRoadmapAgent, securityAnalystAgent },
  workflows: { chatWorkflow },
  storage,
  telemetry: {
    enabled: true,
  },
  server: {
    apiRoutes,
  },
});
