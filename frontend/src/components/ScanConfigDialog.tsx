import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import cyberBearLogo from "@/assets/cyber-bear-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Upload, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ScanConfig {
  serverUrl: string;
  openApiSpec?: string;
  openApiFile?: File;
  scanners: {
    ventiapi: boolean;
    zap: boolean;
    nuclei: boolean;
  };
  requestsPerSecond: number;
  maxRequests: number;
  fuzzAuthentication: boolean;
  enableDangerousTests: boolean;
}

interface ScanConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScanConfigDialog = ({ open, onOpenChange }: ScanConfigDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [serverUrl, setServerUrl] = useState("");
  const [openApiSpec, setOpenApiSpec] = useState("");
  const [openApiFile, setOpenApiFile] = useState<File | null>(null);
  const [scanners, setScanners] = useState({
    ventiapi: true,
    zap: true,
    nuclei: false,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [requestsPerSecond, setRequestsPerSecond] = useState([1]);
  const [maxRequests, setMaxRequests] = useState("100");
  const [fuzzAuthentication, setFuzzAuthentication] = useState(false);
  const [enableDangerousTests, setEnableDangerousTests] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOpenApiFile(file);
      toast({
        title: "File uploaded",
        description: file.name,
      });
    }
  };

  const handleStartScan = () => {
    if (!serverUrl.trim()) {
      toast({
        title: "Error",
        description: "Server URL is required",
        variant: "destructive",
      });
      return;
    }

    const config: ScanConfig = {
      serverUrl,
      openApiSpec,
      openApiFile: openApiFile || undefined,
      scanners,
      requestsPerSecond: requestsPerSecond[0],
      maxRequests: parseInt(maxRequests),
      fuzzAuthentication,
      enableDangerousTests,
    };

    console.log("Starting scan with config:", config);
    
    toast({
      title: "Scan started",
      description: "Your security scan is now running",
    });

    onOpenChange(false);
    navigate("/scanner");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <img src={cyberBearLogo} alt="Cyber Bear" className="h-12 w-12" />
            <DialogTitle className="text-2xl font-bold">VentiAPI Security Scan</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Server URL */}
          <div className="space-y-2">
            <Label htmlFor="server-url" className="text-base font-semibold">
              Server URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="server-url"
              placeholder="https://api.example.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="text-base"
            />
            <p className="text-sm text-muted-foreground">The base URL of the API to scan</p>
          </div>

          {/* OpenAPI Specification */}
          <div className="space-y-2">
            <Label htmlFor="openapi-spec" className="text-base font-semibold">
              OpenAPI Specification (Optional)
            </Label>
            <Input
              id="openapi-spec"
              placeholder="https://api.example.com/openapi.json"
              value={openApiSpec}
              onChange={(e) => setOpenApiSpec(e.target.value)}
              className="text-base"
            />
            
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 border-t border-border"></div>
              <span className="text-sm text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-border"></div>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="openapi-file"
                className="hidden"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
              />
              <label htmlFor="openapi-file" className="cursor-pointer">
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <Button variant="outline" size="sm" type="button" onClick={() => document.getElementById('openapi-file')?.click()}>
                  CHOOSE FILE
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload OpenAPI spec file (.json/YAML)
                </p>
                {openApiFile && (
                  <p className="text-sm text-primary mt-2 font-medium">{openApiFile.name}</p>
                )}
              </label>
            </div>
          </div>

          {/* Scanners */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              Scanners <span className="text-destructive">*</span>
            </Label>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                <Checkbox
                  id="ventiapi"
                  checked={scanners.ventiapi}
                  onCheckedChange={(checked) => 
                    setScanners({ ...scanners, ventiapi: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="ventiapi" className="font-semibold cursor-pointer">
                    Ventiapi
                  </label>
                  <p className="text-sm text-muted-foreground">
                    VentiAPI - OWASP API Security Top 10 focused scanner
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                <Checkbox
                  id="zap"
                  checked={scanners.zap}
                  onCheckedChange={(checked) => 
                    setScanners({ ...scanners, zap: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="zap" className="font-semibold cursor-pointer">
                    Zap
                  </label>
                  <p className="text-sm text-muted-foreground">
                    OWASP ZAP - Comprehensive web application security scanner
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                <Checkbox
                  id="nuclei"
                  checked={scanners.nuclei}
                  onCheckedChange={(checked) => 
                    setScanners({ ...scanners, nuclei: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <label htmlFor="nuclei" className="font-semibold cursor-pointer">
                    Nuclei
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Nuclei - Fast and customizable vulnerability scanner
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-base font-semibold hover:text-primary transition-colors">
              <ChevronDown className={`w-5 h-5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              Advanced Options
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-6">
              {/* Requests per Second */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Requests per Second: {requestsPerSecond[0]}
                </Label>
                <Slider
                  value={requestsPerSecond}
                  onValueChange={setRequestsPerSecond}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Lower values are safer for production APIs
                </p>
              </div>

              {/* Max Requests */}
              <div className="space-y-2">
                <Label htmlFor="max-requests" className="text-base font-semibold">
                  Max Requests
                </Label>
                <Input
                  id="max-requests"
                  type="number"
                  value={maxRequests}
                  onChange={(e) => setMaxRequests(e.target.value)}
                  min="1"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="fuzz-auth"
                    checked={fuzzAuthentication}
                    onCheckedChange={(checked) => setFuzzAuthentication(checked as boolean)}
                  />
                  <label htmlFor="fuzz-auth" className="text-sm cursor-pointer">
                    Fuzz Authentication (test with bypass techniques)
                  </label>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Checkbox
                    id="dangerous-tests"
                    checked={enableDangerousTests}
                    onCheckedChange={(checked) => setEnableDangerousTests(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <label htmlFor="dangerous-tests" className="text-sm cursor-pointer flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      Enable Dangerous Tests
                    </label>
                    <p className="text-xs text-destructive">
                      May modify data (use only on test environments)
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              CANCEL
            </Button>
            <Button
              onClick={handleStartScan}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              START SCAN
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
