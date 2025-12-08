import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PenLine, Eye, ArrowLeft } from "lucide-react";
import { MinimalLayout } from "@/components/layout/MinimalLayout";

const GetStarted = () => {
  return (
    <MinimalLayout centered maxWidth="md">
      {/* Back Link */}
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-white mb-3">
          How would you like to use Breadcrumbs?
        </h1>
        <p className="text-white/70 mb-10">
          Choose your role to get started.
        </p>

        <div className="grid gap-4 max-w-lg mx-auto">
          <RoleCard
            to="/auth?role=creator"
            icon={<PenLine className="w-6 h-6" />}
            title="I am a Creator"
            description="I want to leave wisdom, messages, and scriptures for my loved ones."
          />
          <RoleCard
            to="/auth?role=recipient"
            icon={<Eye className="w-6 h-6" />}
            title="I am a Recipient"
            description="Someone has left breadcrumbs for me to discover."
          />
        </div>
      </div>
    </MinimalLayout>
  );
};

const RoleCard = ({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Link to={to}>
    <div className="p-6 text-left rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/50 hover:border-white/20 transition-all cursor-pointer group">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100/20 text-amber-100 flex items-center justify-center group-hover:bg-amber-100/30 transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg font-medium text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-white/60">
            {description}
          </p>
        </div>
      </div>
    </div>
  </Link>
);

export default GetStarted;
