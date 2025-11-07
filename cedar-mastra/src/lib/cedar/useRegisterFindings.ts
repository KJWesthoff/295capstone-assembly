import { useState } from 'react';
import { useRegisterState } from 'cedar-os';
import { useFindingsMentions } from '@/app/cedar-os/mentions';
import type { Finding } from '@/types/finding';

/**
 * Custom hook to register vulnerability findings with Cedar OS
 * Handles state management, Cedar registration, and @mention functionality
 *
 * @param initialFindings - Initial findings data (typically mockFindings)
 * @returns findings state and setter
 */
export function useRegisterFindings(initialFindings: Finding[]) {
  const [findings, setFindings] = useState(initialFindings);

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
