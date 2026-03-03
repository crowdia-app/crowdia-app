import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Generate embedding via OpenRouter (routes to OpenAI text-embedding-3-small)
    const embeddingResponse = await fetch(
      "https://openrouter.ai/api/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("OPEN_ROUTER_API_KEY")}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://crowdia.app",
          "X-Title": "Crowdia Event Search",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: query.trim(),
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
