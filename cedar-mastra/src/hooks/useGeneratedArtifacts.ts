'use client';

import { useState, useCallback } from 'react';
import type { Finding } from '@/types/finding';

/**
 * Generated unit tests structure
 */
export interface GeneratedUnitTests {
  code: string;
  language: string;
  framework: string;
  testCases: Array<{
    name: string;
    purpose: string;
  }>;
  runCommand: string;
}

/**
 * Generated integration tests structure
 */
export interface GeneratedIntegrationTests {
  code: string;
  language: string;
  framework: string;
  testCases: Array<{
    name: string;
    purpose: string;
  }>;
  runCommand: string;
  dependencies?: string[];
}

/**
 * Generated PR metadata structure
 */
export interface GeneratedPullRequest {
  branchName: string;
  commitMessage: string;
  title: string;
  body: string;
  labels: string[];
  reviewChecklist: string[];
}

/**
 * Complete generated artifacts response
 */
export interface GeneratedArtifacts {
  unitTests: GeneratedUnitTests;
  integrationTests: GeneratedIntegrationTests;
  pullRequest: GeneratedPullRequest;
  metadata: {
    generatedAt: string;
    modelUsed: string;
    fixLanguage: string;
    cweAddressed: string[];
    confidenceScore: number;
  };
}

/**
 * Code fix context required for generation
 */
export interface CodeFixContext {
  vulnerableCode: string;
  fixedCode: string;
  language: string;
  file?: string;
  line?: number;
}

export interface UseGeneratedArtifactsResult {
  artifacts: GeneratedArtifacts | null;
  isLoading: boolean;
  error: string | null;
  generate: (finding: Finding, codeFix: CodeFixContext, hotPatch?: string) => Promise<void>;
  clear: () => void;
}

/**
 * Hook to generate developer artifacts (tests, PR) from code fix context
 *
 * Only triggers when there's a real code fix available (not hardcoded fallback).
 * Uses the Mastra backend to generate contextual tests and PR metadata.
 */
export function useGeneratedArtifacts(): UseGeneratedArtifactsResult {
  const [artifacts, setArtifacts] = useState<GeneratedArtifacts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    finding: Finding,
    codeFix: CodeFixContext,
    hotPatch?: string
  ) => {
    // Validate we have a real code fix
    if (!codeFix.vulnerableCode || !codeFix.fixedCode) {
      setError('No code fix available to generate artifacts from');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get Mastra URL from environment or default
      const mastraUrl = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111';

      const response = await fetch(`${mastraUrl}/developer/generate-artifacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finding: {
            id: finding.id,
            owasp: finding.owasp,
            cwe: finding.cwe,
            cve: finding.cve,
            severity: finding.severity,
            endpoint: finding.endpoint,
            repo: finding.repo,
            file: finding.file,
            language: finding.language,
            framework: finding.framework,
            nistCsf: finding.nistCsf,
            nist80053: finding.nist80053,
          },
          codeFix: {
            vulnerableCode: codeFix.vulnerableCode,
            fixedCode: codeFix.fixedCode,
            language: codeFix.language,
            file: codeFix.file,
            line: codeFix.line,
          },
          hotPatch,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate artifacts: ${response.status}`);
      }

      const result = await response.json();
      setArtifacts(result);
    } catch (err: any) {
      console.error('Error generating developer artifacts:', err);
      setError(err.message || 'Failed to generate artifacts');
      setArtifacts(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setArtifacts(null);
    setError(null);
  }, []);

  return {
    artifacts,
    isLoading,
    error,
    generate,
    clear,
  };
}

/**
 * Utility to check if a finding has a real code fix available
 * (not just hardcoded fallback)
 */
export function hasCodeFix(finding: Finding): boolean {
  const evidence = finding.evidence;
  return !!(
    evidence?.vulnerable_code?.snippet &&
    evidence?.fix_code?.snippet
  );
}

/**
 * Extract code fix context from a finding
 */
export function extractCodeFix(finding: Finding): CodeFixContext | null {
  const evidence = finding.evidence;

  if (!evidence?.vulnerable_code?.snippet || !evidence?.fix_code?.snippet) {
    return null;
  }

  return {
    vulnerableCode: evidence.vulnerable_code.snippet,
    fixedCode: evidence.fix_code.snippet,
    language: evidence.fix_code.language || evidence.vulnerable_code.language || 'unknown',
    file: evidence.vulnerable_code.file,
    line: evidence.vulnerable_code.line,
  };
}
