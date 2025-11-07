"use client";

import { useState } from "react";
import { DeveloperView } from "@/components/developer/DeveloperView";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { Code } from "lucide-react";

export default function DeveloperPage() {
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  return (
    <ContextBasketProvider>
      {/* Note: Checkbox selection is for UI filtering only.
          Use "Add to Chat" buttons to manually add findings to Cedar context. */}

      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded bg-primary flex items-center justify-center">
                  <Code className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-serif font-semibold text-foreground">
                    VentiAPI Developer Dashboard
                  </h1>
                  <p className="text-xs text-muted-foreground font-sans">
                    Developer View - Fast-Track Vulnerabilities to Safe PRs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-12">
          <DeveloperView
            selectedFindings={selectedFindingIds}
            onSelectionChange={setSelectedFindingIds}
          />
        </main>
      </div>
    </ContextBasketProvider>
  );
}
