import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, Users, Search, Filter, Loader2, Sparkles, TrendingUp,
  Mic, BookOpen, Heart, MessageCircle, Clock, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import { BreadcrumbCard } from "@/components/BreadcrumbCard";
import { SwipeableCard } from "@/components/SwipeableCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { QuickCaptureButton } from "@/components/QuickCaptureButton";
import { QuickCaptureModal } from "@/components/QuickCaptureModal";

interface Breadcrumb {
  id: string;
  title: string;
  content_type: string;
  text_body: string | null;
  is_scripture: boolean;
  scripture_reference: string | null;
  created_at: string;
  recipient: { id: string; display_name: string };
  topic: { id: string; name: string } | null;
  recipient_count?: number;
  recipient_names?: string[];
  recipients_info?: { id: string; name: string }[];
}

interface Recipient {
  id: string;
  display_name: string;
}

interface Topic {
  id: string;
  name: string;
}

interface Prompt {
  prompt_type: "story" | "advice" | "values";
  prompt: string;
  suggested_tags: string[];
  estimated_duration?: string;
  related_topics: string[];
}

const promptTypeIcons = {
  story: BookOpen,
  advice: MessageCircle,
  values: Heart,
};

const promptTypeLabels = {
  story: "Story",
  advice: "Advice",
  values: "Values & Faith",
};

const promptTypeColors = {
  story: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  advice: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  values: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export default function CreatorDashboard() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [familyId, setFamilyId] = useState<string | undefined>(undefined);

  // Prompts state
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [topicGaps, setTopicGaps] = useState<string[]>([]);
  const [isPromptsLoading, setIsPromptsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllBreadcrumbs, setShowAllBreadcrumbs] = useState(false);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }
    if (profile && profile.role !== "creator") {
      navigate("/recipient");
      return;
    }
    if (profile) {
      fetchData();
    }
  }, [profile, authLoading, navigate]);

  const fetchData = async () => {
    if (!profile) return;
    try {
      const { data: breadcrumbsData, error: breadcrumbsError } = await supabase
        .from("breadcrumbs")
        .select(`id, title, content_type, text_body, is_scripture, scripture_reference, created_at, recipient:recipients(id, display_name), topic:topics(id, name)`)
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false });
      if (breadcrumbsError) throw breadcrumbsError;

      const breadcrumbIds = (breadcrumbsData || []).map(b => b.id);
      let recipientData: Record<string, { count: number; names: string[]; info: { id: string; name: string }[] }> = {};
      
      if (breadcrumbIds.length > 0) {
        const { data: recipientLinks } = await supabase
          .from("breadcrumb_recipients")
          .select("breadcrumb_id, recipient:recipients(id, display_name)")
          .in("breadcrumb_id", breadcrumbIds);
        
        if (recipientLinks) {
          recipientLinks.forEach(link => {
            if (!recipientData[link.breadcrumb_id]) {
              recipientData[link.breadcrumb_id] = { count: 0, names: [], info: [] };
            }
            recipientData[link.breadcrumb_id].count++;
            const recipient = link.recipient as any;
            if (recipient?.display_name) {
              recipientData[link.breadcrumb_id].names.push(recipient.display_name);
              recipientData[link.breadcrumb_id].info.push({ id: recipient.id, name: recipient.display_name });
            }
          });
        }
      }

      const breadcrumbsWithCounts = (breadcrumbsData || []).map(b => ({
        ...b,
        recipient_count: recipientData[b.id]?.count || 1,
        recipient_names: recipientData[b.id]?.names || [],
        recipients_info: recipientData[b.id]?.info || []
      }));

      const { data: recipientsData } = await supabase
        .from("recipients").select("id, display_name").eq("creator_id", profile.id);
      const { data: topicsData } = await supabase
        .from("topics").select("id, name").eq("is_active", true).order("sort_order");

      const { data: familyData } = await supabase.rpc("get_user_family_id", { _user_id: profile.user_id });
      if (familyData) setFamilyId(familyData);

      setBreadcrumbs(breadcrumbsWithCounts as any || []);
      setRecipients(recipientsData || []);
      setTopics(topicsData || []);

      // Generate prompts
      generatePrompts(recipientsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrompts = async (recipientsList: Recipient[]) => {
    setIsRefreshing(true);
    try {
      const beneficiaryNames = recipientsList.map(r => r.display_name);
      const response = await supabase.functions.invoke("capture-breadcrumb", {
        body: {
          action: "generate_prompts",
          relationship: "Parent to children",
          beneficiaries: beneficiaryNames.length > 0 ? beneficiaryNames : ["Family"],
        },
      });
      if (response.error) throw new Error(response.error.message);
      setPrompts(response.data.prompts || []);
      setTopicGaps(response.data.topic_gaps || []);
    } catch (error) {
      console.error("Error generating prompts:", error);
    } finally {
      setIsRefreshing(false);
      setIsPromptsLoading(false);
    }
  };

  const handleStartRecording = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleBreadcrumbSaved = () => {
    fetchData();
  };

  const filteredBreadcrumbs = breadcrumbs.filter(b => {
    const matchesSearch = !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.text_body?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRecipient = selectedRecipient === "all" || b.recipient?.id === selectedRecipient || b.recipients_info?.some(r => r.id === selectedRecipient);
    const matchesTopic = selectedTopic === "all" || b.topic?.id === selectedTopic;
    return matchesSearch && matchesRecipient && matchesTopic;
  });

  const displayedBreadcrumbs = showAllBreadcrumbs ? filteredBreadcrumbs : filteredBreadcrumbs.slice(0, 3);

  const handleRecipientFilter = (recipientId: string) => {
    setSelectedRecipient(recipientId);
  };

  const handleDeleteBreadcrumb = async (breadcrumbId: string) => {
    if (deletingIds.has(breadcrumbId)) return;
    setDeletingIds(prev => new Set(prev).add(breadcrumbId));
    try {
      await supabase.from("breadcrumb_recipients").delete().eq("breadcrumb_id", breadcrumbId);
      await supabase.from("breadcrumb_scriptures").delete().eq("breadcrumb_id", breadcrumbId);
      const { error } = await supabase.from("breadcrumbs").delete().eq("id", breadcrumbId);
      if (error) throw error;
      setBreadcrumbs(prev => prev.filter(b => b.id !== breadcrumbId));
      toast.success("Breadcrumb deleted");
    } catch (error) {
      console.error("Error deleting breadcrumb:", error);
      toast.error("Failed to delete breadcrumb");
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(breadcrumbId); return next; });
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-white">
            Welcome, {profile?.name?.split(" ")[0]}
          </h1>
          <p className="text-white/60 mt-1">
            What wisdom would you like to share today?
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link to="/creator/progress">
            <Button variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Progress</span>
            </Button>
          </Link>
          <Link to="/creator/recipients">
            <Button variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Recipients</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link to="/creator/create" className="block">
          <Card className="bg-primary/10 border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Create Breadcrumb</p>
                <p className="text-xs text-muted-foreground mt-1">Step-by-step guided flow</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card 
          className="bg-accent/10 border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer h-full"
          onClick={() => { setSelectedPrompt(null); setIsModalOpen(true); }}
        >
          <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
              <Mic className="w-6 h-6 text-accent-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Quick Capture</p>
              <p className="text-xs text-muted-foreground mt-1">Text or voice note</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prompts Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-serif font-semibold text-foreground">Recording Prompts</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generatePrompts(recipients)}
              disabled={isRefreshing}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link to="/creator/prompts">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                View All
              </Button>
            </Link>
          </div>
        </div>

        {/* Topic Gaps */}
        {topicGaps.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Topics needing your wisdom:</p>
            <div className="flex flex-wrap gap-1.5">
              {topicGaps.map(topic => (
                <Badge key={topic} variant="secondary" className="text-xs">{topic}</Badge>
              ))}
            </div>
          </div>
        )}

        {isPromptsLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : prompts.length > 0 ? (
          <div className="grid gap-3">
            {prompts.map((prompt, index) => {
              const Icon = promptTypeIcons[prompt.prompt_type];
              const label = promptTypeLabels[prompt.prompt_type];
              const colorClass = promptTypeColors[prompt.prompt_type];

              return (
                <Card
                  key={index}
                  className="group hover:shadow-md transition-all duration-200 cursor-pointer border-border/50"
                  onClick={() => handleStartRecording(prompt)}
                >
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${colorClass}`}>{label}</Badge>
                          {prompt.estimated_duration && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {prompt.estimated_duration}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                          {prompt.prompt}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 gap-1 opacity-70 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); handleStartRecording(prompt); }}
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Record</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-8 text-center">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Generate personalized prompts to guide your recording</p>
              <Button size="sm" onClick={() => generatePrompts(recipients)} disabled={isRefreshing}>
                Generate Prompts
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Breadcrumbs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif font-semibold text-foreground">
            Recent Breadcrumbs
            {breadcrumbs.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">({breadcrumbs.length})</span>
            )}
          </h2>
        </div>

        {/* Compact Filters */}
        {breadcrumbs.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-secondary/50 border-border"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                <SelectTrigger className="w-[130px] h-9 text-sm bg-secondary/50 border-border">
                  <SelectValue placeholder="All Recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Recipients</SelectItem>
                  {recipients.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="w-[110px] h-9 text-sm bg-secondary/50 border-border">
                  <SelectValue placeholder="All Topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {topics.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {filteredBreadcrumbs.length === 0 ? (
          <div className="text-center py-12">
            {breadcrumbs.length === 0 ? (
              <>
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">No breadcrumbs yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                  {recipients.length === 0
                    ? "Add a recipient first, then start leaving wisdom."
                    : "Use a prompt above or create your first breadcrumb."}
                </p>
                <Link to={recipients.length === 0 ? "/creator/recipients" : "/creator/create"}>
                  <Button size="sm">
                    {recipients.length === 0 ? "Add a Recipient" : "Create Breadcrumb"}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-serif text-lg font-medium text-foreground mb-1">No matching breadcrumbs</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {displayedBreadcrumbs.map(breadcrumb => (
                isMobile ? (
                  <SwipeableCard
                    key={breadcrumb.id}
                    onDelete={() => handleDeleteBreadcrumb(breadcrumb.id)}
                    disabled={deletingIds.has(breadcrumb.id)}
                  >
                    <BreadcrumbCard breadcrumb={breadcrumb} showRecipient onRecipientClick={handleRecipientFilter} />
                  </SwipeableCard>
                ) : (
                  <BreadcrumbCard
                    key={breadcrumb.id}
                    breadcrumb={breadcrumb}
                    showRecipient
                    onRecipientClick={handleRecipientFilter}
                  />
                )
              ))}
            </div>
            {filteredBreadcrumbs.length > 3 && (
              <Button
                variant="ghost"
                className="w-full mt-3 gap-2 text-muted-foreground"
                onClick={() => setShowAllBreadcrumbs(!showAllBreadcrumbs)}
              >
                {showAllBreadcrumbs ? (
                  <>Show Less <ChevronUp className="w-4 h-4" /></>
                ) : (
                  <>View All {filteredBreadcrumbs.length} Breadcrumbs <ChevronDown className="w-4 h-4" /></>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Quick Capture Floating Button */}
      {profile && recipients.length > 0 && (
        <QuickCaptureButton
          recipients={recipients}
          creatorId={profile.id}
          familyId={familyId}
          onSuccess={fetchData}
        />
      )}

      {/* Quick Capture Modal from prompts */}
      {profile?.id && (
        <QuickCaptureModal
          open={isModalOpen}
          onOpenChange={(open) => !open && handleModalClose()}
          recipients={recipients}
          familyId={familyId}
          creatorId={profile.id}
          onSuccess={handleBreadcrumbSaved}
          initialPrompt={selectedPrompt?.prompt}
          initialTags={selectedPrompt?.suggested_tags}
        />
      )}
    </DashboardLayout>
  );
}
