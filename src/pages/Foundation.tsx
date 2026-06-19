import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BreadcrumbsLayout } from "@/components/layout/BreadcrumbsLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FOUNDATION_QUESTIONS } from "@/lib/breadcrumbs";
import { LooseSupabase } from "@/lib/supabase-loose";
import { toast } from "sonner";

type FoundationAnswer = {
  category: string;
  answer: string | null;
};

export default function Foundation() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const db = supabase as unknown as LooseSupabase;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
    if (!isLoading && user && !profile) navigate("/setup");
  }, [isLoading, navigate, profile, user]);

  useEffect(() => {
    if (!profile) return;
    db
      .from<FoundationAnswer[]>("family_foundations")
      .select("category, answer")
      .eq("user_id", profile.id)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        (data || []).forEach((row) => {
          next[row.category] = row.answer || "";
        });
        setAnswers(next);
      });
  }, [profile, db]);

  const save = async (key: string) => {
    if (!profile) return;
    setSavingKey(key);
    const { error } = await db.from("family_foundations").upsert(
      {
        user_id: profile.id,
        category: key,
        answer: answers[key] || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category" }
    );
    setSavingKey(null);
    if (error) toast.error(error.message);
    else toast.success("Foundation answer saved.");
  };

  if (isLoading || !profile) return <div className="min-h-screen bg-background" />;

  return (
    <BreadcrumbsLayout>
      <div className="pb-24 sm:pb-0">
        <div className="mb-6 max-w-2xl">
          <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Foundation</p>
          <h1 className="mt-2 font-serif text-4xl font-medium">The ground beneath the stories</h1>
          <p className="mt-3 leading-7 text-muted-foreground">
            These answers help future prompts sound like they know your heart, not just your schedule.
          </p>
        </div>

        <div className="grid gap-4">
          {FOUNDATION_QUESTIONS.map((item, index) => (
            <article key={item.key} className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="flex items-start gap-4">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-2xl font-medium">{item.question}</h2>
                  <Textarea
                    className="mt-4 min-h-32 resize-y bg-background"
                    value={answers[item.key] || ""}
                    onChange={(event) => setAnswers({ ...answers, [item.key]: event.target.value })}
                    placeholder="Write what feels true today..."
                  />
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" onClick={() => save(item.key)} disabled={savingKey === item.key} className="gap-2">
                      <Save className="h-4 w-4" />
                      {savingKey === item.key ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </BreadcrumbsLayout>
  );
}
