import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ScanLine, FileSearch, LogOut } from "lucide-react";
import cyberBearLogo from "@/assets/cyber-bear-logo.png";
import { useToast } from "@/hooks/use-toast";
import { ScanConfigDialog } from "@/components/ScanConfigDialog";

type Persona = "developer" | "analyst" | "executive";

interface Profile {
  persona: Persona;
  email: string;
  company: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showScanDialog, setShowScanDialog] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("persona, email, company")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        });
      } else if (profileData) {
        // Map security_analyst to analyst for backward compatibility
        const mappedProfile = {
          ...profileData,
          persona: profileData.persona === 'security_analyst' ? 'analyst' : profileData.persona
        } as Profile;
        setProfile(mappedProfile);
      }

      setLoading(false);
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/thank-you");
  };

  const getPersonaTitle = () => {
    if (!profile) return "Dashboard";
    const titles = {
      developer: "Developer Dashboard",
      analyst: "Security Analyst Dashboard",
      executive: "Executive Dashboard",
    };
    return titles[profile.persona];
  };

  const getPersonaContent = () => {
    if (!profile) return null;

    const content = {
      developer: {
        title: "API Security Testing",
        description: "Test and secure your REST APIs with automated vulnerability scanning",
        features: ["Automated security testing", "Real-time vulnerability detection", "Integration with CI/CD"],
      },
      analyst: {
        title: "Security Analysis",
        description: "Comprehensive security analysis and vulnerability reporting",
        features: ["Detailed vulnerability reports", "Risk assessment", "Compliance tracking"],
      },
      executive: {
        title: "Compliance Overview",
        description: "Monitor security posture and compliance across your organization",
        features: ["Executive summaries", "Compliance dashboards", "Risk metrics"],
      },
    };

    return content[profile.persona];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const personaContent = getPersonaContent();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={cyberBearLogo} alt="VentiAPI" className="w-10 h-10" />
            <h1 className="text-xl font-bold">VentiAPI</h1>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">{getPersonaTitle()}</h2>
          <p className="text-muted-foreground">
            Welcome back, {profile?.email}
            {profile?.company && ` from ${profile.company}`}
          </p>
        </div>

        {personaContent && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Welcome Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {personaContent.title}
                </CardTitle>
                <CardDescription>{personaContent.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {personaContent.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Start Scan Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="w-5 h-5 text-primary" />
                  Start Scan
                </CardTitle>
                <CardDescription>
                  Begin a new API security scan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => setShowScanDialog(true)}>
                  Start New Scan
                </Button>
              </CardContent>
            </Card>

            {/* View Results Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-primary" />
                  View Results
                </CardTitle>
                <CardDescription>
                  Review previous scan results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => navigate("/scanner")}>
                  View All Results
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <ScanConfigDialog open={showScanDialog} onOpenChange={setShowScanDialog} />
    </div>
  );
};

export default Dashboard;
