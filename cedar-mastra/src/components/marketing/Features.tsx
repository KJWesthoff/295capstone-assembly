import { Shield, Gauge, FileSearch, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Shield,
    title: "See Everything at Once",
    description: "Run three powerful scanning engines simultaneously to catch what others miss.",
    color: "text-accent",
  },
  {
    icon: Gauge,
    title: "Analysis, Not Just Alerts",
    description: "Don't just get a list of CVEs. Get RAG-powered context backed by 49,000+ verified security records.",
    color: "text-cyan-500",
  },
  {
    icon: FileSearch,
    title: "See the Attack Path",
    description: "Visual diagrams show exactly how an attacker breaches your API, making abstract risks concrete.",
    color: "text-accent",
  },
  {
    icon: Lock,
    title: "Fix It Faster",
    description: "Stop researching and start fixing. Get verifiable code examples and pull request-ready fixes for your specific stack.",
    color: "text-cyan-500",
  },
  {
    icon: AlertCircle,
    title: "Always Up to Date",
    description: "Our knowledge base self-heals in real-time, fetching new vulnerabilities from GitHub Advisories instantly.",
    color: "text-accent",
  },
  {
    icon: CheckCircle,
    title: "Bridge the Knowledge Gap",
    description: "One scan generates three distinct views, so key stakeholders gets exactly the info they need.",
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
            Turn Vulnerability Data
            <span className="block text-accent mt-2">into Business Action</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            The innovation isn't in detection—it's in translation. We make security tools useful for the whole team.
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
        {/* <div className="text-center mt-16">
          <p className="text-lg text-muted-foreground mb-6">
            Join hundreds of developers securing their APIs with VentiAPI
          </p>
          <div className="inline-flex items-center gap-2 bg-accent/10 px-6 py-3 rounded-full">
            <CheckCircle className="w-5 h-5 text-accent" />
            <span className="text-foreground font-medium">Free 14-day trial • No credit card required</span>
          </div>
        </div> */}
      </div>
    </section>
  );
};

export default Features;
