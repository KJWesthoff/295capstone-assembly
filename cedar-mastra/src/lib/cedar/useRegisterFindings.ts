import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRegisterState } from 'cedar-os';
import { useFindingsMentions } from '@/app/cedar-os/mentions';
import type { Finding } from '@/types/finding';

/**
 * Custom hook to register vulnerability findings with Cedar OS
 * Handles state management, Cedar registration, and @mention functionality
 *
 * @param initialFindings - Initial findings data from scanner API
 * @returns findings state and setter
 */
export function useRegisterFindings(initialFindings: Finding[]) {
  const [findings, setFindingsInternal] = useState(initialFindings);
  const prevFindingsRef = useRef<Finding[]>(initialFindings);

  // Create a stable setter function
  const setFindings = useCallback((newFindings: Finding[] | ((prev: Finding[]) => Finding[])) => {
    setFindingsInternal(newFindings);
  }, []);

  // Sync with incoming findings when scan results update
  // Only update if the findings actually changed (by comparing IDs to avoid infinite loops)
  useEffect(() => {
    // Compare by IDs to avoid unnecessary updates when array reference changes but content is the same
    const currentIds = prevFindingsRef.current.map(f => f.id).sort().join(',');
    const newIds = initialFindings.map(f => f.id).sort().join(',');

    if (currentIds !== newIds) {
      prevFindingsRef.current = initialFindings;
      setFindingsInternal(initialFindings);
    }
  }, [initialFindings]);

  // Register findings as Cedar state so they can be @mentioned in chat
  useRegisterState({
    key: 'findings',
    value: findings,
    setValue: setFindings,
    description: 'Vulnerability findings and security issues',
  });

  // Enable @mention functionality for findings
  useFindingsMentions();

  return { findings, setFindings };
}
