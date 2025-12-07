import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, User, Trash2, Edit2, Loader2, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Recipient {
  id: string;
  display_name: string;
  email: string | null;
  relationship: string | null;
  created_at: string;
}

export default function ManageRecipients() {
  const { profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    relationship: "",
  });
  const [isSaving, setIsSaving] = useState(false);

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
      fetchRecipients();
    }
  }, [profile, authLoading, navigate]);

  const fetchRecipients = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("recipients")
        .select("*")
        .eq("creator_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecipients(data || []);
    } catch (error) {
      console.error("Error fetching recipients:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);

    try {
      if (editingId) {
        // Update existing recipient
        const { error } = await supabase
          .from("recipients")
          .update({
            display_name: formData.display_name,
            email: formData.email || null,
            relationship: formData.relationship || null,
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Recipient updated",
          description: `${formData.display_name} has been updated.`,
        });
      } else {
        // Create new recipient
        const { error } = await supabase.from("recipients").insert({
          creator_id: profile.id,
          display_name: formData.display_name,
          email: formData.email || null,
          relationship: formData.relationship || null,
        });

        if (error) throw error;

        toast({
          title: "Recipient added",
          description: `${formData.display_name} has been added.`,
        });
      }

      setFormData({ display_name: "", email: "", relationship: "" });
      setEditingId(null);
      setIsDialogOpen(false);
      fetchRecipients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (recipient: Recipient) => {
    setFormData({
      display_name: recipient.display_name,
      email: recipient.email || "",
      relationship: recipient.relationship || "",
    });
    setEditingId(recipient.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("recipients").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Recipient deleted",
        description: "The recipient has been removed.",
      });

      fetchRecipients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete recipient.",
        variant: "destructive",
      });
    }
  };

  const openNewDialog = () => {
    setFormData({ display_name: "", email: "", relationship: "" });
    setEditingId(null);
    setIsDialogOpen(true);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-foreground">
                Your Recipients
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage the people you're leaving breadcrumbs for.
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" className="gap-2" onClick={openNewDialog}>
                  <Plus className="w-4 h-4" />
                  Add Recipient
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">
                    {editingId ? "Edit Recipient" : "Add New Recipient"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId 
                      ? "Update the recipient's information."
                      : "Add someone you want to leave breadcrumbs for."
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Name *</Label>
                    <Input
                      id="display_name"
                      placeholder="e.g., Cairo, My Daughter"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="their.email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      If provided, they can log in to view their breadcrumbs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship (optional)</Label>
                    <Input
                      id="relationship"
                      placeholder="e.g., Son, Daughter, Spouse"
                      value={formData.relationship}
                      onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="hero" disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : editingId ? (
                        "Update"
                      ) : (
                        "Add Recipient"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Recipients List */}
        {recipients.length === 0 ? (
          <div 
            className="text-center py-16 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-xl font-medium text-foreground mb-2">
              No recipients yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Add the people you want to leave breadcrumbs for — your children, spouse, or anyone special.
            </p>
            <Button variant="hero" onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Recipient
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {recipients.map((recipient, index) => (
              <div 
                key={recipient.id} 
                className="glass-card p-5 animate-fade-up"
                style={{ animationDelay: `${0.05 * index}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-medium text-foreground">
                        {recipient.display_name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {recipient.relationship && (
                          <span>{recipient.relationship}</span>
                        )}
                        {recipient.email && (
                          <span className="text-xs">{recipient.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(recipient)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete recipient?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {recipient.display_name} and all breadcrumbs left for them. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(recipient.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
