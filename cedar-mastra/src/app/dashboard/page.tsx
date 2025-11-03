"use client";

import { SecurityAnalystView } from "@/components/analyst/SecurityAnalystView";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { Shield } from "lucide-react";

export default function DashboardPage() {
  return (
    <ContextBasketProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded bg-primary flex items-center justify-center">
                  <Shield className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-serif font-semibold text-foreground">
                    VentiAPI Security Dashboard
                  </h1>
                  <p className="text-xs text-muted-foreground font-sans">
                    Security Analyst View - Vulnerability Analysis & Remediation
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-12">
          <SecurityAnalystView />
        </main>
      </div>
    </ContextBasketProvider>
  );
}
