'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCedarStore } from 'cedar-os';

/**
 * Page context types for different dashboard views
 * Maps to user roles: executive, security (analyst), developer
 */
export type PageContextType = 'executive' | 'security-analyst' | 'developer' | 'home' | 'other';

/**
 * Human-readable role descriptions for the AI agent
 */
const PAGE_CONTEXT_DESCRIPTIONS: Record<PageContextType, string> = {
  'executive': 'Executive Briefing - User is a C-suite executive or manager viewing KPIs, risk trends, and remediation commitments. Communicate at a high level with business impact focus.',
  'security-analyst': 'Security Analyst Dashboard - User is a security professional analyzing detailed findings, compliance data, and threat intelligence. Provide technical depth and actionable insights.',
  'developer': 'Developer Remediation View - User is a developer fixing vulnerabilities. Provide specific code examples, PR-ready fixes, and implementation guidance.',
  'home': 'Home Page - User is on the landing page. Help them understand the platform and select their role.',
  'other': 'General Page - Provide helpful assistance based on context.',
};

/**
 * Short labels for each page context type (shown in chat badge)
 */
const PAGE_CONTEXT_LABELS: Record<PageContextType, string> = {
  'executive': 'Executive View',
  'security-analyst': 'Security Analyst',
  'developer': 'Developer View',
  'home': 'Home',
  'other': 'Other',
};

/**
 * Derives the page context type from a pathname
 */
export function getPageContextType(pathname: string): PageContextType {
  if (pathname.startsWith('/executive')) return 'executive';
  if (pathname.startsWith('/dashboard')) return 'security-analyst';  // /dashboard is the Security Analyst view
  if (pathname.startsWith('/developer')) return 'developer';
  if (pathname === '/' || pathname === '/home') return 'home';
  return 'other';
}

/**
 * Gets the description for a page context type
 */
export function getPageContextDescription(pageType: PageContextType): string {
  return PAGE_CONTEXT_DESCRIPTIONS[pageType];
}

/**
 * Hook to subscribe the current page path to Cedar agent context.
 * This allows the AI agent to adapt its communication style based on the user's current view.
 *
 * Usage: Call this hook once at the layout level (e.g., in layout.tsx or a global component)
 */
export function usePageContext() {
  const pathname = usePathname();
  const addContextEntry = useCedarStore((state) => state.addContextEntry);
  const removeContextEntry = useCedarStore((state) => state.removeContextEntry);
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const pageContextType = getPageContextType(pathname);

    // Remove old page context if path changed
    if (lastPathRef.current && lastPathRef.current !== pathname) {
      removeContextEntry('current-page', 'current-page');
    }

    // Add the current path and context type to Cedar's additionalContext
    // This will be automatically included when messages are sent to the backend
    addContextEntry('current-page', {
      id: 'current-page',
      source: 'subscription',
      data: {
        pathname,
        pageType: pageContextType,
        roleDescription: PAGE_CONTEXT_DESCRIPTIONS[pageContextType],
        timestamp: new Date().toISOString(),
      },
      metadata: {
        label: PAGE_CONTEXT_LABELS[pageContextType],
        icon: '📍',
        color: '#6366F1', // Indigo for navigation context
        showInChat: true,
      },
    });

    lastPathRef.current = pathname;
  }, [pathname, addContextEntry, removeContextEntry]);

  return {
    pathname,
    pageType: pathname ? getPageContextType(pathname) : 'other',
  };
}
