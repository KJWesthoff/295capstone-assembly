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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Mock generation - in production, this would call your AI endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));

      const generatedPreview = {
        subject: `Security Board Brief - ${reportMeta.window.toUpperCase()}`,
        summary: `Executive summary of ${reportItems.filter(i => i.data).length} key security areas`,
        html: `
          <h1>Security Board Brief</h1>
          <h2>Risk Score Overview</h2>
          <p>Current risk metrics and trends...</p>
          <h2>Top Business Risks</h2>
          <ul><li>Critical findings requiring immediate attention</li></ul>
          <h2>Compliance Posture</h2>
          <p>OWASP, CWE, and NIST compliance status...</p>
        `,
        markdown: `# Security Board Brief\n\n## Risk Score Overview\n\nCurrent risk metrics...\n\n## Top Business Risks\n\n- Critical findings\n\n## Compliance Posture\n\nOWASP, CWE, NIST status...`
      };

      setPreview(generatedPreview);
      setStep(3);
    } catch (error) {
      toast.error("Generation Failed - Could not generate board brief");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    toast.info("Downloading board brief as PDF...");
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

                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
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
                <Button variant="outline" onClick={handleDownloadMD}>
                  <FileDown className="mr-2 h-4 w-4" /> Markdown
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
