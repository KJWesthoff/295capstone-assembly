import { useState } from 'react';
import { useRegisterState } from 'cedar-os';
import { useExecutiveRisksMentions, useExecutiveOwnersMentions } from '@/app/cedar-os/mentions';
import type { ExecutiveRisk, ExecutiveSlaOwner } from '@/app/cedar-os/mentions';

/**
 * Custom hook to register executive data with Cedar OS
 * Handles state management, Cedar registration, and @mention functionality for:
 * - Top business risks (executiveRisks)
 * - SLA ownership metrics (executiveOwners)
 *
 * @param initialRisks - Initial executive risks data computed from scan findings
 * @param initialOwners - Initial SLA ownership data computed from scan findings
 * @returns State objects and setters for risks and owners
 */
export function useRegisterExecutiveData(
  initialRisks: ExecutiveRisk[],
  initialOwners: ExecutiveSlaOwner[]
) {
  const [risks, setRisks] = useState(initialRisks);
  const [owners, setOwners] = useState(initialOwners);

  // Register top risks as Cedar state so they can be @mentioned in chat
  useRegisterState({
    key: 'executiveRisks',
    value: risks,
    setValue: setRisks,
    description: 'Top executive business risks and security exposures',
  });

  // Register SLA owners as Cedar state so they can be @mentioned in chat
  useRegisterState({
    key: 'executiveOwners',
    value: owners,
    setValue: setOwners,
    description: 'Team ownership and SLA compliance metrics',
  });

  // Enable @mention functionality for risks
  useExecutiveRisksMentions();

  // Enable @mention functionality for owners
  useExecutiveOwnersMentions();

  return { risks, setRisks, owners, setOwners };
}
