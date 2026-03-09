import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Use Claude Haiku via OpenRouter to expand a short user query into a richer
 * description. This significantly improves semantic search quality without
 * high compute costs (Haiku is fast and cheap).
 * Falls back to the original query on any error.
 */
async function expandQueryWithLLM(query: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://crowdia.app",
        "X-Title": "Crowdia Event Search",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4-5",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `You are a search query optimizer for a local events discovery app (concerts, markets, festivals, community activities, sports, arts etc.).

Given a user's short search query, rewrite it into 1-2 sentences that include related terms, synonyms, and contextual details to improve semantic search over event listings.

Output ONLY the expanded query text. No explanation, no quotes, no preamble.

User query: ${query}`,
          },
        ],
      }),
    });

    if (!response.ok) return query;

    const data = await response.json();
    const expanded = data.choices?.[0]?.message?.content?.trim();
    return expanded || query;
  } catch {
    return query;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, since, limit = 20, threshold = 0.4 } = await req.json();

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ events: [], error: "No query provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPEN_ROUTER_API_KEY")!;

    // Use Claude Haiku to interpret and expand the query for better semantic matching
    const expandedQuery = await expandQueryWithLLM(query.trim(), apiKey);
    console.log(`Query expansion: "${query}" → "${expandedQuery}"`);

    // Generate embedding via OpenRouter (routes to OpenAI text-embedding-3-small)
    const embeddingResponse = await fetch(
      "https://openrouter.ai/api/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://crowdia.app",
          "X-Title": "Crowdia Event Search",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: expandedQuery,
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const errText = await embeddingResponse.text();
      throw new Error(`Embedding API error ${embeddingResponse.status}: ${errText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error("No embedding returned from API");
    }

    // Query Supabase for semantically matching events
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("match_events", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_since: since || new Date().toISOString(),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ events: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("search-events error:", err);
    return new Response(
      JSON.stringify({ events: [], error: String(err.message ?? err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
