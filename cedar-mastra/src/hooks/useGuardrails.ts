'use client';

import { useState, useCallback } from 'react';

export interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  language: string;
  pattern?: string;
  fix?: string;
  cwe: string[];
  owasp: string[];
  references: string[];
  sourceUrl: string;
  ruleYaml: string;
  confidence?: string;
  impact?: string;
}

// Guardrails grouped by CWE
export interface GuardrailsByCwe {
  cwe: string;
  rules: GuardrailRule[];
  note?: string; // Explanation for why no rules found
}

export interface UseGuardrailsResult {
  guardrailsByCwe: GuardrailsByCwe[];
  isLoading: boolean;
  error: string | null;
  fetchForAllCwes: (cweIds: string[], language: string) => Promise<void>;
  clear: () => void;
}

// CWEs that are API-architecture issues (not code patterns)
// Semgrep can't detect these because they're design flaws, not code patterns
const API_ARCHITECTURE_CWES: Record<string, string> = {
  'CWE-639': 'BOLA is an API design issue - authorization checks must be implemented at the application logic level, not detectable by code patterns',
  'CWE-285': 'BFLA is an API design issue - function-level authorization is architecture-dependent',
  'CWE-862': 'Missing authorization is context-dependent - Semgrep may find decorator patterns but not missing checks',
  'CWE-770': 'Rate limiting is infrastructure-level - typically implemented via API gateway or middleware',
  'CWE-915': 'Mass assignment patterns vary by framework - limited Semgrep coverage',
  'CWE-1059': 'API inventory management is a documentation/governance issue',
  'CWE-778': 'Insufficient logging is context-dependent - hard to detect missing logs',
};

// Common languages for the dropdown
export const SUPPORTED_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'csharp', label: 'C#' },
  { value: 'rust', label: 'Rust' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'swift', label: 'Swift' },
  { value: 'scala', label: 'Scala' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
] as const;

/**
 * Hook to fetch Semgrep guardrail rules for multiple CWEs
 * Fetches one rule per CWE to be respectful to Semgrep API
 */
export function useGuardrails(): UseGuardrailsResult {
  const [guardrailsByCwe, setGuardrailsByCwe] = useState<GuardrailsByCwe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForAllCwes = useCallback(async (cweIds: string[], language: string) => {
    if (!cweIds || cweIds.length === 0 || !language) {
      setError('Please select a language');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch one rule per CWE (limit=1) to reduce API calls
      const results: GuardrailsByCwe[] = [];

      for (const cwe of cweIds) {
        const normalizedCwe = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;

        const params = new URLSearchParams({
          cwe,
          language,
          limit: '1', // One rule per CWE
        });

        const response = await fetch(`/api/guardrails?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();
          const rules = data.guardrails || [];

          // Add explanatory note for API-architecture CWEs with no rules
          const note = rules.length === 0 && API_ARCHITECTURE_CWES[normalizedCwe]
            ? API_ARCHITECTURE_CWES[normalizedCwe]
            : undefined;

          results.push({
            cwe,
            rules,
            note,
          });
        } else {
          results.push({
            cwe,
            rules: [],
            note: API_ARCHITECTURE_CWES[cwe.toUpperCase()],
          });
        }
      }

      setGuardrailsByCwe(results);

      const totalRules = results.reduce((sum, r) => sum + r.rules.length, 0);
      const hasApiCwes = cweIds.some(cwe => {
        const normalized = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;
        return API_ARCHITECTURE_CWES[normalized];
      });

      if (totalRules === 0) {
        if (hasApiCwes) {
          setError(`These vulnerabilities are API-level design issues. Semgrep detects code patterns (like SQL injection, XSS) but not architectural flaws like BOLA/BFLA.`);
        } else {
          setError(`No Semgrep rules found for ${cweIds.join(', ')} in ${language}`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching guardrails:', err);
      setError(err.message || 'Failed to fetch guardrails');
      setGuardrailsByCwe([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setGuardrailsByCwe([]);
    setError(null);
  }, []);

  return {
    guardrailsByCwe,
    isLoading,
    error,
    fetchForAllCwes,
    clear,
  };
}
