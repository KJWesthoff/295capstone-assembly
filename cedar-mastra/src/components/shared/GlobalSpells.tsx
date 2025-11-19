"use client";

import React from "react";
// import RadialMenuSpell from "@/app/cedar-os/components/spells/RadialMenuSpell";
// import { ActivationMode, Hotkey } from "cedar-os";
// import { Sparkles, Copy, Search, Wrench, XCircle, FileText, Shield, TrendingDown } from "lucide-react";
// import { useCedarStore } from "cedar-os";
// import { useCedarActions } from "@/lib/cedar/hooks";
// import { toast } from "sonner";

/**
 * Global spell instances that are available throughout the application
 * These provide context menus and keyboard shortcuts for common actions
 *
 * NOTE: Right-click spell disabled due to performance issues
 */
export const GlobalSpells: React.FC = React.memo(() => {
  // Disabled - causing infinite render loop
  // const { sendMessage } = useCedarActions();
  // const store = useCedarStore();

  // Get the selected finding from Cedar state (if available)
  // const getSelectedFinding = () => {
  //   // Check if there's a finding in the Cedar context
  //   const context = store.getState().activeCedarContext;
  //   if (context) {
  //     // Try to find a finding in the context
  //     const findingKey = Object.keys(context).find(key => key.startsWith('finding-'));
  //     if (findingKey) {
  //       try {
  //         return JSON.parse(context[findingKey]);
  //       } catch (e) {
  //         console.error('Failed to parse finding from context:', e);
  //       }
  //     }
  //   }
  //   return null;
  // };

  return (
    <>
      {/* Radial Menu for Vulnerability Findings - DISABLED */}
      {/* <RadialMenuSpell
        spellId="vulnerability-actions"
        activationConditions={{
          events: ['right-click' as any],
          mode: ActivationMode.HOLD,
        }}
        items={[
          {
            title: "Visualize Attack Path",
            icon: "🎨",
            onInvoke: (cedarStore) => {
              console.log('[GlobalSpells] Visualize Attack Path invoked');
              const findingId = document.querySelector('[data-finding-id]')?.getAttribute('data-finding-id');
              console.log('[GlobalSpells] Found findingId:', findingId);
              if (findingId) {
                sendMessage?.(`@finding-${findingId} Create an attack path diagram showing how an attacker could exploit this vulnerability`);
                toast.success("Generating attack path diagram...");
              } else {
                toast.error("No finding selected. Right-click on a table row.");
              }
            },
          },
          {
            title: "Copy Details",
            icon: Copy,
            onInvoke: () => {
              const finding = getSelectedFinding();
              if (finding) {
                navigator.clipboard.writeText(JSON.stringify(finding, null, 2));
                toast.success("Finding copied to clipboard");
              }
            },
          },
          {
            title: "Deep Analysis",
            icon: Search,
            onInvoke: () => {
              const findingId = document.querySelector('[data-finding-id]')?.getAttribute('data-finding-id');
              if (findingId) {
                sendMessage?.(`@finding-${findingId} Provide a comprehensive security analysis including:\n1. Technical details\n2. Attack scenarios\n3. Code examples\n4. Remediation steps`);
                toast.success("Requesting deep analysis...");
              }
            },
          },
          {
            title: "Generate Fix",
            icon: Wrench,
            onInvoke: () => {
              const findingId = document.querySelector('[data-finding-id]')?.getAttribute('data-finding-id');
              if (findingId) {
                sendMessage?.(`@finding-${findingId} Generate remediation code with:\n1. Before/after examples\n2. Security best practices\n3. Testing suggestions`);
                toast.success("Generating remediation code...");
              }
            },
          },
          {
            title: "Mark False Positive",
            icon: XCircle,
            onInvoke: () => {
              const findingId = document.querySelector('[data-finding-id]')?.getAttribute('data-finding-id');
              if (findingId) {
                toast.info(`Marked finding as false positive`);
              }
            },
          },
          {
            title: "Export Report",
            icon: FileText,
            onInvoke: () => {
              const finding = getSelectedFinding();
              if (finding) {
                const report = `# Security Finding Report\n\n**Severity**: ${finding.severity}\n**Endpoint**: ${finding.endpoint?.method} ${finding.endpoint?.path}\n\n**Impact**: ${finding.impact}\n\n**Recommendation**: ${finding.recommendation}`;
                const blob = new Blob([report], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `finding-${finding.id}-${Date.now()}.md`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Report exported");
              }
            },
          },
          {
            title: "MITRE Mapping",
            icon: Shield,
            onInvoke: () => {
              const findingId = document.querySelector('[data-finding-id]')?.getAttribute('data-finding-id');
              if (findingId) {
                sendMessage?.(`@finding-${findingId} Map this vulnerability to MITRE ATT&CK framework and explain relevant TTPs`);
                toast.success("Mapping to MITRE ATT&CK...");
              }
            },
          },
          {
            title: "Remediation Priority",
            icon: TrendingDown,
            onInvoke: () => {
              const findingId = document.querySelector('[data-finding-id]')?.getAttribute('data-finding-id');
              if (findingId) {
                sendMessage?.(`@finding-${findingId} Explain the remediation priority for this finding and suggest an action plan`);
                toast.success("Analyzing remediation priority...");
              }
            },
          },
        ]} */}
      {/* /> */}
    </>
  );
});

GlobalSpells.displayName = 'GlobalSpells';
