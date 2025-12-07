import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Heart, Loader2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") as "creator" | "recipient" | null;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(!role);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Get user profile to determine redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.role === "creator") {
          navigate("/creator");
        } else if (profile?.role === "recipient") {
          navigate("/recipient");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const validateForm = () => {
    try {
      const schema = isLogin 
        ? authSchema.pick({ email: true, password: true })
        : authSchema.extend({ name: z.string().min(2, "Name must be at least 2 characters") });
      
      schema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        // Get profile to determine redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });

        if (profile?.role === "creator") {
          navigate("/creator");
        } else {
          navigate("/recipient");
        }
      } else {
        // Sign up
        const userRole = role || "creator";
        
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.user) {
          // Create profile
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: data.user.id,
              name: formData.name,
              email: formData.email,
              role: userRole,
            });

          if (profileError) throw profileError;

          // If recipient, try to link to existing recipient record by email
          if (userRole === "recipient") {
            await supabase
              .from("recipients")
              .update({ user_id: data.user.id })
              .eq("email", formData.email);
          }

          toast({
            title: "Account created!",
            description: "Welcome to Breadcrumbs.",
          });

          if (userRole === "creator") {
            navigate("/creator");
          } else {
            navigate("/recipient");
          }
        }
      }
    } catch (error: any) {
      let message = error.message || "Something went wrong. Please try again.";
      
      // Handle common auth errors
      if (message.includes("User already registered")) {
        message = "This email is already registered. Try logging in instead.";
      } else if (message.includes("Invalid login credentials")) {
        message = "Invalid email or password. Please try again.";
      }

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Back Link */}
      <div className="container-narrow pt-6">
        <Link 
          to={isLogin ? "/" : "/get-started"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="text-center mb-8 animate-fade-up">
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-xl bg-primary/10">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-2">
              {isLogin ? "Welcome Back" : role === "recipient" ? "Join as Recipient" : "Create Your Account"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin 
                ? "Sign in to continue your journey." 
                : role === "recipient" 
                  ? "Discover the wisdom left for you."
                  : "Start leaving breadcrumbs for your loved ones."
              }
            </p>
          </div>

          <form 
            onSubmit={handleSubmit} 
            className="glass-card p-6 md:p-8 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                variant="hero" 
                size="lg" 
                className="w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
