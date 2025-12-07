import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Users, BookOpen, MessageCircle } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen gradient-hero">
      {/* Hero Section */}
      <div className="container-narrow pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="text-center animate-fade-up">
          {/* Logo/Brand */}
          <div className="inline-flex items-center justify-center w-16 h-16 mb-8 rounded-2xl bg-primary/10">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-serif font-semibold text-foreground mb-6 leading-tight">
            Breadcrumbs
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Wisdom, stories, and scriptures from the people you love — preserved for generations.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/get-started">
              <Button variant="hero" size="xl">
                Get Started
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero-outline" size="xl">
                Log In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div 
          className="grid md:grid-cols-3 gap-6 mt-16"
          style={{ animationDelay: "0.2s" }}
        >
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="For Your Loved Ones"
            description="Leave personalized messages, lessons, and wisdom for your children, spouse, or anyone you cherish."
            delay="0.1s"
          />
          <FeatureCard
            icon={<BookOpen className="w-6 h-6" />}
            title="Scripture & Stories"
            description="Share scriptures that shaped you, along with your personal commentary and life lessons."
            delay="0.2s"
          />
          <FeatureCard
            icon={<MessageCircle className="w-6 h-6" />}
            title="AI-Powered Questions"
            description="Recipients can ask questions and get answers drawn only from the wisdom you've shared."
            delay="0.3s"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container-narrow text-center text-sm text-muted-foreground">
          <p>Leave a legacy of love and wisdom.</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ 
  icon, 
  title, 
  description, 
  delay 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  delay: string;
}) => (
  <div 
    className="glass-card p-6 text-center animate-fade-up"
    style={{ animationDelay: delay }}
  >
    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 text-accent mb-4">
      {icon}
    </div>
    <h3 className="font-serif text-lg font-medium text-foreground mb-2">
      {title}
    </h3>
    <p className="text-sm text-muted-foreground leading-relaxed">
      {description}
    </p>
  </div>
);

export default Landing;
