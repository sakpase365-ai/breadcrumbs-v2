import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    localStorage.setItem("breadcrumbs_pending_phone", phone);
    localStorage.setItem("breadcrumbs_pending_email", email);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/setup`,
        data: { phone },
      },
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

      {sent ? (
        <section className="rounded-lg border border-border bg-card p-6 shadow-card">
          <MailCheck className="mb-4 h-9 w-9 text-primary" />
          <h1 className="font-serif text-3xl font-medium">Check your email</h1>
          <p className="mt-3 leading-7 text-muted-foreground">
            We sent a magic link to {email}. Open it on this device and Breadcrumbs will continue
            to your family setup.
          </p>
          <p className="mt-5 text-sm text-muted-foreground">SMS verification is collected now and completed during setup.</p>
        </section>
      ) : (
        <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 shadow-card">
          <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Step 1 of 3</p>
          <h1 className="mt-2 font-serif text-4xl font-medium">Begin Breadcrumbs</h1>
          <p className="mt-3 leading-7 text-muted-foreground">
            Start with the two ways we can protect access to your private family archive.
          </p>

          <div className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          </div>

          <Button type="submit" className="mt-7 w-full" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already started? <Link className="text-primary underline-offset-4 hover:underline" to="/login">Log in</Link>
          </p>
        </form>
      )}
    </main>
  );
}
