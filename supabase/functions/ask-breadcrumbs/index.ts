import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BreadcrumbContext {
  id: string;
  title: string;
  category: string | null;
  topic: string | null;
  breadcrumb_text: string | null;
  commentary_text: string | null;
  scripture_reference: string | null;
  scripture_text: string | null;
  recipient_id: string | null;
  visibility: string;
  created_at: string;
  creator_name: string | null;
  creator_id: string | null;
  tags: string[] | null;
  relevance_score?: number;
}

interface RetrievalResult {
  scope: "person" | "family" | "general";
  target_person: string | null;
  target_person_id: string | null;
  keywords: string[];
  scripture_terms: string[];
  filtered_breadcrumbs: BreadcrumbContext[];
  all_family_members: string[];
}

// Helper: Extract keywords from question (excluding stop words)
function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
    "because", "until", "while", "although", "what", "which", "who", "whom",
    "this", "that", "these", "those", "am", "i", "me", "my", "myself", "we",
    "our", "ours", "ourselves", "you", "your", "yours", "yourself", "he",
    "him", "his", "himself", "she", "her", "hers", "herself", "it", "its",
    "itself", "they", "them", "their", "theirs", "themselves", "about",
    "say", "says", "said", "think", "thinks", "thought", "believe", "tell",
    "told", "ask", "asked", "teach", "taught", "know", "knows", "knew"
  ]);
  
  const words = question.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  return [...new Set(words)];
}

// Helper: Detect scripture-related terms
function extractScriptureTerms(question: string): string[] {
  const scripturePatterns = [
    /\b(genesis|exodus|leviticus|numbers|deuteronomy)\b/gi,
    /\b(joshua|judges|ruth|samuel|kings|chronicles)\b/gi,
    /\b(ezra|nehemiah|esther|job|psalms?|proverbs?)\b/gi,
    /\b(ecclesiastes|song\s*of\s*solomon|isaiah|jeremiah)\b/gi,
    /\b(lamentations|ezekiel|daniel|hosea|joel|amos)\b/gi,
    /\b(obadiah|jonah|micah|nahum|habakkuk|zephaniah)\b/gi,
    /\b(haggai|zechariah|malachi)\b/gi,
    /\b(matthew|mark|luke|john|acts|romans)\b/gi,
    /\b(corinthians|galatians|ephesians|philippians)\b/gi,
    /\b(colossians|thessalonians|timothy|titus|philemon)\b/gi,
    /\b(hebrews|james|peter|jude|revelation)\b/gi,
    /\b(\d+:\d+(-\d+)?)\b/g, // Chapter:verse patterns
    /\b(bible|scripture|verse|passage|gospel)\b/gi,
  ];
  
  const terms: string[] = [];
  for (const pattern of scripturePatterns) {
    const matches = question.match(pattern);
    if (matches) {
      terms.push(...matches.map(m => m.toLowerCase()));
    }
  }
  return [...new Set(terms)];
}

// Helper: Detect if question targets a specific person
function detectTargetPerson(
  question: string,
  familyMembers: { name: string; id: string }[]
): { name: string | null; id: string | null } {
  const lowerQuestion = question.toLowerCase();
  
  // Common patterns for targeting a person
  const personPatterns = [
    /what (?:would|did|does) (\w+(?:\s+\w+)?)\s+(?:say|think|believe|teach)/i,
    /ask (\w+(?:\s+\w+)?)\s+(?:about|what|how)/i,
    /(?:from|according to) (\w+(?:\s+\w+)?)/i,
    /(\w+(?:\s+\w+)?)'s (?:advice|wisdom|thoughts?|views?|teaching)/i,
    /what (?:does|would) (\w+(?:\s+\w+)?) (?:have to )?say/i,
  ];
  
  // Check for family member names in question
  for (const member of familyMembers) {
    const memberNameLower = member.name.toLowerCase();
    const nameParts = memberNameLower.split(/\s+/);
    const firstName = nameParts[0];
    
    // Direct name match
    if (lowerQuestion.includes(memberNameLower) || lowerQuestion.includes(firstName)) {
      return { name: member.name, id: member.id };
    }
  }
  
  // Check patterns (for names not in family members list yet)
  for (const pattern of personPatterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      const potentialName = match[1].trim();
      // Check if this matches any family member
      for (const member of familyMembers) {
        if (member.name.toLowerCase().includes(potentialName.toLowerCase()) ||
            potentialName.toLowerCase().includes(member.name.toLowerCase().split(/\s+/)[0])) {
          return { name: member.name, id: member.id };
        }
      }
      // Return the detected name even if not in list (AI will handle)
      return { name: potentialName, id: null };
    }
  }
  
  return { name: null, id: null };
}

// Helper: Detect if question targets family/collective
function detectFamilyScope(question: string): boolean {
  const familyPatterns = [
    /\b(our family|we believe|our values|family values)\b/i,
    /\b(what do we|how do we|our tradition)\b/i,
    /\b(as a family|family's|our beliefs)\b/i,
  ];
  
  return familyPatterns.some(pattern => pattern.test(question));
}

// Helper: Calculate relevance score for a breadcrumb
function calculateRelevance(
  breadcrumb: BreadcrumbContext,
  keywords: string[],
  scriptureTerms: string[]
): number {
  let score = 0;
  const textToSearch = [
    breadcrumb.title,
    breadcrumb.breadcrumb_text,
    breadcrumb.commentary_text,
    breadcrumb.scripture_reference,
    breadcrumb.scripture_text,
    breadcrumb.topic,
    breadcrumb.category,
    ...(breadcrumb.tags || [])
  ].filter(Boolean).join(" ").toLowerCase();
  
  // Keyword matches (weight: 2 per match)
  for (const keyword of keywords) {
    if (textToSearch.includes(keyword)) {
      score += 2;
    }
  }
  
  // Scripture term matches (weight: 3 per match - higher priority)
  for (const term of scriptureTerms) {
    if (textToSearch.includes(term)) {
      score += 3;
    }
  }
  
  // Tag matches (weight: 4 per match - tags are curated)
  if (breadcrumb.tags) {
    for (const tag of breadcrumb.tags) {
      const tagLower = tag.toLowerCase();
      for (const keyword of keywords) {
        if (tagLower.includes(keyword) || keyword.includes(tagLower)) {
          score += 4;
        }
      }
    }
  }
  
  // Recency bonus (newer entries get slight boost)
  const ageInDays = (Date.now() - new Date(breadcrumb.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 30) score += 1;
  if (ageInDays < 7) score += 1;
  
  return score;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header is required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's verified profile and role from the database
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, familyId, recipientId } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use server-verified values
    const verifiedUserId = user.id;
    const verifiedRole = profile.role;
    const verifiedProfileId = profile.id;

    let breadcrumbsData: any[] = [];

    // Family-scoped access: verify user is a member of the family first
    if (familyId) {
      console.log("Fetching family-scoped breadcrumbs for family:", familyId);
      
      // Verify user is a member of this family
      const { data: familyMember, error: memberError } = await supabase
        .from("family_members")
        .select("id")
        .eq("family_id", familyId)
        .eq("user_id", verifiedUserId)
        .single();

      if (memberError || !familyMember) {
        return new Response(JSON.stringify({ error: "You are not a member of this family" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          text_body,
          commentary_text,
          scripture_reference,
          scripture_text,
          created_at,
          recipient_id,
          visibility,
          family_id,
          creator_id,
          tags,
          creator:profiles!breadcrumbs_creator_id_fkey(id, name),
          topic:topics(name, category:categories(name))
        `)
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Database error fetching family breadcrumbs:", error);
        throw new Error("Failed to fetch breadcrumbs");
      }

      // For recipients, verify they have access to recipient_only breadcrumbs
      let verifiedRecipientId: string | null = null;
      if (verifiedRole === "recipient" && recipientId) {
        // Verify the recipient record is linked to this user
        const { data: recipientData } = await supabase
          .from("recipients")
          .select("id")
          .eq("id", recipientId)
          .eq("user_id", verifiedUserId)
          .single();
        
        if (recipientData) {
          verifiedRecipientId = recipientData.id;
        }
      }

      // Filter: only include family-visible OR recipient_only if this user is the verified recipient
      breadcrumbsData = (data || []).filter((b: any) => {
        if (b.visibility === "family") return true;
        if (b.visibility === "recipient_only" && verifiedRecipientId && b.recipient_id === verifiedRecipientId) return true;
        return false;
      });
    } 
    // Recipient: fetch breadcrumbs the recipient has access to
    else if (verifiedRole === "recipient") {
      console.log("Fetching breadcrumbs for verified recipient");
      
      // Get recipient record linked to this user
      const { data: recipientData, error: recipientError } = await supabase
        .from("recipients")
        .select("id, creator_id")
        .eq("user_id", verifiedUserId);

      if (recipientError) {
        console.error("Error fetching recipient records:", recipientError);
        throw new Error("Failed to verify recipient access");
      }

      if (!recipientData || recipientData.length === 0) {
        return new Response(JSON.stringify({
          answer: "You don't have any breadcrumbs assigned to you yet.",
          sources_used: [],
          follow_up_questions: [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get breadcrumbs from creators who have this user as a recipient
      const creatorIds = recipientData.map(r => r.creator_id);
      const recipientIds = recipientData.map(r => r.id);
      
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          text_body,
          commentary_text,
          scripture_reference,
          scripture_text,
          created_at,
          recipient_id,
          visibility,
          creator_id,
          tags,
          creator:profiles!breadcrumbs_creator_id_fkey(id, name),
          topic:topics(name, category:categories(name))
        `)
        .in("creator_id", creatorIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Database error fetching breadcrumbs:", error);
        throw new Error("Failed to fetch breadcrumbs");
      }
      
      // Filter to only include breadcrumbs this recipient can see
      breadcrumbsData = (data || []).filter((b: any) => {
        // Family-visible breadcrumbs from their creators
        if (b.visibility === "family") return true;
        // Recipient-only breadcrumbs specifically for this recipient
        if (b.visibility === "recipient_only" && recipientIds.includes(b.recipient_id)) return true;
        return false;
      });

      console.log(`Found ${breadcrumbsData.length} accessible breadcrumbs for recipient`);
    } else if (verifiedRole === "creator") {
      // Creator can only access their own breadcrumbs
      const { data, error } = await supabase
        .from("breadcrumbs")
        .select(`
          id,
          title,
          text_body,
          commentary_text,
          scripture_reference,
          scripture_text,
          created_at,
          recipient_id,
          visibility,
          creator_id,
          tags,
          creator:profiles!breadcrumbs_creator_id_fkey(id, name),
          topic:topics(name, category:categories(name))
        `)
        .eq("creator_id", verifiedProfileId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error("Failed to fetch breadcrumbs");
      breadcrumbsData = data || [];
    } else {
      return new Response(JSON.stringify({ error: "Invalid user role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${breadcrumbsData.length} breadcrumbs for context`);

    if (breadcrumbsData.length === 0) {
      return new Response(JSON.stringify({
        answer: "I don't have any breadcrumbs to search through yet. Once your loved ones leave some wisdom, I'll be able to help answer your questions!",
        sources_used: [],
        follow_up_questions: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format breadcrumbs for context
    const breadcrumbsContext: BreadcrumbContext[] = breadcrumbsData.map((b: any) => ({
      id: b.id,
      title: b.title,
      category: b.topic?.category?.name || null,
      topic: b.topic?.name || null,
      breadcrumb_text: b.text_body,
      commentary_text: b.commentary_text,
      scripture_reference: b.scripture_reference,
      scripture_text: b.scripture_text,
      recipient_id: b.recipient_id,
      visibility: b.visibility || "family",
      created_at: b.created_at,
      creator_name: b.creator?.name || null,
      creator_id: b.creator?.id || b.creator_id || null,
      tags: b.tags || null,
    }));

    // Build family members list with IDs for person detection
    const familyMembersWithIds = [...new Map(
      breadcrumbsContext
        .filter(b => b.creator_name && b.creator_id)
        .map(b => [b.creator_id, { name: b.creator_name!, id: b.creator_id! }])
    ).values()];

    const familyMemberNames = familyMembersWithIds.map(m => m.name);

    // === SMART RETRIEVAL: Analyze question and filter breadcrumbs ===
    const keywords = extractKeywords(question);
    const scriptureTerms = extractScriptureTerms(question);
    const targetPerson = detectTargetPerson(question, familyMembersWithIds);
    const isFamilyScope = detectFamilyScope(question);
    
    console.log("Retrieval analysis:", {
      keywords,
      scriptureTerms,
      targetPerson,
      isFamilyScope,
      totalBreadcrumbs: breadcrumbsContext.length
    });

    // Determine scope and filter breadcrumbs accordingly
    let scope: "person" | "family" | "general" = "general";
    let filteredBreadcrumbs = breadcrumbsContext;

    if (targetPerson.name) {
      // Person-targeted question: only use that person's entries
      scope = "person";
      if (targetPerson.id) {
        filteredBreadcrumbs = breadcrumbsContext.filter(b => b.creator_id === targetPerson.id);
      } else {
        // Try fuzzy name matching
        const targetNameLower = targetPerson.name.toLowerCase();
        filteredBreadcrumbs = breadcrumbsContext.filter(b => 
          b.creator_name?.toLowerCase().includes(targetNameLower) ||
          targetNameLower.includes(b.creator_name?.toLowerCase().split(/\s+/)[0] || "")
        );
      }
      console.log(`Filtered to ${filteredBreadcrumbs.length} breadcrumbs from ${targetPerson.name}`);
    } else if (isFamilyScope) {
      // Family-scoped question: use all family breadcrumbs
      scope = "family";
      // No filtering, use all breadcrumbs but rank by relevance
    }

    // Calculate relevance scores and sort
    const scoredBreadcrumbs = filteredBreadcrumbs.map(b => ({
      ...b,
      relevance_score: calculateRelevance(b, keywords, scriptureTerms)
    }));

    // Sort by relevance score (descending), then by date (newest first)
    scoredBreadcrumbs.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) {
        return (b.relevance_score || 0) - (a.relevance_score || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Take top K entries (prefer more relevant ones)
    const TOP_K = 30;
    const topBreadcrumbs = scoredBreadcrumbs.slice(0, TOP_K);

    console.log(`Returning top ${topBreadcrumbs.length} breadcrumbs (scope: ${scope})`);

    const contextText = topBreadcrumbs.map((b, i) => {
      let text = `[Breadcrumb ${i + 1}]\nID: ${b.id}\nTitle: "${b.title}"`;
      if (b.creator_name) text += `\nCreator: ${b.creator_name}`;
      if (b.creator_id) text += `\nCreator ID: ${b.creator_id}`;
      if (b.category) text += `\nCategory: ${b.category}`;
      if (b.topic) text += `\nTopic: ${b.topic}`;
      if (b.tags && b.tags.length > 0) text += `\nTags: ${b.tags.join(", ")}`;
      if (b.breadcrumb_text) text += `\nContent: ${b.breadcrumb_text}`;
      if (b.scripture_reference) text += `\nScripture Reference: ${b.scripture_reference}`;
      if (b.scripture_text) text += `\nScripture Text: ${b.scripture_text}`;
      if (b.commentary_text) text += `\nCommentary: ${b.commentary_text}`;
      text += `\nDate: ${new Date(b.created_at).toLocaleDateString()}`;
      if (b.relevance_score && b.relevance_score > 0) text += `\nRelevance: ${b.relevance_score}`;
      return text;
    }).join("\n\n");

    // Include retrieval metadata in the prompt
    const retrievalContext = `
RETRIEVAL METADATA:
- Question scope: ${scope}
${targetPerson.name ? `- Target person: ${targetPerson.name}` : ""}
- Keywords detected: ${keywords.join(", ") || "none"}
- Scripture terms detected: ${scriptureTerms.join(", ") || "none"}
- Total entries retrieved: ${topBreadcrumbs.length}
${scope === "person" && filteredBreadcrumbs.length === 0 ? `- WARNING: No entries found from ${targetPerson.name}. The AI should inform the user.` : ""}`;

    const systemPrompt = `You are Breadcrumbs, a private, family-only legacy and knowledge assistant.

Your core job:
- Answer questions in a way that respects WHO the user is asking (a specific person, the family, or nobody in particular)
- Use stored Breadcrumb entries as the primary source of truth for anything attributed to a family member
- Never put words in a family member's mouth

Privacy:
- Breadcrumbs is private to the family. Do not suggest public sharing.

IDENTITY + ATTRIBUTION RULES (NON-NEGOTIABLE):

1) If the user's question targets a specific family member (e.g., "what would Grandpa say…", "what did Mom teach about…", "ask Auntie…"):
   - Only use Breadcrumb entries created by that person.
   - If there are not enough relevant entries, say so clearly and show the closest related points from that person's entries only.
   - Do NOT supplement with other people's entries.
   - Do NOT add external/general knowledge as if it came from that person.

2) If the user's question targets "our family" / "we" / "what do we believe":
   - Use Breadcrumb entries from multiple family members.
   - Synthesize "common threads" and also present differences neutrally with attribution by person.
   - Never force a single family stance if sources differ.

3) If the user asks a general question without targeting a person or the family:
   - You may answer using general knowledge ONLY IF it is clearly labeled as "General reference."
   - If there are relevant family Breadcrumbs, include them in a separate "Family notes (from Breadcrumbs)" section with attribution.
   - Never blend general reference content into a person-attributed answer.

SOURCE INTEGRITY:
- Any statement attributed to a specific person must be supported by that person's Breadcrumb entries.
- If a claim is not supported, remove it or mark uncertainty explicitly.
- If you include Scripture, copy it EXACTLY as it appears in the Breadcrumbs. Do not paraphrase Scripture.
- Preserve the creator's voice and tone. Prefer direct quotes from Breadcrumbs when possible.

RESPONSE STRUCTURE (choose what applies):
A) Answer (direct response)
B) Based on Breadcrumbs (attribution + titles + dates)
C) Family notes (optional) OR General reference (optional, clearly labeled)
D) If insufficient sources: say so + show closest related entries + suggest 2–3 prompts the person/family can record to fill the gap.

FAMILY MEMBERS IN THIS FAMILY:
${familyMemberNames.join(", ") || "Not specified"}

${retrievalContext}

AVAILABLE BREADCRUMBS CONTEXT:
${contextText}`;

    // Call Lovable AI with tool calling for structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_answer",
              description: "Provide a structured answer to the user's question based on the Breadcrumbs context.",
              parameters: {
                type: "object",
                properties: {
                  answer: {
                    type: "string",
                    description: "The direct answer to the question. Start with the main response. When attributing to specific family members, use their name.",
                  },
                  sources_used: {
                    type: "array",
                    description: "List of breadcrumbs used to form the answer, with attribution to the creator",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "The breadcrumb ID" },
                        title: { type: "string", description: "The breadcrumb title" },
                        creator_name: { type: "string", description: "Name of the person who created this breadcrumb" },
                        date: { type: "string", description: "Date of the breadcrumb" },
                      },
                      required: ["id", "title"],
                    },
                  },
                  follow_up_questions: {
                    type: "array",
                    description: "If insufficient sources: suggested prompts for the family to record. Otherwise: suggested follow-up questions.",
                    items: { type: "string" },
                  },
                  general_reference: {
                    type: "string",
                    description: "If general knowledge was used and clearly labeled, include it here separately. Leave empty if not applicable.",
                  },
                },
                required: ["answer", "sources_used"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_answer" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract the tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({
        answer: result.answer,
        sources_used: result.sources_used || [],
        follow_up_questions: result.follow_up_questions || [],
        general_reference: result.general_reference || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback to regular content if tool calling didn't work
    const content = aiResponse.choices?.[0]?.message?.content || "I couldn't process your question. Please try again.";
    return new Response(JSON.stringify({
      answer: content,
      sources_used: [],
      follow_up_questions: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ask-breadcrumbs:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
