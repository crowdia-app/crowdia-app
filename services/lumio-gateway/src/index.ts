import type { Server } from "bun";

const PORT = parseInt(Bun.env.PORT ?? "3010");
const GB10_VLLM_URL = Bun.env.GB10_VLLM_URL ?? "http://100.120.138.1:8000";
const GB10_VLLM_MODEL = Bun.env.GB10_VLLM_MODEL ?? "gemma-3-27b-it";
const OPEN_ROUTER_API_KEY = Bun.env.OPEN_ROUTER_API_KEY ?? "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const CLOUD_MODEL_FREE = "anthropic/claude-haiku-4-5";
const CLOUD_MODEL_PRO = "anthropic/claude-sonnet-4-6";
const HEALTH_CACHE_TTL_MS = 30_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  userTier?: "free" | "pro";
  maxTokens?: number;
}

interface ChatResponse {
  reply: string;
  modelUsed: string;
  tier: "local" | "cloud";
  tokensIn?: number;
  tokensOut?: number;
}

interface TagEvent {
  id: string;
  title: string;
  description?: string;
  organizer_name?: string;
  venue_name?: string;
  category?: string;
}

interface TagRequest {
  events: TagEvent[];
}

interface TagResult {
  eventId: string;
  vibe_tags: string[];
}

let gb10Healthy: boolean | null = null;
let gb10LastCheck = 0;

async function checkGb10Health(): Promise<boolean> {
  const now = Date.now();
  if (gb10Healthy !== null && now - gb10LastCheck < HEALTH_CACHE_TTL_MS) {
    return gb10Healthy;
  }
  try {
    const res = await fetch(`${GB10_VLLM_URL}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    // vLLM /v1/models returns 200 with model list; anything 2xx means healthy
    gb10Healthy = res.ok;
  } catch {
    gb10Healthy = false;
  }
  gb10LastCheck = now;
  console.log(`[health] GB10 vLLM: ${gb10Healthy ? "up" : "down"}`);
  return gb10Healthy;
}

async function callGb10(messages: ChatMessage[], maxTokens: number): Promise<{ reply: string; tokensIn?: number; tokensOut?: number }> {
  const res = await fetch(`${GB10_VLLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GB10_VLLM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`GB10 error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json() as { choices: { message: { content: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
  return {
    reply: data.choices[0]?.message?.content?.trim() ?? "",
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

async function callOpenRouter(messages: ChatMessage[], model: string, maxTokens: number): Promise<{ reply: string; tokensIn?: number; tokensOut?: number }> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://crowdia.app",
      "X-Title": "Crowdia Lumio Gateway",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json() as { choices: { message: { content: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
  return {
    reply: data.choices[0]?.message?.content?.trim() ?? "",
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

async function handleChat(req: Request): Promise<Response> {
  const body = (await req.json()) as ChatRequest;
  const { messages, userTier = "free", maxTokens = 200 } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "messages required" }, 400);
  }

  const gb10Up = await checkGb10Health();
  let reply: string;
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let tier: "local" | "cloud";
  let modelUsed: string;

  if (gb10Up) {
    try {
      const result = await callGb10(messages, maxTokens);
      reply = result.reply;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      tier = "local";
      modelUsed = `${GB10_VLLM_MODEL}@gb10`;
      // mark unhealthy on empty reply so next request retries
      if (!reply) throw new Error("empty reply from GB10");
    } catch (err) {
      console.warn("[chat] GB10 failed, falling back to cloud:", err);
      gb10Healthy = false;
      gb10LastCheck = Date.now();
      const cloudModel = userTier === "pro" ? CLOUD_MODEL_PRO : CLOUD_MODEL_FREE;
      const result = await callOpenRouter(messages, cloudModel, maxTokens);
      reply = result.reply;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      tier = "cloud";
      modelUsed = cloudModel;
    }
  } else {
    const cloudModel = userTier === "pro" ? CLOUD_MODEL_PRO : CLOUD_MODEL_FREE;
    const result = await callOpenRouter(messages, cloudModel, maxTokens);
    reply = result.reply;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    tier = "cloud";
    modelUsed = cloudModel;
  }

  const response: ChatResponse = { reply, modelUsed, tier, tokensIn, tokensOut };
  console.log(`[chat] tier=${tier} model=${modelUsed} in=${tokensIn} out=${tokensOut}`);
  return jsonResponse(response);
}

const VIBE_BANNED = new Set(["event", "events", "serata", "sera", "notte", "palermo", "sicilia", "musica", "music"]);

async function generateVibeTagsBatch(events: TagEvent[]): Promise<TagResult[]> {
  const systemPrompt = `Sei un esperto di vita notturna italiana. Per ogni evento, genera 3-4 tag vibe in italiano (snake_case, senza spazi, senza #). Rispondi SOLO con JSON: [{"id":"<id>","tags":["tag1","tag2","tag3"]}]. I tag devono essere specifici, evocativi, non generici.`;
  const userContent = events.map(e =>
    `ID: ${e.id}\nTitolo: ${e.title}${e.description ? `\nDesc: ${e.description.slice(0, 120)}` : ""}${e.category ? `\nCategoria: ${e.category}` : ""}${e.venue_name ? `\nVenue: ${e.venue_name}` : ""}`
  ).join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  let rawReply: string;
  try {
    const gb10Up = await checkGb10Health();
    const result = gb10Up
      ? await callGb10(messages, 400)
      : await callOpenRouter(messages, CLOUD_MODEL_FREE, 400);
    rawReply = result.reply;
  } catch (err) {
    console.warn("[tag] LLM call failed:", err);
    return events.map(e => ({ eventId: e.id, vibe_tags: [] }));
  }

  // Extract JSON from the reply
  const jsonMatch = rawReply.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("[tag] no JSON in reply:", rawReply.slice(0, 200));
    return events.map(e => ({ eventId: e.id, vibe_tags: [] }));
  }

  let parsed: { id: string; tags: string[] }[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn("[tag] JSON parse failed:", jsonMatch[0].slice(0, 200));
    return events.map(e => ({ eventId: e.id, vibe_tags: [] }));
  }

  return parsed.map(item => ({
    eventId: item.id,
    vibe_tags: (item.tags ?? [])
      .map((t: string) => t.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_àèìòùéê]/g, ""))
      .filter((t: string) => t.length >= 3 && !VIBE_BANNED.has(t))
      .slice(0, 4),
  }));
}

async function handleTag(req: Request): Promise<Response> {
  const body = (await req.json()) as TagRequest;
  const { events } = body;
  if (!Array.isArray(events) || events.length === 0) {
    return jsonResponse({ error: "events required" }, 400);
  }

  const BATCH_SIZE = 10;
  const results: TagResult[] = [];
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const batchResults = await generateVibeTagsBatch(batch);
    results.push(...batchResults);
  }

  console.log(`[tag] processed ${events.length} events`);
  return jsonResponse({ tags: results });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const server: Server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      const gb10Up = await checkGb10Health();
      return jsonResponse({ status: "ok", gb10: gb10Up, timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/chat" && req.method === "POST") {
      return handleChat(req);
    }

    if (url.pathname === "/tag" && req.method === "POST") {
      return handleTag(req);
    }

    return jsonResponse({ error: "not found" }, 404);
  },
  error(err) {
    console.error("[server] unhandled error:", err);
    return jsonResponse({ error: "internal server error" }, 500);
  },
});

console.log(`[lumio-gateway] listening on :${PORT}`);
console.log(`[lumio-gateway] GB10 vLLM: ${GB10_VLLM_URL}`);
