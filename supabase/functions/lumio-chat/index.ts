import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Gateway handles LLM routing (GB10 local → OpenRouter cloud fallback)
const LUMIO_GATEWAY_URL = Deno.env.get("LUMIO_GATEWAY_URL") ?? "";
// Direct OpenRouter fallback when gateway is not configured
const CLOUD_MODEL = "anthropic/claude-haiku-4-5";

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://crowdia.app",
      "X-Title": "Crowdia Lumio Chat",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
    }),
  });
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function callGateway(messages: { role: string; content: string }[], userTier: string, sessionId?: string): Promise<{ reply: string; modelUsed: string; tier: string; sessionId?: string }> {
  const res = await fetch(`${LUMIO_GATEWAY_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, userTier, maxTokens: 200, sessionId }),
  });
  if (!res.ok) throw new Error(`Gateway error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function callOpenRouterDirect(messages: { role: string; content: string }[], apiKey: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://crowdia.app",
      "X-Title": "Crowdia Lumio Chat",
    },
    body: JSON.stringify({ model: CLOUD_MODEL, max_tokens: 200, messages }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, userId, userCity, userTier = "free", sessionId } = await req.json();

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ reply: "Non ho capito la domanda. Riprova!", events: [], lumioAvatar: "idle" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPEN_ROUTER_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Embed and match events
    const embedding = await generateEmbedding(message.trim(), apiKey);
    const { data: events, error: rpcError } = await supabase.rpc("match_events", {
      query_embedding: embedding,
      match_threshold: 0.35,
      match_count: 5,
      filter_since: new Date().toISOString(),
    });
    if (rpcError) console.error("match_events error:", rpcError);
    const foundEvents = events ?? [];

    // 2. Build messages for the LLM
    const city = userCity ?? "Palermo";
    const eventContext = foundEvents.length > 0
      ? foundEvents.slice(0, 3).map((e: { title: string; location_name?: string; event_start_time?: string }) => {
          const parts = [e.title];
          if (e.location_name) parts.push(`a ${e.location_name}`);
          if (e.event_start_time) {
            const dt = new Date(e.event_start_time);
            parts.push(dt.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
          }
          return parts.join(" — ");
        }).join("\n")
      : null;

    const systemPrompt = `Sei Lumio, la guida AI di Crowdia per la vita culturale e notturna di ${city}. Parli come un amico locale che conosce bene la città. Rispondi sempre in italiano, in modo caldo, breve e diretto (1-2 frasi al massimo). Se hai trovato eventi pertinenti, menzionali naturalmente nella risposta.`;
    const userPrompt = eventContext
      ? `L'utente chiede: "${message}"\n\nEventi trovati:\n${eventContext}\n\nRispondi consigliando uno o più di questi eventi.`
      : `L'utente chiede: "${message}"\n\nNon ho trovato eventi specifici per questa ricerca. Rispondi in modo utile e incoraggiante.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // 3. Call gateway (GB10 → cloud fallback) or direct OpenRouter if gateway not configured
    let reply: string;
    let modelUsed: string;
    let tier: string;
    let returnedSessionId: string | undefined;

    if (LUMIO_GATEWAY_URL) {
      const result = await callGateway(messages, userTier, sessionId);
      reply = result.reply;
      modelUsed = result.modelUsed;
      tier = result.tier;
      returnedSessionId = result.sessionId;
    } else {
      reply = await callOpenRouterDirect(messages, apiKey);
      modelUsed = CLOUD_MODEL;
      tier = "cloud";
      returnedSessionId = sessionId ?? crypto.randomUUID();
    }

    if (!reply) reply = "Non sono riuscito a trovare qualcosa per te. Riprova!";

    return new Response(
      JSON.stringify({
        reply,
        events: foundEvents.slice(0, 3),
        lumioAvatar: foundEvents.length > 0 ? "excited" : "idle",
        tier,
        modelUsed,
        sessionId: returnedSessionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("lumio-chat error:", err);
    return new Response(
      JSON.stringify({
        reply: "Qualcosa è andato storto. Riprova tra poco!",
        events: [],
        lumioAvatar: "idle",
        error: String((err as Error).message ?? err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
