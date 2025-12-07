import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, FileText, Calendar, User, Quote, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface BreadcrumbDetail {
  id: string;
  title: string;
  content_type: string;
  text_body: string | null;
  is_scripture: boolean;
  scripture_reference: string | null;
  scripture_text: string | null;
  include_commentary: boolean;
  commentary_text: string | null;
  created_at: string;
  updated_at: string;
  recipient: {
    id: string;
    display_name: string;
  };
  topic: {
    id: string;
    name: string;
  } | null;
  creator: {
    id: string;
    name: string;
  };
}

export default function BreadcrumbDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }

    if (profile && id) {
      fetchBreadcrumb();
    }
  }, [profile, id, authLoading, navigate]);

  const fetchBreadcrumb = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          content_type,
          text_body,
          is_scripture,
          scripture_reference,
          scripture_text,
          include_commentary,
          commentary_text,
          created_at,
          updated_at,
          recipient:recipients(id, display_name),
          topic:topics(id, name),
          creator:profiles!breadcrumbs_creator_id_fkey(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setBreadcrumb(data as any);
    } catch (err: any) {
      console.error("Error fetching breadcrumb:", err);
      setError("This breadcrumb could not be found or you don't have access to it.");
    } finally {
      setIsLoading(false);
    }
  };

  const backPath = profile?.role === "creator" ? "/creator" : "/recipient";

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="container-narrow flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !breadcrumb) {
    return (
      <DashboardLayout>
        <div className="container-narrow text-center py-16">
          <h3 className="font-serif text-xl font-medium text-foreground mb-2">
            {error || "Breadcrumb not found"}
          </h3>
          <Link to={backPath}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container-narrow">
        {/* Back Link */}
        <Link 
          to={backPath}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 animate-fade-up"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Header */}
        <div className="mb-8 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              {breadcrumb.is_scripture ? (
                <BookOpen className="w-6 h-6" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">
                {breadcrumb.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                {profile?.role === "creator" && breadcrumb.recipient && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    For {breadcrumb.recipient.display_name}
                  </span>
                )}
                {profile?.role === "recipient" && breadcrumb.creator && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    From {breadcrumb.creator.name}
                  </span>
                )}
                {breadcrumb.topic && (
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                    {breadcrumb.topic.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(breadcrumb.created_at), "MMMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scripture Reference */}
        {breadcrumb.is_scripture && breadcrumb.scripture_reference && (
          <div 
            className="glass-card p-6 mb-6 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-start gap-3">
              <Quote className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
              <div>
                <p className="font-serif text-lg font-medium text-foreground mb-2">
                  {breadcrumb.scripture_reference}
                </p>
                {breadcrumb.scripture_text && (
                  <p className="text-muted-foreground italic leading-relaxed">
                    "{breadcrumb.scripture_text}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {breadcrumb.text_body && (
          <div 
            className="glass-card p-6 mb-6 animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            <h3 className="font-serif text-lg font-medium text-foreground mb-4">
              {breadcrumb.is_scripture ? "Reflection" : "Message"}
            </h3>
            <div className="prose prose-stone max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {breadcrumb.text_body}
              </p>
            </div>
          </div>
        )}

        {/* Commentary */}
        {breadcrumb.include_commentary && breadcrumb.commentary_text && (
          <div 
            className="glass-card p-6 animate-fade-up border-l-4 border-accent"
            style={{ animationDelay: "0.2s" }}
          >
            <h3 className="font-serif text-lg font-medium text-foreground mb-4">
              Personal Commentary
            </h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {breadcrumb.commentary_text}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
