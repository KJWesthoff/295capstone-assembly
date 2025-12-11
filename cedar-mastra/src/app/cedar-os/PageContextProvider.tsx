'use client';

import { useEffect } from 'react';
import { setCedarState } from 'cedar-os';
import { usePageContext } from './usePageContext';
import { useSecurityContext } from './context';

/**
 * Provider component that:
 * 1. Sets up a userId for conversation memory/threading
 * 2. Subscribes the current page path to Cedar agent context
 * 3. Subscribes scan results to Cedar agent context (centralized to prevent duplicates)
 *
 * This enables:
 * - Multi-turn conversations (agent remembers previous messages)
 * - Page-aware AI responses (different tone for different dashboards)
 * - AI access to scan results across all pages
 */
export function PageContextProvider({ children }: { children: React.ReactNode }) {
  // Initialize userId for conversation threading
  // This enables the backend to store and retrieve conversation history
  useEffect(() => {
    // Generate or retrieve a persistent userId
    // In production, this would come from your auth system
    let userId = localStorage.getItem('cedar-user-id');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('cedar-user-id', userId);
    }

    // Set the userId in Cedar state - this enables conversation memory
    setCedarState('userId', userId);
    console.log('🔑 Cedar userId initialized:', userId);
  }, []);

  // Subscribe the current path to Cedar context
  usePageContext();

  // Subscribe scan results to agent context (centralized here to prevent duplicate badges)
  // This was previously called in multiple view components causing duplicate "Scan Summary" badges
  useSecurityContext();

  return <>{children}</>;
}
