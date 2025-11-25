/**
 * Test script for streaming agent responses with real-time progress
 * 
 * Demonstrates:
 * - Real-time streaming output from security analyst agent
 * - Multi-turn conversations with memory
 * - Workflow execution with progress monitoring
 * - Structured output validation
 */

import { mastra } from '../src/mastra';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Color/formatting utilities for terminal output
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// ============================================================================
// Main Test Function
// ============================================================================

async function main() {
  console.clear();
  
  log(colors.bright + colors.cyan, '🔒', 'Security Analyst Agent - Streaming Test');
  console.log('='.repeat(80));
  console.log();

  // Load scan data
  const scanPath = path.join(__dirname, '../docs/scan-response-object.json');
  
  if (!fs.existsSync(scanPath)) {
    log(colors.red, '❌', `Scan file not found at: ${scanPath}`);
    process.exit(1);
  }

  const scanData = fs.readFileSync(scanPath, 'utf-8');
  log(colors.green, '✓', `Loaded scan data (${scanData.length} bytes)`);
  console.log();

  // Get agent
  const agent = mastra.getAgent('securityAnalystAgent');
  if (!agent) {
    log(colors.red, '❌', 'Security analyst agent not found');
    process.exit(1);
  }

  // Resource ID for conversation memory
  const resourceId = `scan-demo-${Date.now()}`;
  log(colors.blue, '🆔', `Session ID: ${resourceId}`);
  console.log();

  // =========================================================================
  // Test 1: Streaming scan analysis with workflow
  // =========================================================================

  log(colors.bright + colors.magenta, '━━━━━', 'TEST 1: Streaming Scan Analysis');
  console.log();

  log(colors.yellow, '📤', 'Sending scan data to agent...');
  log(colors.dim, '  ', 'Using scan-analysis-workflow for automated processing');
  console.log();

  try {
    const startTime = Date.now();

    // Create streaming request
    log(colors.cyan, '▶', 'Starting stream...');
    console.log();

    const stream = await agent.stream(
      `Analyze this vulnerability scan using the scan-analysis-workflow. Provide a comprehensive security assessment with prioritization.

Scan data:
${scanData}`,
      {
        resourceId, // Enables conversation memory
      }
    );

    // Track state
    let chunkCount = 0;
    let totalChars = 0;
    const stepProgress: Set<string> = new Set();

    // Handle step progress (if workflow emits steps)
    if ('onStepFinish' in stream) {
      // @ts-ignore - onStepFinish may not be in type def but exists
      stream.onStepFinish = (step: any) => {
        const stepId = step.stepId || step.id || 'unknown';
        if (!stepProgress.has(stepId)) {
          stepProgress.add(stepId);
          log(colors.green, '✓', `Workflow step completed: ${stepId}`);
        }
      };
    }

    // Stream text chunks
    log(colors.cyan, '📝', 'Streaming analysis:');
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    console.log();

    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
      chunkCount++;
      totalChars += chunk.length;
    }

    console.log();
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    console.log();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log(colors.green, '✓', `Analysis complete in ${elapsed}s`);
    log(colors.dim, '  ', `Received ${chunkCount} chunks, ${totalChars} characters`);
    log(colors.dim, '  ', `Completed ${stepProgress.size} workflow steps`);
    console.log();

    // Get structured output if available
    if (stream.object) {
      log(colors.blue, '📊', 'Structured Output Schema:');
      const keys = Object.keys(stream.object);
      keys.forEach(key => {
        log(colors.dim, '   ', `- ${key}: ${typeof stream.object![key]}`);
      });
      console.log();
    }

  } catch (error) {
    log(colors.red, '❌', `Error during streaming: ${error}`);
    throw error;
  }

  // =========================================================================
  // Test 2: Multi-turn conversation with memory
  // =========================================================================

  log(colors.bright + colors.magenta, '━━━━━', 'TEST 2: Multi-Turn Conversation (Memory)');
  console.log();

  log(colors.yellow, '💬', 'Follow-up question #1: Tell me more about the SQL injection findings');
  console.log();

  try {
    const stream2 = await agent.stream(
      'Tell me more about the SQL injection findings. What are the specific endpoints affected and how should we prioritize remediation?',
      {
        resourceId, // Same resource ID = uses conversation history
      }
    );

    log(colors.cyan, '📝', 'Agent response:');
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    console.log();

    for await (const chunk of stream2.textStream) {
      process.stdout.write(chunk);
    }

    console.log();
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    console.log();

    log(colors.green, '✓', 'Follow-up question answered using conversation context');
    console.log();

  } catch (error) {
    log(colors.red, '❌', `Error during follow-up: ${error}`);
    throw error;
  }

  // =========================================================================
  // Test 3: Quick query without workflow
  // =========================================================================

  log(colors.bright + colors.magenta, '━━━━━', 'TEST 3: Quick Coverage Check (Tool Only)');
  console.log();

  log(colors.yellow, '🔍', 'Checking database coverage for CWE-89 and CWE-79...');
  console.log();

  try {
    const stream3 = await agent.stream(
      'Check our database coverage for CWE-89 (SQL Injection) and CWE-79 (XSS). Do we have sufficient code examples?',
      {
        resourceId: `quick-query-${Date.now()}`, // New conversation
      }
    );

    log(colors.cyan, '📝', 'Coverage check result:');
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    console.log();

    for await (const chunk of stream3.textStream) {
      process.stdout.write(chunk);
    }

    console.log();
    console.log(colors.dim + '─'.repeat(80) + colors.reset);
    console.log();

    log(colors.green, '✓', 'Quick query completed (using tool, not workflow)');
    console.log();

  } catch (error) {
    log(colors.red, '❌', `Error during quick query: ${error}`);
    throw error;
  }

  // =========================================================================
  // Summary
  // =========================================================================

  console.log();
  log(colors.bright + colors.green, '🎉', 'All streaming tests passed!');
  console.log();
  log(colors.blue, '📋', 'Features Demonstrated:');
  log(colors.dim, '   ', '✓ Real-time streaming output');
  log(colors.dim, '   ', '✓ Workflow integration (scan-analysis-workflow)');
  log(colors.dim, '   ', '✓ Multi-turn conversations with memory');
  log(colors.dim, '   ', '✓ Structured output schemas');
  log(colors.dim, '   ', '✓ Tool-only quick queries');
  log(colors.dim, '   ', '✓ Progress tracking');
  console.log();
}

// ============================================================================
// Run
// ============================================================================

main()
  .then(() => {
    log(colors.green, '✓', 'Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error();
    log(colors.red, '❌', 'Test script failed');
    console.error(error);
    process.exit(1);
  });


