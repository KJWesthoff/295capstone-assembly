import { Button } from "@/components/ui/button";
import { Shield, Lock, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import cyberBearLogo from "@/assets/cyber-bear-logo.png";
import heroSecurity from "@/assets/hero-security.png";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src={heroSecurity}
          alt="API Security Shield"
          fill
          className="object-cover opacity-20"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/90" />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left space-y-8">
            <div className="inline-flex items-center gap-4 mb-6">
              <Image
                src={cyberBearLogo}
                alt="VentiAPI Cyber Bear Logo"
                width={80}
                height={80}
                className="drop-shadow-2xl"
              />
              <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground">
                VentiAPI
              </h1>
            </div>

            <h2 className="text-4xl md:text-6xl font-bold text-primary-foreground leading-tight">
              Secure Your APIs
              <span className="block text-accent mt-2">Without the Complexity</span>
            </h2>

            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl">
              Simple, powerful REST API security scanning designed for everyone. 
              Detect vulnerabilities, ensure compliance, and protect your data—no cybersecurity expertise required.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
              <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <Shield className="w-5 h-5 text-accent" />
                <span className="text-primary-foreground font-medium">Instant Scanning</span>
              </div>
              <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <Lock className="w-5 h-5 text-accent" />
                <span className="text-primary-foreground font-medium">Zero Config</span>
              </div>
              <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <Zap className="w-5 h-5 text-accent" />
                <span className="text-primary-foreground font-medium">Real-time Results</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <Link href="/security">
                <Button
                  size="lg"
                  variant="hero"
                  className="text-lg w-full sm:w-auto"
                >
                  Get Started
                </Button>
              </Link>
              <Link href="/security">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary w-full sm:w-auto"
                >
                  Try Demo
                </Button>
              </Link>
            </div>

            {/* Sign In Link */}
            <p className="text-sm text-primary-foreground/80 text-center lg:text-left">
              Ready to scan?{" "}
              <Link href="/security" className="text-accent hover:text-accent/80 underline font-medium">
                Go to Dashboard
              </Link>
            </p>

            {/* Trust Badge */}
            <p className="text-sm text-primary-foreground/70 pt-4">
              AI-powered
            </p>
          </div>

          {/* Right Column - Logo Display */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative w-80 h-80">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-3xl animate-pulse" />
              <Image
                src={cyberBearLogo}
                alt="VentiAPI Cyber Bear"
                width={320}
                height={320}
                className="relative drop-shadow-2xl animate-float"
              />
              {/* Scanning Animation Overlay */}
              <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                <div className="scan-line" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-auto">
          <path
            fill="hsl(var(--background))"
            fillOpacity="1"
            d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          ></path>
        </svg>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes scan {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }
        
        .scan-line {
          position: absolute;
          width: 100%;
          height: 60px;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(253, 181, 21, 0.6),
            rgba(253, 181, 21, 0.8),
            rgba(253, 181, 21, 0.6),
            transparent
          );
          box-shadow: 
            0 0 30px rgba(253, 181, 21, 0.9),
            0 0 60px rgba(253, 181, 21, 0.6),
            0 0 90px rgba(253, 181, 21, 0.3);
          animation: scan 3s ease-in-out infinite;
          animation-delay: 0.5s;
        }
      `}</style>
    </section>
  );
};

export default Hero;
