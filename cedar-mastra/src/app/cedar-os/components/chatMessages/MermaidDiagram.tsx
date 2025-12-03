'use client';

import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize mermaid with dark theme
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
      themeVariables: {
        primaryColor: '#3B82F6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#60A5FA',
        lineColor: '#60A5FA',
        secondaryColor: '#1F2937',
        tertiaryColor: '#374151',
        background: '#111827',
        mainBkg: '#1F2937',
        secondBkg: '#374151',
        tertiaryBkg: '#4B5563',
        textColor: '#E5E7EB',
        border1: '#4B5563',
        border2: '#6B7280',
        fontSize: '16px',
      },
    });

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className={`bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-4 my-4 ${className}`}>
        <div className="text-red-400 font-semibold mb-2">Failed to render diagram</div>
        <pre className="text-red-300 text-sm overflow-x-auto">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div className={`my-4 ${className}`}>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
            title="Open attack path diagram"
          >
            <Maximize2 className="w-5 h-5" />
            <span>View Attack Path Diagram</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[calc(100vh-2rem)] min-w-[calc(100vw-2rem)] flex-col justify-between gap-0 p-0 bg-gray-900 border-gray-700">
          <ScrollArea className="flex flex-col justify-between overflow-hidden flex-1">
            <DialogHeader className="contents space-y-0 text-left">
              <DialogTitle className="px-6 pt-6 text-white">Attack Path Diagram</DialogTitle>
              <DialogDescription asChild>
                <div className="p-6 flex-1">
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
              </DialogDescription>
            </DialogHeader>
          </ScrollArea>
          <DialogFooter className="px-6 pb-6 sm:justify-end border-t border-gray-700 pt-4">
            <DialogClose asChild>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MermaidDiagram;
