'use client';

import React, { useState } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MarkdownRenderer from './MarkdownRenderer';

interface EmailDraftWrapperProps {
  content: string;
}

/**
 * Wraps email draft content with a styled card and copy-to-clipboard button.
 * Used when the AI generates an email for the user to send to their developer.
 */
export const EmailDraftWrapper: React.FC<EmailDraftWrapperProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    // Extract plain text from the content (strip markdown formatting for email clients)
    const plainText = content
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic
      .replace(/`(.*?)`/g, '$1')       // Remove inline code
      .replace(/^#+\s*/gm, '')         // Remove headers
      .replace(/^[-*]\s*/gm, '• ')     // Convert list items to bullets
      .trim();

    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card className="w-full border-primary/30 bg-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-primary/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm text-primary">Email Draft</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyEmail}
          className="h-8 gap-2 border-primary/30 hover:bg-primary/20"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy to Clipboard</span>
            </>
          )}
        </Button>
      </div>

      {/* Email Content */}
      <div className="p-4">
        <MarkdownRenderer content={content} />
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-primary/10 bg-muted/30 rounded-b-lg">
        <p className="text-xs text-muted-foreground">
          Click "Copy to Clipboard" to copy this email, then paste it into your email client.
        </p>
      </div>
    </Card>
  );
};

export default EmailDraftWrapper;
