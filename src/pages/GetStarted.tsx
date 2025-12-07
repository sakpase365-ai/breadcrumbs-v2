import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PenLine, Eye, ArrowLeft } from "lucide-react";

const GetStarted = () => {
  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Back Link */}
      <div className="container-narrow pt-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="container-narrow">
          <div className="text-center animate-fade-up max-w-lg mx-auto">
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-4">
              How would you like to use Breadcrumbs?
            </h1>
            <p className="text-muted-foreground mb-10">
              Choose your role to get started.
            </p>

            <div className="grid gap-4">
              <RoleCard
                to="/auth?role=creator"
                icon={<PenLine className="w-6 h-6" />}
                title="I am a Creator"
                description="I want to leave wisdom, messages, and scriptures for my loved ones."
                delay="0.1s"
              />
              <RoleCard
                to="/auth?role=recipient"
                icon={<Eye className="w-6 h-6" />}
                title="I am a Recipient"
                description="Someone has left breadcrumbs for me to discover."
                delay="0.2s"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoleCard = ({
  to,
  icon,
  title,
  description,
  delay,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}) => (
  <Link to={to}>
    <div 
      className="glass-card p-6 text-left hover:border-accent/50 hover:shadow-warm transition-all duration-300 cursor-pointer animate-fade-up group"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg font-medium text-foreground mb-1">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  </Link>
);

export default GetStarted;
