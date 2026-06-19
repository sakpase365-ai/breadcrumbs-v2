import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Login() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) navigate("/capture");
  }, [isLoading, navigate, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/capture` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Mail className="mb-4 h-8 w-8 text-primary" />
        <h1 className="font-serif text-4xl font-medium">Welcome back</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Enter your email and we’ll send a private magic link back to your writing space.
        </p>
        <div className="mt-7 space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <Button type="submit" className="mt-7 w-full" disabled={loading || sent}>
          {sent ? "Magic link sent" : loading ? "Sending..." : "Send login link"}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to Breadcrumbs? <Link className="text-primary underline-offset-4 hover:underline" to="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
