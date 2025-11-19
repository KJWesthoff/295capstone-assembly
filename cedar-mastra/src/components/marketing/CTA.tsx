import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-primary via-primary to-primary/90 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/20 backdrop-blur-sm mb-8">
            <Shield className="w-10 h-10 text-accent" />
          </div>

          {/* Heading */}
          <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">
            Ready to Secure Your APIs?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Start your free 14-day trial today. No credit card required, no setup hassle.
            See results in minutes.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button size="lg" variant="hero" className="text-lg group">
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              Schedule Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-8 pt-8 border-t border-primary-foreground/20">
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">10,000+</p>
              <p className="text-sm text-primary-foreground/70">APIs Scanned</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">99.9%</p>
              <p className="text-sm text-primary-foreground/70">Accuracy Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent">&lt; 2min</p>
              <p className="text-sm text-primary-foreground/70">Avg Scan Time</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
