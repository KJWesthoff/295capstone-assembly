'use client';
import { useEffect, useState } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { CedarCopilot, ProviderConfig } from 'cedar-os';
import { FloatingCedarChat } from '@/app/cedar-os/components/chatComponents/FloatingCedarChat';
import { DebuggerPanel } from '@/app/cedar-os/components/debugger/DebuggerPanel';
import { GlobalSpells } from '@/components/shared/GlobalSpells';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Berkeley Mono font family
const berkeleyMono = localFont({
  src: [
    {
      path: '../fonts/BerkeleyMono-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/BerkeleyMono-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/BerkeleyMono-Oblique.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/BerkeleyMono-Bold-Oblique.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-berkeley-mono',
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const llmProvider: ProviderConfig = {
    provider: 'mastra' as const,
    baseURL: process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111',
  };

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${berkeleyMono.variable} antialiased`}>
        {/* [STEP 1]: We register the main CedarCopilot wrapper at the root of the app with a Mastra provider. */}
        <CedarCopilot llmProvider={llmProvider}>
          {children}
          {/* Floating Cedar Chat - Available on all pages (only render after mount to prevent hydration errors) */}
          {mounted && (
            <>
              <FloatingCedarChat
                side="right"
                title="Agent"
                collapsedLabel="Ask me anything..."
              />
              <DebuggerPanel />
              <GlobalSpells />
            </>
          )}
        </CedarCopilot>
      </body>
    </html>
  );
}
