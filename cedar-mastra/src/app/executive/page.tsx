"use client";

import { ExecutiveView } from "@/components/executive/ExecutiveView";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { TrendingUp } from "lucide-react";

export default function ExecutivePage() {
  return (
    <ContextBasketProvider>
      {/* Note: Use "Add to Chat" buttons to manually add executive data to Cedar context. */}

      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded bg-primary flex items-center justify-center">
                  <TrendingUp className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-serif font-semibold text-foreground">
                    VentiAPI Executive Dashboard
                  </h1>
                  <p className="text-xs text-muted-foreground font-sans">
                    Executive View - Risk & Compliance Overview
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-12">
          <ExecutiveView />
        </main>
      </div>
    </ContextBasketProvider>
  );
}
