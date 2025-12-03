'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mermaid from 'mermaid';
import { FloatingContainer } from '../structural/FloatingContainer';
import { Maximize2, X } from 'lucide-react';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);

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
    <>
      {/* Button to open diagram in floating window */}
      <div className={`my-4 ${className}`}>
        <button
          onClick={() => setIsFloatingOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm hover:shadow-md w-full sm:w-auto justify-center"
          title="Open attack path diagram"
        >
          <Maximize2 className="w-5 h-5" />
          <span>View Attack Path Diagram</span>
        </button>
      </div>

      {/* Floating window - rendered at body level using portal */}
      {typeof document !== 'undefined' && createPortal(
        <FloatingContainer
          isActive={isFloatingOpen}
          position="bottom-right"
          dimensions={{
            width: 800,
            height: 600,
            minWidth: 400,
            minHeight: 300,
            maxWidth: 1200,
            maxHeight: 900,
          }}
          resizable={true}
        >
          <div className="w-full h-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                Attack Path Diagram
              </h3>
              <button
                onClick={() => setIsFloatingOpen(false)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                title="Close window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagram content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-900">
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          </div>
        </FloatingContainer>,
        document.body
      )}
    </>
  );
};

export default MermaidDiagram;
