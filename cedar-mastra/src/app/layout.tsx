'use client';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { CedarCopilot, ProviderConfig } from 'cedar-os';
import { FloatingCedarChat } from '@/app/cedar-os/components/chatComponents/FloatingCedarChat';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const llmProvider: ProviderConfig = {
    provider: 'mastra' as const,
    baseURL: process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111',
  };

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* [STEP 1]: We register the main CedarCopilot wrapper at the root of the app with a Mastra provider. */}
        <CedarCopilot llmProvider={llmProvider}>
          {children}
          {/* Floating Cedar Chat - Available on all pages */}
          <FloatingCedarChat
            side="right"
            title="🤖 VentiAPI Assistant"
            collapsedLabel="💬 Ask me anything..."
          />
        </CedarCopilot>
      </body>
    </html>
  );
}
