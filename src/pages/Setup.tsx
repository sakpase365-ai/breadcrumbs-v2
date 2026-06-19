import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BreadcrumbsLayout } from "@/components/layout/BreadcrumbsLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FamilyDraft } from "@/lib/breadcrumbs";
import { LooseSupabase } from "@/lib/supabase-loose";
import { toast } from "sonner";

const emptyChild = (): FamilyDraft => ({ name: "", role: "Child", birthDate: "" });

export default function Setup() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const db = supabase as unknown as LooseSupabase;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerRole, setOwnerRole] = useState("Dad");
  const [spouse, setSpouse] = useState<FamilyDraft>({ name: "", role: "Partner" });
  const [children, setChildren] = useState<FamilyDraft[]>([emptyChild()]);
  const [otp, setOtp] = useState("");
  const phone = localStorage.getItem("breadcrumbs_pending_phone") || "";

  useEffect(() => {
    if (!isLoading && !user) navigate("/signup");
    if (profile) {
      setOwnerName(profile.name || "");
      const extendedProfile = profile as typeof profile & { family_name?: string; custom_role_label?: string };
      setFamilyName(extendedProfile.family_name || "");
      setOwnerRole(extendedProfile.custom_role_label || "Dad");
    }
  }, [isLoading, navigate, profile, user]);

  const saveSetup = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (otp.length < 4) {
      toast.error("Enter the phone verification code to finish setup.");
      return;
    }

    setSaving(true);
    try {
      const profilePayload = {
        user_id: user.id,
        email: user.email || localStorage.getItem("breadcrumbs_pending_email") || "",
        name: ownerName,
        role: "creator",
        phone,
        family_name: familyName,
        custom_role_label: ownerRole,
      };

      const { data: existing } = await db.from<{ id: string }>("profiles").select("id").eq("user_id", user.id).maybeSingle();
      const profileResult = existing?.id
        ? await db.from<{ id: string }>("profiles").update(profilePayload).eq("id", existing.id).select("id").single()
        : await db.from<{ id: string }>("profiles").insert(profilePayload).select("id").single();
      if (profileResult.error) throw profileResult.error;

      const creatorId = profileResult.data.id;
      const { data: family, error: familyError } = await db
        .from<{ id: string }>("families")
        .insert({ name: familyName })
        .select("id")
        .single();
      if (familyError) throw familyError;

      await db.from("family_members").insert({
        family_id: family.id,
        user_id: user.id,
        role: ownerRole,
      });

      const recipients = [
        ...(spouse.name.trim() ? [spouse] : []),
        ...children.filter((child) => child.name.trim()),
      ].map((member) => ({
        creator_id: creatorId,
        display_name: member.name.trim(),
        relationship: member.role.trim() || "Family",
        date_of_birth: member.birthDate || null,
      }));

      if (recipients.length > 0) {
        const { error: recipientsError } = await db.from("recipients").insert(recipients);
        if (recipientsError) throw recipientsError;
      }

      localStorage.removeItem("breadcrumbs_pending_phone");
      localStorage.removeItem("breadcrumbs_pending_email");
      toast.success("Your family archive is ready.");
      navigate("/capture");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Setup could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <form onSubmit={saveSetup} className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-5 shadow-card sm:p-7">
      <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">Setup {step} of 3</p>
      <h1 className="mt-2 font-serif text-4xl font-medium">Your family profile</h1>

      {step === 1 && (
        <section className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="familyName">Family name</Label>
            <Input id="familyName" value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="The Riveras" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerName">Your name</Label>
            <Input id="ownerName" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerRole">Your role</Label>
            <Input id="ownerRole" value={ownerRole} onChange={(event) => setOwnerRole(event.target.value)} placeholder="Dad, Mom, Guardian" required />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-7 space-y-5">
          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="font-serif text-xl">Spouse or partner</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input value={spouse.name} onChange={(event) => setSpouse({ ...spouse, name: event.target.value })} placeholder="Name" />
              <Input value={spouse.role} onChange={(event) => setSpouse({ ...spouse, role: event.target.value })} placeholder="Role" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">Children</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setChildren([...children, emptyChild()])}>
                <Plus className="mr-2 h-4 w-4" />
                Add child
              </Button>
            </div>
            {children.map((child, index) => (
              <div key={index} className="grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={child.name} onChange={(event) => setChildren(children.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="Name" />
                <Input type="date" value={child.birthDate} onChange={(event) => setChildren(children.map((item, i) => i === index ? { ...item, birthDate: event.target.value } : item))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setChildren(children.filter((_, i) => i !== index))} aria-label="Remove child">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-7 space-y-4">
          <p className="leading-7 text-muted-foreground">
            We’ll verify {phone || "your phone number"} before opening the archive. For now, enter any 4-6 digit code to stand in for the future SMS OTP.
          </p>
          <div className="space-y-2">
            <Label htmlFor="otp">Phone verification code</Label>
            <Input id="otp" inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" />
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-3">
        {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 3 ? (
          <Button type="button" className="ml-auto" onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button type="submit" className="ml-auto" disabled={saving}>{saving ? "Saving..." : "Finish setup"}</Button>
        )}
      </div>
    </form>
  );

  if (isLoading) return <div className="min-h-screen bg-background" />;
  return user ? <BreadcrumbsLayout>{content}</BreadcrumbsLayout> : content;
}
