import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mic, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BreadcrumbsLayout } from "@/components/layout/BreadcrumbsLayout";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EntryAnalysis, FALLBACK_PROMPTS, FamilyMember, fallbackAnalysis, getAge } from "@/lib/breadcrumbs";
import { LooseSupabase } from "@/lib/supabase-loose";
import { toast } from "sonner";

const draftKey = "breadcrumbs_capture_draft";

export default function Capture() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const db = supabase as unknown as LooseSupabase;
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [content, setContent] = useState(() => localStorage.getItem(draftKey) || "");
  const [mode, setMode] = useState<"write" | "record">("write");
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const chosen = useMemo(() => members.find((member) => member.id === selectedMember), [members, selectedMember]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    if (!authLoading && user && !profile) navigate("/setup");
  }, [authLoading, navigate, profile, user]);

  useEffect(() => {
    if (!profile) return;

    const load = async () => {
      const { data } = await db
        .from<FamilyMember[]>("recipients")
        .select("id, display_name, relationship, date_of_birth")
        .eq("creator_id", profile.id)
        .order("created_at");
      const list = (data || []) as FamilyMember[];
      setMembers(list);
      setSelectedMember(list[0]?.id || "");
    };

    load();
  }, [profile, db]);

  useEffect(() => {
    if (!profile) return;

    const generate = async () => {
      setPromptLoading(true);
      const fallback = FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
      try {
        const { data, error } = await supabase.functions.invoke("generate-prompt", {
          body: { profile, family_members: members },
        });
        if (error) throw error;
        setPrompt(data?.prompt || fallback);
      } catch {
        const first = members[0];
        const age = getAge(first?.date_of_birth);
        setPrompt(first ? `${first.display_name}${age !== null ? ` is ${age} years old` : ""}. ${fallback}` : fallback);
      } finally {
        setPromptLoading(false);
      }
    };

    generate();
  }, [members, profile]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      localStorage.setItem(draftKey, content);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [content]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || !selectedMember || !content.trim()) {
      toast.error("Choose a family member and write a breadcrumb before saving.");
      return;
    }

    setSaving(true);
    try {
      let analysis: EntryAnalysis;
      try {
        const { data, error } = await supabase.functions.invoke("save-entry", {
          body: {
            content,
            prompt,
            family_member: chosen,
            profile,
          },
        });
        if (error) throw error;
        analysis = data as EntryAnalysis;
      } catch {
        analysis = fallbackAnalysis(content);
      }

      const title = `${analysis.breadcrumb_type} for ${chosen?.display_name || "family"}`;
      const { error } = await db.from("breadcrumbs").insert({
        creator_id: profile.id,
        recipient_id: selectedMember,
        family_member_id: selectedMember,
        title,
        content_type: mode === "record" ? "voice_note" : "text",
        text_body: content.trim(),
        visibility: "family_private",
        breadcrumb_type: analysis.breadcrumb_type,
        tags: analysis.tags,
        domain: analysis.domain,
        relevant_age: analysis.relevant_age,
        delivery_type: "future_reading",
      });
      if (error) throw error;

      localStorage.removeItem(draftKey);
      setContent("");
      toast.success("Breadcrumb saved.", {
        description: analysis.follow_up_question,
        duration: 9000,
      });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save this breadcrumb.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !profile) return <div className="min-h-screen bg-background" />;

  return (
    <BreadcrumbsLayout>
      <form onSubmit={save} className="mx-auto max-w-3xl pb-24 sm:pb-0">
        <section
          className={`rounded-lg border border-border bg-card p-5 shadow-card transition-opacity duration-500 sm:p-7 ${
            content ? "opacity-50" : "opacity-100"
          }`}
        >
          <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Prompt
          </div>
          {promptLoading ? (
            <div className="flex items-center gap-3 font-serif text-2xl text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              thinking...
            </div>
          ) : (
            <p className="font-serif text-2xl leading-9 sm:text-3xl sm:leading-10">{prompt}</p>
          )}
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <ToggleGroup type="single" value={mode} onValueChange={(value) => value && setMode(value as "write" | "record")} className="rounded-md border border-border bg-card p-1">
            <ToggleGroupItem value="write" aria-label="Write" className="gap-2">
              <PenLine className="h-4 w-4" />
              Write
            </ToggleGroupItem>
            <ToggleGroupItem value="record" aria-label="Record" className="gap-2">
              <Mic className="h-4 w-4" />
              Record
            </ToggleGroupItem>
          </ToggleGroup>

          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-[12rem] bg-card">
              <SelectValue placeholder="Address to..." />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <section className="mt-5 rounded-lg border border-border bg-card p-3 shadow-card sm:p-5">
          {mode === "record" && (
            <div className="mb-4 rounded-md border border-border bg-background p-4">
              <VoiceRecorder
                onRecordingComplete={() => toast.info("Voice capture is ready for storage once transcription is connected.")}
                onRemove={() => toast.info("Voice note removed.")}
              />
            </div>
          )}
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={promptLoading ? "Waiting for your prompt..." : "Write your response here..."}
            className="min-h-[42vh] resize-none border-0 bg-transparent p-2 font-serif text-xl leading-9 shadow-none focus-visible:ring-0"
          />
        </section>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Draft autosaves on this device.</p>
          <Button type="submit" disabled={saving || promptLoading}>
            {saving ? "Saving..." : "Save breadcrumb"}
          </Button>
        </div>
      </form>
    </BreadcrumbsLayout>
  );
}
