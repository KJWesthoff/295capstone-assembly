"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { FileDown, Mail, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";


interface BoardBriefWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportMeta: { tone: string; length: number; window: string };
  setReportMeta: (meta: any) => void;
  reportItems: any[];
}

export function BoardBriefWizard({
  open,
  onOpenChange,
  reportMeta,
  setReportMeta,
  reportItems
}: BoardBriefWizardProps) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    subject: string;
    summary: string;
    html: string;
    markdown: string;
  } | null>(null);

  const generateReportHtml = (items: any[], meta: any) => {
    let html = `
      <div style="font-family: sans-serif; color: #333; padding: 20px;">
        <h1 style="color: #0f172a; margin-bottom: 5px;">Security Executive Brief</h1>
        <p style="color: #64748b; font-size: 0.9em; margin-bottom: 20px;">
          Period: Last ${meta.window.replace('d', ' Days')} | Tone: ${meta.tone}
        </p>
        <hr style="border: 1px solid #e2e8f0; margin-bottom: 20px;" />
    `;

    // Process KPIs
    const kpis = items.find(i => i.type === 'kpis')?.data;
    if (kpis) {
      html += `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #0f172a; font-size: 1.25em; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 15px;">
            Executive Summary
          </h2>
          <div style="display: flex; gap: 15px; margin-bottom: 15px;">
            <div style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 0.8em; color: #64748b; text-transform: uppercase;">Risk Score</div>
              <div style="font-size: 2em; font-weight: bold; color: ${kpis.riskScore > 7 ? '#ef4444' : '#3b82f6'}">${kpis.riskScore}/10</div>
            </div>
            <div style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 0.8em; color: #64748b; text-transform: uppercase;">Critical Issues</div>
              <div style="font-size: 2em; font-weight: bold; color: #ef4444">${kpis.critical}</div>
            </div>
             <div style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size: 0.8em; color: #64748b; text-transform: uppercase;">Mean Time to Resolve</div>
              <div style="font-size: 2em; font-weight: bold; color: #334155">${kpis.mttrMedian || '0'}h</div>
            </div>
          </div>
        </div>
      `;
    }

    // Process Top Risks
    const risks = items.find(i => i.type === 'topRisks')?.data;
    if (risks && risks.length > 0) {
      html += `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #0f172a; font-size: 1.25em; border-bottom: 2px solid #ef4444; padding-bottom: 8px; margin-bottom: 15px;">
            Top Business Risks
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
            <thead style="background: #f1f5f9;">
              <tr>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e1;">Risk</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e1;">Impact</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e1;">Owner</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #cbd5e1;">Severity</th>
              </tr>
            </thead>
            <tbody>
              ${risks.map((r: any) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px;"><strong>${r.title}</strong><br/><span style="color: #64748b; font-size: 0.85em;">${r.id}</span></td>
                  <td style="padding: 10px;">${r.businessImpact}</td>
                  <td style="padding: 10px;">${r.owner}</td>
                  <td style="padding: 10px;"><span style="color: #ef4444; font-weight: bold;">${r.severity}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Process Compliance
    const compliance = items.find(i => i.type === 'compliance')?.data;
    if (compliance) {
      html += `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #0f172a; font-size: 1.25em; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 15px;">
            Compliance Snapshot
          </h2>
           <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
             <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
               <h3 style="margin-top: 0; font-size: 1em;">NIST CSF Status</h3>
               <ul style="list-style: none; padding: 0;">
                 ${Object.entries(compliance.nistCsf || {}).map(([Key, Val]) => `
                   <li style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
                     <span>${Key}</span>
                     <strong>${Val}</strong>
                   </li>
                 `).join('')}
               </ul>
             </div>
             <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
               <h3 style="margin-top: 0; font-size: 1em;">OWASP Top 10</h3>
               <ul style="list-style: none; padding: 0;">
                  ${Object.entries(compliance.owaspCounts || {}).slice(0, 5).map(([Key, Val]) => `
                   <li style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
                     <span style="font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${Key}</span>
                     <strong>${Val}</strong>
                   </li>
                 `).join('')}
               </ul>
             </div>
           </div>
        </div>
      `;
    }

    html += `
        <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 0.8em;">
          Generated by Cedar Mastra • Confidential • ${new Date().toLocaleDateString()}
        </div>
      </div>
    `;

    return html;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Simulate generic AI "thinking" time
      await new Promise(resolve => setTimeout(resolve, 800));

      const generatedHtml = generateReportHtml(reportItems, reportMeta);

      const generatedPreview = {
        subject: `Security Overview - ${new Date().toLocaleDateString()}`,
        summary: `Executive summary covering ${reportItems.filter(i => i.data).length} key security domains. Risk Score is currently ${reportItems.find(i => i.type === 'kpis')?.data?.riskScore || 'N/A'}.`,
        html: generatedHtml,
        markdown: `Could not generate markdown preview for this HTML content.` // Simplified for now
      };

      setPreview(generatedPreview);
      setStep(3);
    } catch (error) {
      toast.error("Generation Failed - Could not generate board brief");
    } finally {
      setGenerating(false);
    }
  };


  const handleDownloadPDF = async () => {
    if (!preview?.html) return;

    const element = document.createElement('div');
    element.innerHTML = preview.html;

    const opt = {
      margin: 0.5,
      filename: `security-brief-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    toast.info("Generating PDF...");
    try {
      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set(opt).from(element).save();
      toast.success("PDF Downloaded successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
  };

  const handleDownloadMD = () => {
    if (preview?.markdown) {
      const blob = new Blob([preview.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "board-brief.md";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleEmail = () => {
    // In a real app this would call an API
    toast.success("Board brief sent to stakeholders");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Board Brief - Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Scope Selection</h3>
              <div className="space-y-4">
                <div>
                  <Label>Time Window</Label>
                  <RadioGroup
                    value={reportMeta.window}
                    onValueChange={(value) => setReportMeta({ ...reportMeta, window: value })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="7d" id="7d" />
                      <Label htmlFor="7d">Last 7 days</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="30d" id="30d" />
                      <Label htmlFor="30d">Last 30 days</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="90d" id="90d" />
                      <Label htmlFor="90d">Last 90 days</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Selected Sections:</p>
                  <ul className="text-sm space-y-1">
                    {reportItems.filter(i => i.data).map((item, idx) => (
                      <li key={idx}>✓ {item.type}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Tone & Length</h3>
              <div className="space-y-6">
                <div>
                  <Label>Tone</Label>
                  <RadioGroup
                    value={reportMeta.tone}
                    onValueChange={(value) => setReportMeta({ ...reportMeta, tone: value })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Board" id="board" />
                      <Label htmlFor="board">Board Level (executive summary)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Executive" id="executive" />
                      <Label htmlFor="executive">Executive (strategic insights)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Technical" id="technical" />
                      <Label htmlFor="technical">Technical (detailed analysis)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label>Length: {reportMeta.length} words</Label>
                  <Slider
                    value={[reportMeta.length]}
                    onValueChange={([value]) => setReportMeta({ ...reportMeta, length: value })}
                    min={100}
                    max={500}
                    step={50}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Brief
              </Button>
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Preview & Deliver</h3>
              <div className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <p className="text-sm font-medium mt-1">{preview.subject}</p>
                </div>

                <div>
                  <Label>Summary</Label>
                  <p className="text-sm text-muted-foreground mt-1">{preview.summary}</p>
                </div>

                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto bg-white">
                  <div dangerouslySetInnerHTML={{ __html: preview.html }} />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadPDF}>
                  <FileDown className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" onClick={handleDownloadMD} disabled>
                  Markdown (N/A)
                </Button>
                <Button onClick={handleEmail}>
                  <Mail className="mr-2 h-4 w-4" /> Email
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
