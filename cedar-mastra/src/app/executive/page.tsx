"use client";

import { ExecutiveView } from "@/components/executive/ExecutiveView";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function ExecutivePage() {
  return (
    <ContextBasketProvider>
      {/* Note: Use "Add to Chat" buttons to manually add executive data to Cedar context. */}

      <div className="min-h-screen bg-background">
        <PageHeader
          icon={TrendingUp}
          title="VentiAPI Executive Dashboard"
          description="Executive View - Risk & Compliance Overview"
        />

        <main className="container mx-auto px-6 py-12">
          <ExecutiveView />
        </main>
      </div>
    </ContextBasketProvider>
  );
}
