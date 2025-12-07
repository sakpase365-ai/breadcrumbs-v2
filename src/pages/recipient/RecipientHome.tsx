import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, BookOpen, Filter, Loader2, MessageCircle, Sparkles, Send } from "lucide-react";
import { BreadcrumbCard } from "@/components/BreadcrumbCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Breadcrumb {
  id: string;
  title: string;
  content_type: string;
  text_body: string | null;
  is_scripture: boolean;
  scripture_reference: string | null;
  created_at: string;
  creator: {
    id: string;
    name: string;
  };
  topic: {
    id: string;
    name: string;
  } | null;
}

interface Topic {
  id: string;
  name: string;
}

interface RecipientRecord {
  id: string;
  display_name: string;
  creator_id: string;
}

export default function RecipientHome() {
  const { profile, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [recipientRecord, setRecipientRecord] = useState<RecipientRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [scripturesOnly, setScripturesOnly] = useState(false);

  // AI Question state
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }

    if (profile && profile.role !== "recipient") {
      navigate("/creator");
      return;
    }

    if (user) {
      fetchData();
    }
  }, [profile, user, authLoading, navigate]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // First, find the recipient record linked to this user
      const { data: recipientData, error: recipientError } = await supabase
        .from("recipients")
        .select("id, display_name, creator_id")
        .eq("user_id", user.id)
        .single();

      if (recipientError || !recipientData) {
        // No recipient record found
        setRecipientRecord(null);
        setIsLoading(false);
        return;
      }

      setRecipientRecord(recipientData);

      // Fetch breadcrumbs for this recipient with creator info
      const { data: breadcrumbsData, error: breadcrumbsError } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          content_type,
          text_body,
          is_scripture,
          scripture_reference,
          created_at,
          topic:topics(id, name),
          creator:profiles!breadcrumbs_creator_id_fkey(id, name)
        `)
        .eq("recipient_id", recipientData.id)
        .order("created_at", { ascending: false });

      if (breadcrumbsError) throw breadcrumbsError;

      // Extract unique topics
      const uniqueTopics = new Map<string, Topic>();
      breadcrumbsData?.forEach((b: any) => {
        if (b.topic) {
          uniqueTopics.set(b.topic.id, b.topic);
        }
      });

      setBreadcrumbs(breadcrumbsData as any || []);
      setTopics(Array.from(uniqueTopics.values()));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !recipientRecord) return;

    setIsAsking(true);
    setAiAnswer("");

    try {
      // For now, we'll show a placeholder. 
      // The AI functionality will be implemented with an edge function
      const response = await supabase.functions.invoke("ask-breadcrumbs", {
        body: {
          question: question.trim(),
          recipientId: recipientRecord.id,
        },
      });

      if (response.error) throw response.error;

      setAiAnswer(response.data?.answer || "I couldn't find an answer in the breadcrumbs left for you.");

      // Save the question
      await supabase.from("questions").insert({
        recipient_id: recipientRecord.id,
        question_text: question.trim(),
        ai_answer_text: response.data?.answer || null,
      });
    } catch (error: any) {
      console.error("Error asking question:", error);
      toast({
        title: "Error",
        description: "Failed to get an answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAsking(false);
    }
  };

  // Filter breadcrumbs
  const filteredBreadcrumbs = breadcrumbs.filter((b) => {
    const matchesSearch = 
      !searchQuery ||
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.text_body?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTopic = 
      selectedTopic === "all" || 
      b.topic?.id === selectedTopic;
    
    const matchesScripture = 
      !scripturesOnly || 
      b.is_scripture;

    return matchesSearch && matchesTopic && matchesScripture;
  });

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="container-wide flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!recipientRecord) {
    return (
      <DashboardLayout>
        <div className="container-narrow text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-medium text-foreground mb-2">
            No breadcrumbs yet
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            It looks like no one has added you as a recipient yet. Ask your loved ones to add you using your email: <strong>{profile?.email}</strong>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container-wide">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            Hi, {profile?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here are breadcrumbs that were left for you.
          </p>
        </div>

        {/* Ask a Question */}
        <div 
          className="glass-card p-6 mb-8 animate-fade-up"
          style={{ animationDelay: "0.05s" }}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg font-medium text-foreground mb-1">
                Ask a Question
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get answers based only on the wisdom that was left for you.
              </p>
              <div className="space-y-4">
                <Textarea
                  placeholder="What question do you have? (e.g., What did they say about handling money?)"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button 
                    variant="hero" 
                    onClick={handleAskQuestion}
                    disabled={!question.trim() || isAsking}
                  >
                    {isAsking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Get Answer
                      </>
                    )}
                  </Button>
                </div>

                {aiAnswer && (
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Answer:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {aiAnswer}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div 
          className="glass-card p-4 mb-6 animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search breadcrumbs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 pl-2">
                <Switch
                  id="scriptures-only"
                  checked={scripturesOnly}
                  onCheckedChange={setScripturesOnly}
                />
                <Label htmlFor="scriptures-only" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Scriptures
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Breadcrumbs List */}
        {filteredBreadcrumbs.length === 0 ? (
          <div 
            className="text-center py-16 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            {breadcrumbs.length === 0 ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-xl font-medium text-foreground mb-2">
                  No breadcrumbs yet
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Your loved ones haven't left any breadcrumbs for you yet. Check back soon!
                </p>
              </>
            ) : (
              <>
                <Filter className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-serif text-xl font-medium text-foreground mb-2">
                  No matching breadcrumbs
                </h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search query.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {filteredBreadcrumbs.map((breadcrumb, index) => (
              <BreadcrumbCard
                key={breadcrumb.id}
                breadcrumb={breadcrumb}
                showCreator
                style={{ animationDelay: `${0.05 * index}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
