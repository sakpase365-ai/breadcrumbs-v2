import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Loader2, BookOpen, FileText, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Recipient {
  id: string;
  display_name: string;
}

interface Topic {
  id: string;
  name: string;
}

interface DuplicateWarning {
  id: string;
  title: string;
}

export default function CreateBreadcrumb() {
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewTopicDialogOpen, setIsNewTopicDialogOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);

  const [formData, setFormData] = useState({
    recipient_id: "",
    topic_id: "",
    title: "",
    content_type: "text",
    text_body: "",
    is_scripture: false,
    scripture_reference: "",
    scripture_text: "",
    include_commentary: false,
    commentary_text: "",
  });

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
      const [recipientsRes, topicsRes] = await Promise.all([
        supabase
          .from("recipients")
          .select("id, display_name")
          .eq("creator_id", profile.id),
        supabase
          .from("topics")
          .select("id, name")
          .eq("creator_id", profile.id),
      ]);

      if (recipientsRes.error) throw recipientsRes.error;
      if (topicsRes.error) throw topicsRes.error;

      setRecipients(recipientsRes.data || []);
      setTopics(topicsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for duplicates when title or recipient changes
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!profile || !formData.title || !formData.recipient_id) {
        setDuplicateWarning(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("breadcrumbs")
          .select("id, title")
          .eq("creator_id", profile.id)
          .eq("recipient_id", formData.recipient_id)
          .ilike("title", formData.title)
          .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          setDuplicateWarning({ id: data[0].id, title: data[0].title });
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error("Error checking duplicate:", error);
      }
    };

    const debounce = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(debounce);
  }, [formData.title, formData.recipient_id, profile]);

  const handleAddTopic = async () => {
    if (!profile || !newTopicName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("topics")
        .insert({
          creator_id: profile.id,
          name: newTopicName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setTopics([...topics, data]);
      setFormData({ ...formData, topic_id: data.id });
      setNewTopicName("");
      setIsNewTopicDialogOpen(false);

      toast({
        title: "Topic created",
        description: `"${data.name}" has been added.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create topic.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!formData.recipient_id) {
      toast({
        title: "Recipient required",
        description: "Please select who this breadcrumb is for.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please add a title for this breadcrumb.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("breadcrumbs").insert({
        creator_id: profile.id,
        recipient_id: formData.recipient_id,
        topic_id: formData.topic_id || null,
        title: formData.title.trim(),
        content_type: formData.is_scripture ? "scripture" : formData.content_type,
        text_body: formData.text_body || null,
        is_scripture: formData.is_scripture,
        scripture_reference: formData.scripture_reference || null,
        scripture_text: formData.scripture_text || null,
        include_commentary: formData.include_commentary,
        commentary_text: formData.commentary_text || null,
      });

      if (error) throw error;

      toast({
        title: "Breadcrumb created",
        description: "Your wisdom has been saved.",
      });

      navigate("/creator");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create breadcrumb.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="container-narrow flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (recipients.length === 0) {
    return (
      <DashboardLayout>
        <div className="container-narrow text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-xl font-medium text-foreground mb-2">
            Add a recipient first
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            You need to add someone to leave breadcrumbs for before you can create one.
          </p>
          <Link to="/creator/recipients">
            <Button variant="hero">Add a Recipient</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container-narrow">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <Link 
            to="/creator" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            Create Breadcrumb
          </h1>
          <p className="text-muted-foreground mt-1">
            Leave a piece of wisdom for someone you love.
          </p>
        </div>

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <Alert className="mb-6 animate-fade-up border-accent/50 bg-accent/5">
            <AlertCircle className="w-4 h-4 text-accent" />
            <AlertTitle>This looks like a duplicate</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>A similar breadcrumb was recently created: "{duplicateWarning.title}"</span>
              <div className="flex gap-2 mt-2 sm:mt-0">
                <Link to={`/breadcrumb/${duplicateWarning.id}`}>
                  <Button variant="outline" size="sm">View existing</Button>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          className="glass-card p-6 md:p-8 animate-fade-up space-y-6"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Who is this for? *</Label>
            <Select
              value={formData.recipient_id}
              onValueChange={(value) => setFormData({ ...formData, recipient_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a recipient" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <div className="flex gap-2">
              <Select
                value={formData.topic_id}
                onValueChange={(value) => {
                  if (value === "__new__") {
                    setIsNewTopicDialogOpen(true);
                  } else {
                    setFormData({ ...formData, topic_id: value });
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a topic (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-accent">
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      New Topic
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., On handling money when anxious"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Content Type Toggle */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${!formData.is_scripture ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                <FileText className="w-5 h-5" />
              </div>
              <Switch
                checked={formData.is_scripture}
                onCheckedChange={(checked) => setFormData({ ...formData, is_scripture: checked })}
              />
              <div className={`p-2 rounded-lg ${formData.is_scripture ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {formData.is_scripture ? "Scripture" : "Text Note"}
            </span>
          </div>

          {/* Scripture Fields */}
          {formData.is_scripture && (
            <>
              <div className="space-y-2">
                <Label htmlFor="scripture_reference">Scripture Reference</Label>
                <Input
                  id="scripture_reference"
                  placeholder="e.g., Matthew 6:22"
                  value={formData.scripture_reference}
                  onChange={(e) => setFormData({ ...formData, scripture_reference: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scripture_text">Scripture Text (optional)</Label>
                <Textarea
                  id="scripture_text"
                  placeholder="The light of the body is the eye..."
                  value={formData.scripture_text}
                  onChange={(e) => setFormData({ ...formData, scripture_text: e.target.value })}
                  rows={4}
                />
              </div>
            </>
          )}

          {/* Main Content */}
          <div className="space-y-2">
            <Label htmlFor="text_body">
              {formData.is_scripture ? "Your Reflection" : "Your Message"}
            </Label>
            <Textarea
              id="text_body"
              placeholder={formData.is_scripture 
                ? "What does this scripture mean to you? Why is it important?"
                : "Write your wisdom, story, or lesson here..."
              }
              value={formData.text_body}
              onChange={(e) => setFormData({ ...formData, text_body: e.target.value })}
              rows={6}
            />
          </div>

          {/* Include Commentary */}
          <div className="flex items-center justify-between py-4 border-t border-border">
            <div>
              <Label htmlFor="include_commentary" className="cursor-pointer">
                Include Personal Commentary
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add additional context or thoughts beyond your main message.
              </p>
            </div>
            <Switch
              id="include_commentary"
              checked={formData.include_commentary}
              onCheckedChange={(checked) => setFormData({ ...formData, include_commentary: checked })}
            />
          </div>

          {formData.include_commentary && (
            <div className="space-y-2">
              <Label htmlFor="commentary_text">Your Commentary</Label>
              <Textarea
                id="commentary_text"
                placeholder="Add your personal thoughts, context, or additional reflections..."
                value={formData.commentary_text}
                onChange={(e) => setFormData({ ...formData, commentary_text: e.target.value })}
                rows={4}
              />
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link to="/creator">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="hero" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Breadcrumb"
              )}
            </Button>
          </div>
        </form>

        {/* New Topic Dialog */}
        <Dialog open={isNewTopicDialogOpen} onOpenChange={setIsNewTopicDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Create New Topic</DialogTitle>
              <DialogDescription>
                Topics help organize your breadcrumbs by theme.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new_topic_name">Topic Name</Label>
                <Input
                  id="new_topic_name"
                  placeholder="e.g., Faith, Money, Relationships"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewTopicDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="hero" 
                  onClick={handleAddTopic}
                  disabled={!newTopicName.trim()}
                >
                  Create Topic
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
