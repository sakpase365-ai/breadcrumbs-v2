import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, content, journalEntryId } = await req.json();

    if (!title || !content) {
      return new Response(JSON.stringify({ error: "title and content are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all active topics with their category names
    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id, name, description, category:categories(name)")
      .eq("is_active", true)
      .order("sort_order");

    if (topicsError || !topics) {
      throw new Error("Failed to fetch topics");
    }

    const topicList = topics.map((t: any) =>
      `${t.id}|${t.category?.name} > ${t.name}${t.description ? `: ${t.description}` : ""}`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a legacy wisdom analyst. Your job is to read a personal journal entry and:
1. Identify the most relevant topics/categories from the provided list
2. Generate 3 thoughtful prompts to help the creator go deeper in their reflection
3. Write a brief insight (1-2 sentences) about what this entry reveals about the creator's life journey

Available topics (format: id|category > topic: description):
${topicList}

Return 2-5 of the most relevant topic IDs and meaningful reflection prompts.`;

    const userPrompt = `Journal Entry Title: "${title}"

Content:
${content}

Analyze this journal entry and return relevant topics, reflection prompts, and a brief insight.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_journal_entry",
              description: "Analyze a journal entry and return insights",
              parameters: {
                type: "object",
                properties: {
                  suggested_topic_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-5 topic UUIDs from the provided list that best match this entry",
                    minItems: 1,
                    maxItems: 5,
                  },
                  relevance_notes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_id: { type: "string" },
                        note: { type: "string", description: "One sentence on why this topic is relevant" },
                      },
                      required: ["topic_id", "note"],
                    },
                  },
                  reflection_prompts: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 personalized questions to help the creator go deeper",
                    minItems: 3,
                    maxItems: 3,
                  },
                  insight: {
                    type: "string",
                    description: "A brief, warm 1-2 sentence insight about what this entry reveals",
                  },
                },
                required: ["suggested_topic_ids", "relevance_notes", "reflection_prompts", "insight"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_journal_entry" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No AI response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate topic IDs exist in our topics list
    const validTopicIds = new Set(topics.map((t: any) => t.id));
    const validSuggestedIds = (result.suggested_topic_ids || []).filter((id: string) =>
      validTopicIds.has(id)
    );

    // If journalEntryId provided, save the topic links to the DB
    if (journalEntryId && validSuggestedIds.length > 0) {
      // Remove existing topic links first
      await supabase
        .from("journal_entry_topics")
        .delete()
        .eq("journal_entry_id", journalEntryId);

      // Insert new topic links
      const relevanceMap = new Map(
        (result.relevance_notes || []).map((r: any) => [r.topic_id, r.note])
      );

      await supabase.from("journal_entry_topics").insert(
        validSuggestedIds.map((topicId: string) => ({
          journal_entry_id: journalEntryId,
          topic_id: topicId,
          relevance_note: relevanceMap.get(topicId) || null,
        }))
      );
    }

    // Enrich response with topic names
    const topicMap = new Map(topics.map((t: any) => [t.id, t]));
    const enrichedTopics = validSuggestedIds.map((topicId: string) => {
      const topic = topicMap.get(topicId) as any;
      const relevanceNote = (result.relevance_notes || []).find((r: any) => r.topic_id === topicId);
      return {
        id: topicId,
        name: topic?.name || "",
        category: topic?.category?.name || "",
        relevance_note: relevanceNote?.note || "",
      };
    });

    return new Response(
      JSON.stringify({
        topics: enrichedTopics,
        reflection_prompts: result.reflection_prompts || [],
        insight: result.insight || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-journal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
