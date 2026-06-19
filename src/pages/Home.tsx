import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) navigate("/capture");
  }, [isLoading, navigate, user]);

  if (isLoading || user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="font-serif text-2xl font-medium tracking-tight">
          Breadcrumbs
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button className="gap-2">
              Begin <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl"
        >
          <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
            <LockKeyhole className="h-4 w-4 text-primary" />
            A private family time capsule
          </p>
          <h1 className="font-serif text-5xl font-medium leading-[0.98] tracking-tight text-foreground sm:text-7xl">
            Save the words you do not want time to lose.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Breadcrumbs helps parents write letters, stories, and life lessons for the people they love,
            with gentle AI prompts when the blank page feels too quiet.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Start your family archive <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login-email">
              <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                <Mail className="h-4 w-4" />
                Email fallback
              </Button>
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="relative"
        >
          <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Today’s prompt</p>
                <h2 className="mt-1 font-serif text-2xl">For Cairo, age 8</h2>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="font-serif text-2xl leading-9 text-foreground">
              Write him a letter about something you hope he discovers for himself.
            </p>
            <div className="mt-8 rounded-md bg-background p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                “One day, when you are old enough to wonder whether you belong, I want you to know…”
              </p>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
