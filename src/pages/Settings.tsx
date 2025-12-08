import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, User } from "lucide-react";

export default function Settings() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your changes have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password changed",
        description: "Your password has been updated.",
      });

      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const backPath = profile?.role === "creator" ? "/creator" : "/recipient";

  return (
    <DashboardLayout>
      {/* Back Link */}
      <Link 
        to={backPath}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-serif font-semibold text-white">
          Settings
        </h1>
        <p className="text-white/60 mt-1">
          Manage your account and preferences.
        </p>
      </div>

      {/* Profile Info */}
      <div className="p-6 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
            <User className="w-8 h-8 text-white/60" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-medium text-white">
              {profile?.name}
            </h2>
            <p className="text-sm text-white/60">
              {profile?.email} · <span className="capitalize">{profile?.role}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/80">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">Email</Label>
            <Input
              id="email"
              value={profile?.email || ""}
              disabled
              className="bg-white/5 border-white/10 text-white/50"
            />
            <p className="text-xs text-white/40">
              Email cannot be changed.
            </p>
          </div>
          <Button 
            type="submit" 
            className="bg-amber-100 text-amber-950 hover:bg-amber-200"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </div>

      {/* Change Password */}
      <div className="p-6 mb-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <h3 className="font-serif text-lg font-medium text-white mb-4">
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password" className="text-white/80">New Password</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <Button 
            type="submit" 
            variant="outline" 
            className="border-white/20 text-white hover:bg-white/10"
            disabled={isChangingPassword}
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </form>
      </div>

      {/* Sign Out */}
      <div className="p-6 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10">
        <h3 className="font-serif text-lg font-medium text-white mb-2">
          Sign Out
        </h3>
        <p className="text-sm text-white/60 mb-4">
          You can sign back in anytime with your email and password.
        </p>
        <Button 
          variant="outline" 
          onClick={handleSignOut}
          className="border-white/20 text-white hover:bg-white/10"
        >
          Sign Out
        </Button>
      </div>
    </DashboardLayout>
  );
}
