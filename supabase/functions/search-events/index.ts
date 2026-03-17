import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParsedQuery {
  expandedQuery: string;
  dateFrom: string | null;   // ISO date (YYYY-MM-DD) if user specified a start
  dateUntil: string | null;  // ISO date (YYYY-MM-DD) if user specified an end
  categoryHints: string[];   // e.g. ["concert", "jazz", "live music"]
}

/**
 * Use Claude Haiku via OpenRouter to:
 * 1. Extract structured entities (dates, categories) from the natural language query
 * 2. Expand the query into richer text for better semantic embedding
 *
 * Returns a ParsedQuery with all extracted data.
 * Falls back to a minimal parse (original query, no dates) on any error.
 */
async function parseQueryWithLLM(
  query: string,
  apiKey: string,
  today: string
): Promise<ParsedQuery> {
  const fallback: ParsedQuery = {
    expandedQuery: query,
    dateFrom: null,
    dateUntil: null,
    categoryHints: [],
  };

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
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `You are a search query parser for a local events discovery app (concerts, markets, festivals, sports, arts, community activities, etc.).

Given the user's natural language query, return a JSON object with these fields:
- expandedQuery: Rewrite the query into 1-2 sentences with related terms and synonyms for better semantic search (always required)
- dateFrom: ISO date string (YYYY-MM-DD) for when events should start. Set if user mentions a specific time ("this weekend", "next Friday", "tomorrow"). Null if no date mentioned.
- dateUntil: ISO date string (YYYY-MM-DD) for when events should end. Set if user mentions a range ("this weekend" → until Sunday). Null if no end date.
- categoryHints: Array of 0-3 lowercase category keywords that match the query intent (e.g. "concert", "market", "festival", "sports", "food", "arts", "comedy", "theatre"). Empty array if no specific category.

Today's date is ${today}. Interpret relative dates using this reference. "This weekend" means the upcoming Saturday and Sunday.

User query: ${query}

Respond with ONLY valid JSON, no explanation, no code fences.`,
          },
        ],
      }),
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content?.trim();
    if (!rawText) return fallback;

    // Strip any accidental code fences
    const jsonText = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(jsonText) as Partial<ParsedQuery>;

    return {
      expandedQuery: parsed.expandedQuery?.trim() || query,
      dateFrom: parsed.dateFrom || null,
      dateUntil: parsed.dateUntil || null,
      categoryHints: Array.isArray(parsed.categoryHints) ? parsed.categoryHints : [],
    };
  } catch {
    return fallback;
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
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Parse query: extract entities + expand for embedding
    const parsed = await parseQueryWithLLM(query.trim(), apiKey, today);
    console.log(`Query parsed: "${query}" →`, JSON.stringify(parsed));

    // Determine filter_since: prefer LLM-extracted dateFrom, fall back to client's since, then now
    const filterSince = parsed.dateFrom
      ? new Date(parsed.dateFrom).toISOString()
      : since || new Date().toISOString();

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
          input: parsed.expandedQuery,
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
      filter_since: filterSince,
    });

    if (error) throw error;

    let events = data ?? [];

    // Post-filter by dateUntil if extracted
    if (parsed.dateUntil) {
      const until = new Date(parsed.dateUntil);
      until.setHours(23, 59, 59, 999); // end of that day
      events = events.filter((e: { event_start_time: string }) => {
        return !e.event_start_time || new Date(e.event_start_time) <= until;
      });
    }

    // Post-filter by category hints: if hints are present, boost matching events
    // (move category matches to top, keep non-matches but ranked lower)
    if (parsed.categoryHints.length > 0) {
      const hints = parsed.categoryHints.map((h: string) => h.toLowerCase());
      const matches: typeof events = [];
      const rest: typeof events = [];
      for (const event of events) {
        const catName = (event.category_name ?? "").toLowerCase();
        const title = (event.title ?? "").toLowerCase();
        const desc = (event.description ?? "").toLowerCase();
        const isMatch = hints.some(
          (h) => catName.includes(h) || title.includes(h) || desc.includes(h)
        );
        if (isMatch) {
          matches.push(event);
        } else {
          rest.push(event);
        }
      }
      events = [...matches, ...rest];
    }

    return new Response(JSON.stringify({ events, parsed }), {
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
