import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const breadcrumbTypes = ["Letter", "Story", "Life Lesson", "Advice", "Memory", "Value", "Reflection"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const { data: profile } = await supabase.from("profiles").select("id, name").eq("user_id", user.id).single();
    if (!profile) return json({ error: "Profile not found" }, 403);

    const limited = await isRateLimited(supabase, profile.id, "save-entry", 20);
    if (limited) return json({ error: "Save analysis limit reached. Try again later." }, 429);

    const { content, prompt, family_member } = await req.json();
    if (!content || typeof content !== "string") return json({ error: "content is required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      await logRequest(supabase, profile.id, "save-entry");
      return json(fallbackAnalysis(content));
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Analyze a private family legacy journal entry. Return structured metadata only. Tags should be emotional themes. Domain should be one simple lowercase life domain such as career, relationships, health, identity, faith, money, grief, parenting, or purpose.`,
          },
          {
            role: "user",
            content: JSON.stringify({ writer: profile.name, recipient: family_member, prompt, content }),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_breadcrumb",
              description: "Classify a Breadcrumbs entry",
              parameters: {
                type: "object",
                properties: {
                  breadcrumb_type: { type: "string", enum: breadcrumbTypes },
                  tags: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
                  domain: { type: "string" },
                  relevant_age: { type: "integer", minimum: 0, maximum: 99 },
                  follow_up_question: { type: "string" },
                },
                required: ["breadcrumb_type", "tags", "domain", "relevant_age", "follow_up_question"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_breadcrumb" } },
      }),
    });

    if (!response.ok) return json(fallbackAnalysis(content));

    const result = await response.json();
    const args = result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const analysis = args ? JSON.parse(args) : fallbackAnalysis(content);
    await logRequest(supabase, profile.id, "save-entry");
    return json({
      breadcrumb_type: breadcrumbTypes.includes(analysis.breadcrumb_type) ? analysis.breadcrumb_type : "Reflection",
      tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 6) : ["love", "memory"],
      domain: analysis.domain || "identity",
      relevant_age: Number.isFinite(analysis.relevant_age) ? analysis.relevant_age : 18,
      follow_up_question: analysis.follow_up_question || "What detail would make this memory feel alive years from now?",
    });
  } catch (error) {
    console.error("save-entry error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function fallbackAnalysis(content: string) {
  const lower = content.toLowerCase();
  return {
    breadcrumb_type: lower.includes("dear") ? "Letter" : lower.includes("remember") ? "Memory" : "Reflection",
    tags: [lower.includes("faith") ? "faith" : "love", lower.includes("fear") ? "courage" : "resilience"],
    domain: lower.includes("work") ? "career" : lower.includes("family") ? "relationships" : "identity",
    relevant_age: lower.includes("college") ? 18 : 16,
    follow_up_question: "What is one scene, sound, or object you could add so this feels unmistakably yours?",
  };
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
