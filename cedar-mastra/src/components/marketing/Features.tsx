import { Shield, Gauge, FileSearch, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Shield,
    title: "Automated Vulnerability Detection",
    description: "Scan your REST APIs for common security vulnerabilities including OWASP Top 10 threats automatically.",
    color: "text-accent",
  },
  {
    icon: Gauge,
    title: "Real-Time Monitoring",
    description: "Get instant alerts when new vulnerabilities are discovered with continuous API monitoring.",
    color: "text-cyan-500",
  },
  {
    icon: FileSearch,
    title: "Detailed Reports",
    description: "Receive comprehensive, easy-to-understand reports with actionable remediation steps.",
    color: "text-accent",
  },
  {
    icon: Lock,
    title: "Authentication Testing",
    description: "Test your authentication mechanisms for weaknesses and ensure proper access controls.",
    color: "text-cyan-500",
  },
  {
    icon: AlertCircle,
    title: "Compliance Checking",
    description: "Verify your APIs meet industry standards including GDPR, HIPAA, and PCI DSS requirements.",
    color: "text-accent",
  },
  {
    icon: CheckCircle,
    title: "Simple Integration",
    description: "Get started in minutes with our easy-to-use API or web interface. No complex setup required.",
    color: "text-cyan-500",
  },
];

const Features = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Comprehensive API Security
            <span className="block text-accent mt-2">Made Simple</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to protect your REST APIs, without the steep learning curve.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border bg-card"
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl font-bold text-card-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-lg text-muted-foreground mb-6">
            Join hundreds of developers securing their APIs with VentiAPI
          </p>
          <div className="inline-flex items-center gap-2 bg-accent/10 px-6 py-3 rounded-full">
            <CheckCircle className="w-5 h-5 text-accent" />
            <span className="text-foreground font-medium">Free 14-day trial • No credit card required</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
