"use client";

import { useState } from "react";
import { DeveloperView } from "@/components/developer/DeveloperView";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { Code } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function DeveloperPage() {
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  return (
    <ContextBasketProvider>
      {/* Note: Checkbox selection is for UI filtering only.
          Use "Add to Chat" buttons to manually add findings to Cedar context. */}

      <div className="min-h-screen bg-background">
        <PageHeader
          icon={Code}
          title="VentiAPI Developer Dashboard"
          description="Developer View - Fast-Track Vulnerabilities to Safe PRs"
        />

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
