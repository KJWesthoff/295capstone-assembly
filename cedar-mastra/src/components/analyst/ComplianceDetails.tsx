'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ExternalLink, Info, AlertTriangle, Shield, FileText } from 'lucide-react';
import {
  NIST_80053_CONTROLS,
  NIST_CSF_CONTROLS,
  PCI_DSS_CONTROLS,
  CWE_TO_FRAMEWORKS,
  getControlDescription,
  getControlContextForCWE,
  getComplianceImpact,
  type ControlDescription,
  type FrameworkMapping,
} from '@/lib/compliance-mappings';

interface ComplianceDetailsProps {
  owasp?: string;
  cwe: string[];
  nistCsf?: string[];
  nist80053?: string[];
}

/**
 * Expandable Control Badge
 * Clicking reveals full description and context
 */
function ExpandableControl({
  controlId,
  framework,
  cwe,
  defaultOpen = true,
}: {
  controlId: string;
  framework: string;
  cwe?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const control = getControlDescription(framework, controlId);
  const context = cwe ? getControlContextForCWE(cwe, controlId) : undefined;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-accent transition-colors flex items-center gap-1"
        >
          {controlId}
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {control ? (
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-foreground">{control.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">({control.family})</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {control.description}
            </p>
            {control.guidance && (
              <div className="flex items-start gap-2 pt-1 border-t border-border">
                <Info className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {control.guidance}
                </p>
              </div>
            )}
            {context && (
              <div className="flex items-start gap-2 pt-1 border-t border-border">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                  {context}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
            <p className="text-muted-foreground text-xs">
              No detailed description available for this control.
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Compliance Impact Summary
 * Shows how many controls are affected across frameworks
 */
function ComplianceImpactSummary({ cweIds }: { cweIds: string[] }) {
  const impact = getComplianceImpact(cweIds);

  if (impact.length === 0) return null;

  const severityColors = {
    Critical: 'bg-red-500',
    High: 'bg-orange-500',
    Medium: 'bg-yellow-500',
    Low: 'bg-blue-500',
  };

  const totalControls = impact.reduce((sum, i) => sum + i.controlCount, 0);

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
      <h4 className="font-medium text-sm mb-3 text-foreground flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Compliance Impact Summary
      </h4>
      <div className="space-y-2">
        {impact.map(({ framework, controlCount, maxSeverity }) => (
          <div key={framework} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{framework}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${severityColors[maxSeverity]} transition-all`}
                style={{ width: `${Math.min((controlCount / 5) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-20 text-right">
              {controlCount} control{controlCount !== 1 ? 's' : ''}
            </span>
            <Badge
              variant="outline"
              className={`text-xs ${
                maxSeverity === 'Critical'
                  ? 'border-red-500 text-red-500'
                  : maxSeverity === 'High'
                  ? 'border-orange-500 text-orange-500'
                  : maxSeverity === 'Medium'
                  ? 'border-yellow-500 text-yellow-500'
                  : 'border-blue-500 text-blue-500'
              }`}
            >
              {maxSeverity}
            </Badge>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
        Resolving this finding improves compliance across{' '}
        <span className="font-medium text-foreground">{totalControls} control areas</span>
      </p>
    </div>
  );
}

/**
 * Framework Coverage Matrix
 * Shows which frameworks each CWE affects
 */
function FrameworkCoverageMatrix({ cweIds }: { cweIds: string[] }) {
  const [isOpen, setIsOpen] = useState(true);

  // Collect all framework mappings for these CWEs
  const allMappings: { cwe: string; mappings: FrameworkMapping[] }[] = [];
  for (const cwe of cweIds) {
    const normalizedCwe = cwe.toUpperCase().startsWith('CWE-') ? cwe.toUpperCase() : `CWE-${cwe}`;
    if (CWE_TO_FRAMEWORKS[normalizedCwe]) {
      allMappings.push({ cwe: normalizedCwe, mappings: CWE_TO_FRAMEWORKS[normalizedCwe] });
    }
  }

  if (allMappings.length === 0) return null;

  const severityDots = {
    Critical: '●●●●',
    High: '●●●○',
    Medium: '●●○○',
    Low: '●○○○',
  };

  const severityColors = {
    Critical: 'text-red-500',
    High: 'text-orange-500',
    Medium: 'text-yellow-500',
    Low: 'text-blue-500',
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Framework Coverage Matrix
          </span>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium text-foreground">Framework</th>
                <th className="text-left p-2 font-medium text-foreground">Control(s)</th>
                <th className="text-left p-2 font-medium text-foreground">Impact</th>
              </tr>
            </thead>
            <tbody>
              {allMappings.flatMap(({ cwe, mappings }) =>
                mappings.map((mapping, idx) => (
                  <tr
                    key={`${cwe}-${mapping.framework}-${idx}`}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    <td className="p-2 text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{mapping.framework}</span>
                        <span className="text-[10px] text-muted-foreground/70">{cwe}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {mapping.controls.map((ctrl) => (
                          <Badge key={ctrl} variant="outline" className="text-[10px] px-1.5 py-0">
                            {ctrl}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">
                      <span className={`font-mono ${severityColors[mapping.severity]}`}>
                        {severityDots[mapping.severity]}
                      </span>
                      <span className={`ml-2 ${severityColors[mapping.severity]}`}>
                        {mapping.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-1">
          Click on individual controls above to see detailed descriptions and guidance.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Main Compliance Details Component
 * Enhanced compliance tab with expandable details and framework matrix
 */
export function ComplianceDetails({ owasp, cwe, nistCsf, nist80053 }: ComplianceDetailsProps) {
  // Get primary CWE for context (usually the first one)
  const primaryCwe = cwe[0];

  return (
    <div className="space-y-4">
      {/* Compliance Impact Summary */}
      {cwe.length > 0 && <ComplianceImpactSummary cweIds={cwe} />}

      {/* OWASP */}
      <div>
        <h4 className="font-medium text-sm mb-2 text-foreground">OWASP API Security</h4>
        <Badge variant="outline" className="text-sm">
          {owasp || 'Unknown'}
        </Badge>
        {owasp && (
          <a
            href={`https://owasp.org/API-Security/editions/2023/en/0x${owasp.split(':')[0].replace('API', '')}${owasp.split(':')[0].replace('API', '')}-${owasp.split('—')[1]?.trim().toLowerCase().replace(/\s+/g, '-') || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline ml-2"
          >
            Learn more <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* CWE */}
      {cwe.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2 text-foreground">CWE (Common Weakness Enumeration)</h4>
          <div className="flex gap-2 flex-wrap">
            {cwe.map((c) => (
              <div key={c} className="flex items-center gap-1">
                <Badge variant="outline">{c}</Badge>
                <a
                  href={`https://cwe.mitre.org/data/definitions/${c.replace('CWE-', '')}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NIST CSF with Expandable Controls */}
      {nistCsf && nistCsf.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2 text-foreground">
            NIST Cybersecurity Framework (CSF)
          </h4>
          <div className="flex gap-2 flex-wrap items-start">
            {nistCsf.map((n) => (
              <ExpandableControl
                key={n}
                controlId={n}
                framework="NIST CSF"
                cwe={primaryCwe}
              />
            ))}
          </div>
        </div>
      )}

      {/* NIST 800-53 with Expandable Controls */}
      {nist80053 && nist80053.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2 text-foreground">
            NIST 800-53 Rev 5
          </h4>
          <div className="flex gap-2 flex-wrap items-start">
            {nist80053.map((n) => (
              <ExpandableControl
                key={n}
                controlId={n}
                framework="NIST 800-53"
                cwe={primaryCwe}
              />
            ))}
          </div>
        </div>
      )}

      {/* Framework Coverage Matrix */}
      {cwe.length > 0 && <FrameworkCoverageMatrix cweIds={cwe} />}
    </div>
  );
}

export default ComplianceDetails;
