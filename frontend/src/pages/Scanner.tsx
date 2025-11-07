import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, Copy, LogOut, ChevronDown, MessageSquare, UserCircle } from "lucide-react";
import cyberBearLogo from "@/assets/cyber-bear-logo.png";
import { useToast } from "@/hooks/use-toast";
import { ContextBasketProvider } from "@/contexts/ContextBasketContext";
import { ContextBasket } from "@/components/ContextBasket";
import { SecurityChatbot } from "@/components/SecurityChatbot";

type UserRole = "security-analyst" | "software-engineer" | "c-suite";

const roleLabels: Record<UserRole, string> = {
  "security-analyst": "Security Analyst",
  "software-engineer": "Software Engineer",
  "c-suite": "C-Suite Executive",
};

const Scanner = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("security-analyst");
  const [sidebarTab, setSidebarTab] = useState<"basket" | "chat">("basket");

  const handleSendToAI = () => {
    setSidebarTab("chat");
    setShowSidebar(true);
  };

  // Mock data based on the reference image
  const scanId = "e5fe5b28-06a5-4f4f-b3f3-42d36b27d488";
  const scanDate = "10/15/2025, 8:31:57 AM";
  
  const stats = {
    total: 9,
    critical: 0,
    high: 5,
    medium: 3,
    low: 1,
  };

  const findings = [
    {
      id: 1,
      severity: "HIGH",
      title: "Broken Authentication",
      description: "Endpoint returns success for unauthenticated/invalid credentials requests.",
      rule: "API2",
      score: 7.2,
      scanner: "VentiAPI - OWASP API Security Top 10",
      method: "GET",
      endpoint: "/api/users",
    },
    {
      id: 2,
      severity: "LOW",
      title: "Lack of Rate Limiting",
      description: "Burst of requests did not trigger 429 nor expose rate limit headers; RL likely missing.",
      rule: "API4",
      score: 3,
      scanner: "VentiAPI - OWASP API Security Top 10",
      method: "POST",
      endpoint: "/api/auth",
    },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/thank-you");
  };

  const toggleFinding = (id: number) => {
    setExpandedFindings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyScanId = () => {
    navigator.clipboard.writeText(scanId);
    toast({
      title: "Copied!",
      description: "Scan ID copied to clipboard",
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-900/50 text-red-300 border-red-700";
      case "HIGH":
        return "bg-orange-900/50 text-orange-300 border-orange-700";
      case "MEDIUM":
        return "bg-yellow-900/50 text-yellow-300 border-yellow-700";
      case "LOW":
        return "bg-blue-900/50 text-blue-300 border-blue-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <ContextBasketProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-sm shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/" className="cursor-pointer hover:opacity-80 transition-opacity">
                  <img src={cyberBearLogo} alt="VentiAPI Cyber Bear" className="w-12 h-12" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    VentiAPI
                  </h1>
                  <p className="text-xs text-muted-foreground font-sans">
                    Security Scan Results
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="bg-card text-foreground hover:bg-card/90 border-border">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {roleLabels[selectedRole]}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setSelectedRole("security-analyst")}>
                      <UserCircle className="mr-2 h-4 w-4" />
                      Security Analyst
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedRole("software-engineer")}>
                      <UserCircle className="mr-2 h-4 w-4" />
                      Software Engineer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedRole("c-suite")}>
                      <UserCircle className="mr-2 h-4 w-4" />
                      C-Suite Executive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  onClick={() => setShowSidebar(!showSidebar)}
                  variant={showSidebar ? "default" : "outline"}
                  className={showSidebar ? "" : "bg-card text-foreground hover:bg-card/90 border-border"}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {showSidebar ? "Hide Sidebar" : "Ask about security"}
                </Button>

                <Button onClick={handleSignOut} variant="outline" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12">
          <div className={showSidebar ? "grid lg:grid-cols-[1fr,420px] gap-6" : ""}>
            <div>
              {/* Scan Info */}
              <div className="bg-card rounded-lg p-4 mb-6 flex items-center justify-between border">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Scan ID</div>
              <div className="flex items-center gap-2">
                <code className="text-primary font-mono text-sm">{scanId}</code>
                <button
                  onClick={copyScanId}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="border-l border-border/50 pl-4">
              <span className="text-sm text-muted-foreground">API: Unknown</span>
              <span className="mx-3 text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">Date: {scanDate}</span>
            </div>
          </div>
          <Button className="bg-primary hover:bg-primary/90">New Scan</Button>
        </div>

        {/* AI Tip */}
        <div className="bg-primary/20 border border-primary/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <strong>Tip:</strong> Ask the AI assistant to analyze these results by providing the Scan ID above
          </p>
        </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <Card className="bg-card border p-6">
            <div className="text-3xl font-bold mb-2">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Issues</div>
          </Card>
          <Card className="bg-red-900/20 border-red-700/50 p-6">
            <div className="text-3xl font-bold text-red-400 mb-2">{stats.critical}</div>
            <div className="text-sm text-red-300">Critical</div>
          </Card>
          <Card className="bg-orange-900/20 border-orange-700/50 p-6">
            <div className="text-3xl font-bold text-orange-400 mb-2">{stats.high}</div>
            <div className="text-sm text-orange-300">High</div>
          </Card>
          <Card className="bg-yellow-900/20 border-yellow-700/50 p-6">
            <div className="text-3xl font-bold text-yellow-400 mb-2">{stats.medium}</div>
            <div className="text-sm text-yellow-300">Medium</div>
          </Card>
          <Card className="bg-blue-900/20 border-blue-700/50 p-6">
            <div className="text-3xl font-bold text-blue-400 mb-2">{stats.low}</div>
            <div className="text-sm text-blue-300">Low</div>
          </Card>
        </div>

              {/* Vulnerabilities Section */}
              <div>
          <h2 className="text-2xl font-bold mb-6">Vulnerabilities by Endpoint (Sorted by Severity)</h2>
          
          <div className="flex items-center gap-4 mb-4">
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/50">
              {findings[0].method}
            </Badge>
            <span className="text-muted-foreground">/ {findings.length} findings</span>
          </div>

                <div className="space-y-4">
                  {findings.map((finding) => (
                    <Card key={finding.id} className="bg-card border overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getSeverityColor(finding.severity)} border`}>
                        {finding.severity}
                      </Badge>
                      <h3 className="text-lg font-semibold">{finding.title}</h3>
                    </div>
                    <button
                      onClick={() => toggleFinding(finding.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${expandedFindings.has(finding.id) ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  <p className="text-muted-foreground mb-4">{finding.description}</p>

                  {expandedFindings.has(finding.id) && (
                    <div className="space-y-2 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Rule: </span>
                          <span className="text-sm font-medium">{finding.rule}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Score: </span>
                          <span className="text-sm font-medium">{finding.score}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Scanner: </span>
                        <span className="text-sm font-medium">{finding.scanner}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            {showSidebar && (
              <div className="lg:sticky lg:top-24 h-[calc(100vh-8rem)]">
                <Tabs 
                  value={sidebarTab} 
                  onValueChange={(v) => setSidebarTab(v as "basket" | "chat")} 
                  className="h-full flex flex-col"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="basket">Context Basket</TabsTrigger>
                    <TabsTrigger value="chat">AI Chat</TabsTrigger>
                  </TabsList>
                  <TabsContent value="basket" className="flex-1 mt-0">
                    <ContextBasket onSendToAI={handleSendToAI} userRole={roleLabels[selectedRole]} />
                  </TabsContent>
                  <TabsContent value="chat" className="flex-1 mt-0">
                    <SecurityChatbot 
                      onClose={() => setShowSidebar(false)} 
                      userRole={roleLabels[selectedRole]}
                      basketContext={sidebarTab === "chat"}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </main>
      </div>
    </ContextBasketProvider>
  );
};

export default Scanner;
