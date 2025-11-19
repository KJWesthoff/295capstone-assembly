import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import cyberBearLogo from "@/assets/cyber-bear-logo.png";
import { useToast } from "@/hooks/use-toast";

const ThankYou = () => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const { toast } = useToast();

  const handleRating = (star: number) => {
    setRating(star);
    toast({
      title: "Thank you for your feedback!",
      description: `You rated us ${star} out of 5 stars`,
    });
  };
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-6 bg-card border-border/50">
        <div className="flex justify-center">
          <img 
            src={cyberBearLogo} 
            alt="VentiAPI Cyber Bear" 
            className="w-24 h-24 animate-fade-in"
          />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Thank You!
          </h1>
          <p className="text-lg text-muted-foreground">
            Thank you for using VentiAPI
          </p>
        </div>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {rating > 0 ? `You rated us ${rating} out of 5 stars` : "We'd love to hear your feedback"}
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="text-muted-foreground hover:text-accent transition-all transform hover:scale-110"
                onClick={() => handleRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
              >
                <Star 
                  className={`w-8 h-8 transition-all ${
                    star <= (hoveredStar || rating) 
                      ? 'fill-accent text-accent' 
                      : ''
                  }`} 
                />
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <Link to="/" className="block">
            <Button className="w-full" size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <p className="text-xs text-muted-foreground">
            Stay secure, stay protected
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ThankYou;
