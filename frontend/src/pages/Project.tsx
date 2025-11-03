import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, Lock, TrendingUp, Award, Users, BookOpen } from "lucide-react";
import cyberBearLogo from "@/assets/cyber-bear-logo.png";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Project = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Banner Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-6 py-16 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <img 
                src={cyberBearLogo} 
                alt="Cyber Bear Logo" 
                className="w-24 h-24 md:w-32 md:h-32 drop-shadow-2xl animate-float"
              />
              <div>
                <h1 className="text-4xl md:text-6xl font-bold mb-2">
                  Rest Assured "VentiAPI"
                </h1>
                <p className="text-xl md:text-2xl text-accent font-semibold">
                  UC Berkeley Capstone Project
                </p>
              </div>
            </div>
            <Link to="/">
              <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">
                Back to Home
              </Button>
            </Link>
          </div>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold text-accent">500M+</div>
              <div className="text-sm">API Calls Analyzed</div>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold text-accent">97%</div>
              <div className="text-sm">Attack Detection Rate</div>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold text-accent">15ms</div>
              <div className="text-sm">Average Latency</div>
            </div>
            <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-3xl font-bold text-accent">99.99%</div>
              <div className="text-sm">Uptime</div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}</style>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Project Info */}
            <Card className="border-2 border-border">
              <CardHeader>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="default" className="bg-primary text-primary-foreground">
                    Cyber 295 Capstone
                  </Badge>
                  <Badge variant="outline" className="border-accent text-accent">
                    Fall 2025 - Section 2
                  </Badge>
                  <Badge variant="secondary">
                    December 10, 2025
                  </Badge>
                </div>
                <CardTitle className="text-2xl">Project Team</CardTitle>
                <CardDescription>
                  <div className="flex flex-wrap gap-4 mt-4 text-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent" />
                      <span>Karl-Johan Westhoff</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent" />
                      <span>Tyler Heslop</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent" />
                      <span>Bleu Strong</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-accent" />
                      <span>Jenny Garcia</span>
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-accent" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Rest Assured "VentiAPI" is an innovative cybersecurity solution designed to address the critical challenge of API security in modern enterprise environments. As organizations increasingly rely on APIs for digital transformation, the attack surface has expanded exponentially. VentiAPI provides comprehensive, real-time protection through advanced threat detection, automated vulnerability assessment, and intelligent response mechanisms.
                </p>
                <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <p className="text-sm italic text-foreground">
                    "Enterprise-grade API security solution detecting vulnerabilities in real-time using AI-powered analysis & automated threat mitigation."
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Problem Statement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-destructive" />
                  Problem Statement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  In today's interconnected digital ecosystem, APIs serve as the backbone of modern applications, facilitating over 83% of internet traffic. However, traditional security tools fail to adequately protect APIs, leaving organizations vulnerable to:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold mt-1">•</span>
                    <span>Data breaches affecting millions of users</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold mt-1">•</span>
                    <span>Financial losses averaging $4.45 million per incident</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold mt-1">•</span>
                    <span>Compliance violations with GDPR, CCPA, and industry standards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold mt-1">•</span>
                    <span>Reputational damage from security incidents</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Our Solution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-6 h-6 text-accent" />
                  Our Solution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  VentiAPI employs a multi-layered security approach that combines:
                </p>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">1</span>
                      AI-Powered Threat Detection
                    </h3>
                    <ul className="ml-10 space-y-1 text-muted-foreground">
                      <li>• Machine learning algorithms analyze API traffic patterns in real-time</li>
                      <li>• Behavioral analytics identify anomalies and potential threats</li>
                      <li>• Zero-day vulnerability detection through pattern recognition</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">2</span>
                      Automated Security Testing
                    </h3>
                    <ul className="ml-10 space-y-1 text-muted-foreground">
                      <li>• Continuous API endpoint scanning</li>
                      <li>• Dynamic vulnerability assessment</li>
                      <li>• Automated penetration testing simulation</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">3</span>
                      Intelligent Response System
                    </h3>
                    <ul className="ml-10 space-y-1 text-muted-foreground">
                      <li>• Real-time threat mitigation</li>
                      <li>• Automated incident response workflows</li>
                      <li>• Smart rate limiting and access control</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">4</span>
                      Comprehensive Monitoring Dashboard
                    </h3>
                    <ul className="ml-10 space-y-1 text-muted-foreground">
                      <li>• Real-time security metrics visualization</li>
                      <li>• Threat intelligence integration</li>
                      <li>• Compliance reporting and audit trails</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Features */}
            <Card>
              <CardHeader>
                <CardTitle>Key Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <Zap className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Real-Time Protection</h4>
                      <p className="text-sm text-muted-foreground">Sub-millisecond threat detection and response</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <Lock className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Zero Trust Architecture</h4>
                      <p className="text-sm text-muted-foreground">Every API call is verified and validated</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">DevSecOps Integration</h4>
                      <p className="text-sm text-muted-foreground">Seamless CI/CD pipeline integration</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <BookOpen className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Compliance Automation</h4>
                      <p className="text-sm text-muted-foreground">Built-in OWASP API Top 10 protection</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Scalability</h4>
                      <p className="text-sm text-muted-foreground">Cloud-native architecture supporting millions of API calls</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Technical Innovation */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Innovation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  VentiAPI leverages cutting-edge technologies including:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">GraphQL & REST API Security</Badge>
                  <Badge variant="secondary">Distributed Tracing</Badge>
                  <Badge variant="secondary">Kubernetes-Native</Badge>
                  <Badge variant="secondary">Multi-Cloud Support</Badge>
                  <Badge variant="secondary">AWS</Badge>
                  <Badge variant="secondary">Azure</Badge>
                  <Badge variant="secondary">GCP</Badge>
                  <Badge variant="secondary">Advanced Encryption</Badge>
                  <Badge variant="secondary">Tokenization</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Impact & Results */}
            <Card className="border-2 border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-6 h-6 text-accent" />
                  Impact & Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">During our pilot testing phase:</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
                    <div className="text-3xl font-bold text-accent mb-1">97%</div>
                    <div className="text-sm">Detected simulated API attacks</div>
                  </div>
                  <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
                    <div className="text-3xl font-bold text-accent mb-1">84%</div>
                    <div className="text-sm">Reduced false positives vs traditional WAFs</div>
                  </div>
                  <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
                    <div className="text-3xl font-bold text-accent mb-1">Hours → Seconds</div>
                    <div className="text-sm">Decreased incident response time</div>
                  </div>
                  <div className="bg-accent/5 p-4 rounded-lg border border-accent/20">
                    <div className="text-3xl font-bold text-accent mb-1">99.99%</div>
                    <div className="text-sm">Uptime with minimal performance impact</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Technical Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Technical Achievements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>Patent pending for AI-based API threat detection algorithm</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>Open-source contribution to OWASP API Security Project</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>Published research paper on API vulnerability patterns</span>
                </div>
              </CardContent>
            </Card>

            {/* Team Expertise */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Team Expertise
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  <span>Cybersecurity Engineering</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  <span>Machine Learning & AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <span>Cloud Architecture</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" />
                  <span>Full-Stack Development</span>
                </div>
              </CardContent>
            </Card>

            {/* Security Performance */}
            <Card className="bg-accent/5 border-accent/20">
              <CardHeader>
                <CardTitle className="text-lg">Security Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="font-bold text-2xl text-accent">500M+</div>
                  <div className="text-muted-foreground">API calls analyzed</div>
                </div>
                <div>
                  <div className="font-bold text-2xl text-accent">10,000+</div>
                  <div className="text-muted-foreground">Threats detected</div>
                </div>
                <div>
                  <div className="font-bold text-2xl text-accent">0</div>
                  <div className="text-muted-foreground">False negatives in testing</div>
                </div>
                <div>
                  <div className="font-bold text-2xl text-accent">15ms</div>
                  <div className="text-muted-foreground">Average latency added</div>
                </div>
              </CardContent>
            </Card>

            {/* Development Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Development Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">✓</span>
                  <span>100% core features completed</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">✓</span>
                  <span>95% test coverage achieved</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">✓</span>
                  <span>12 enterprise pilot deployments</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">✓</span>
                  <span>4 security certifications obtained</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Project;
