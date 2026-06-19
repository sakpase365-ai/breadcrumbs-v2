import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;
type PromptMember = {
  display_name?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fallbackPrompts = [
  "Write a letter about a small moment you hope they remember when life feels loud.",
  "Tell the story of a choice that quietly changed who you became.",
  "Write about a value you learned slowly, through ordinary days rather than grand lessons.",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (!profile) return json({ error: "Profile not found" }, 403);

    const limited = await isRateLimited(supabase, profile.id, "generate-prompt", 30);
    if (limited) return json({ error: "Prompt generation limit reached. Try again later." }, 429);

    const [{ data: familyMembers }, { data: breadcrumbs }, { data: foundations }] = await Promise.all([
      supabase.from("recipients").select("display_name, relationship, date_of_birth").eq("creator_id", profile.id),
      supabase.from("breadcrumbs").select("title, text_body, tags, breadcrumb_type, domain, created_at").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(12),
      supabase.from("family_foundations").select("category, answer").eq("user_id", profile.id).limit(12),
    ]);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      await logRequest(supabase, profile.id, "generate-prompt");
      return json({ prompt: personalizeFallback(familyMembers || []) });
    }

    const system = `You are Breadcrumbs, a warm private writing companion for a parent. Generate exactly one personal writing prompt.

Rules:
- Mention a specific family member when useful.
- Avoid repeating recent entry themes.
- Keep it intimate, concrete, and under 35 words.
- Do not sound clinical or productivity-focused.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              profile: { name: profile.name, role: profile.custom_role_label, family_name: profile.family_name },
              family_members: familyMembers || [],
              recent_breadcrumbs: breadcrumbs || [],
              foundation_answers: foundations || [],
            }),
          },
        ],
      }),
    });

    if (!response.ok) return json({ prompt: personalizeFallback(familyMembers || []) });

    const result = await response.json();
    const prompt = result.choices?.[0]?.message?.content?.trim() || personalizeFallback(familyMembers || []);
    await logRequest(supabase, profile.id, "generate-prompt");
    return json({ prompt });
  } catch (error) {
    console.error("generate-prompt error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function personalizeFallback(members: PromptMember[]) {
  const member = members[Math.floor(Math.random() * Math.max(members.length, 1))];
  const prompt = fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)];
  return member?.display_name ? `${member.display_name}: ${prompt}` : prompt;
}

async function isRateLimited(supabase: SupabaseClient, userId: string, action: string, limit: number) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_request_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since);
  return (count || 0) >= limit;
}

async function logRequest(supabase: SupabaseClient, userId: string, action: string) {
  await supabase.from("ai_request_events").insert({ user_id: userId, action });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
