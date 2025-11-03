import { Upload, Search, FileCheck } from "lucide-react";

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Connect Your API",
    description: "Simply provide your API endpoint URL or upload your OpenAPI specification. No complex configuration needed.",
  },
  {
    icon: Search,
    number: "02",
    title: "Automated Scanning",
    description: "VentiAPI automatically tests your endpoints for vulnerabilities, authentication issues, and security misconfigurations.",
  },
  {
    icon: FileCheck,
    number: "03",
    title: "Get Actionable Results",
    description: "Receive clear, prioritized reports with step-by-step remediation guides written for all skill levels.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Security in Three
            <span className="block text-accent mt-2">Simple Steps</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No security degree required. Get comprehensive API security in minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector Line (hidden on mobile, visible on md+) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-accent to-transparent -translate-x-1/2 z-0" />
              )}

              {/* Step Card */}
              <div className="relative bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border">
                {/* Number Badge */}
                <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-accent text-accent-foreground font-bold text-xl flex items-center justify-center shadow-lg">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-6">
                  <step.icon className="w-8 h-8 text-accent" />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-card-foreground mb-4">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-16 max-w-2xl mx-auto">
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
            <p className="text-foreground font-medium">
              🚀 Average scan time: <span className="text-accent font-bold">Under 2 minutes</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              From connection to comprehensive report in less time than it takes to make coffee
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
