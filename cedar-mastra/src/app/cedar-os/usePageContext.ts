'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCedarStore } from 'cedar-os';

/**
 * Page context types for different dashboard views
 */
export type PageContextType = 'executive' | 'analyst' | 'developer' | 'home' | 'other';

/**
 * Derives the page context type from a pathname
 */
export function getPageContextType(pathname: string): PageContextType {
  if (pathname.startsWith('/executive')) return 'executive';
  if (pathname.startsWith('/analyst')) return 'analyst';
  if (pathname.startsWith('/developer')) return 'developer';
  if (pathname === '/' || pathname === '/home') return 'home';
  return 'other';
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
      removeContextEntry('pageContext', 'current-page');
    }

    // Add the current path and context type to Cedar's additionalContext
    // This will be automatically included when messages are sent to the backend
    addContextEntry('pageContext', {
      id: 'current-page',
      label: `Viewing: ${pageContextType}`,
      data: {
        pathname,
        pageType: pageContextType,
        timestamp: new Date().toISOString(),
      },
    });

    lastPathRef.current = pathname;
  }, [pathname, addContextEntry, removeContextEntry]);

  return {
    pathname,
    pageType: pathname ? getPageContextType(pathname) : 'other',
  };
}
