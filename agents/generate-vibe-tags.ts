/**
 * Generate Lumio Vibe Tags for published events that don't have them yet.
 * Uses OpenRouter (claude-haiku-4-5) to produce 3-4 Italian semantic tags per event.
 *
 * Run standalone: npx tsx agents/generate-vibe-tags.ts
 * Or import generateMissingVibeTags() to call from other agents.
 *
 * Safe to re-run: only processes events where vibe_tags IS NULL.
 */

import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config, validateConfig } from "./config";

const VIBE_MODEL = "anthropic/claude-haiku-4-5";
const BATCH_SIZE = 20;
const DELAY_MS = 1500; // conservative — Haiku has per-minute token limits
const MAX_TAGS = 4;
const MIN_TAGS = 3;

// Words that add no semantic value — strip from generated output
const BANNED_TAGS = new Set([
  "evento", "event", "palermo", "sicilia", "sicily", "italia", "italy",
  "serata", "notte", "night", "musica", "music",
]);

function buildVibePrompt(events: Array<{
  title: string;
  description?: string | null;
  category_name?: string | null;
  location_name?: string | null;
}>): string {
  const items = events.map((e, idx) => {
    const parts: string[] = [`[${idx}] Titolo: ${e.title}`];
    if (e.category_name) parts.push(`Categoria: ${e.category_name}`);
    if (e.location_name) parts.push(`Luogo: ${e.location_name}`);
    if (e.description) parts.push(`Descrizione: ${e.description.slice(0, 300)}`);
    return parts.join(" | ");
  });

  return `Sei Lumio, la guida AI di Crowdia per la vita culturale e notturna di Palermo.

Per ogni evento nella lista, genera esattamente ${MIN_TAGS}-${MAX_TAGS} vibe tag brevi (2-3 parole ciascuno) che catturano il mood e il pubblico dell'evento. I tag devono essere in italiano, minuscoli, senza hashtag, senza virgolette. Privilegia termini che evocano atmosfera (es. "clubbing notturno", "aperitivo rilassato", "performance live") rispetto a categorie generiche.

Lista eventi:
${items.join("\n")}

Rispondi SOLO con un array JSON con ${events.length} elementi, dove ogni elemento è un array di tag strings. Esempio:
[["vinile only","clubbing notturno","late night"],["arte urbana","family friendly","pomeriggio creativo"]]`;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().trim().replace(/[#"']/g, ""))
    .filter((t) => t.length >= 3 && t.length <= 40)
    .filter((t) => !BANNED_TAGS.has(t));

  // Deduplicate, cap at MAX_TAGS
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate Lumio Vibe Tags for all published events that don't have them yet.
 * Returns counts of processed and failed events.
 */
export async function generateMissingVibeTags(): Promise<{ processed: number; failed: number; skipped: number }> {
  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.openRouterKey,
    defaultHeaders: {
      "HTTP-Referer": "https://crowdia.app",
      "X-Title": "Crowdia Lumio Vibe Tag Generator",
    },
  });

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  console.log("💡 Fetching events without vibe tags...");

  // Fetch all published events that don't have vibe_tags yet, in pages
  const toTag: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("events")
      .select("id, title, description, location_id")
      .eq("is_published", true)
      .is("vibe_tags", null)
      .order("event_start_time", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch events:", error);
      throw error;
    }
    if (!page || page.length === 0) break;
    toTag.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (toTag.length === 0) {
    console.log("✅ All events already have vibe tags!");
    return { processed: 0, failed: 0, skipped: 0 };
  }

  // Fetch location names + category names for context
  const eventIds = toTag.map((e) => e.id);
  const { data: statsRows } = await supabase
    .from("events_with_stats")
    .select("id, category_name, location_name")
    .in("id", eventIds.slice(0, 1000)); // Supabase IN limit

  const statsByid = new Map(
    (statsRows ?? []).map((r: any) => [r.id, r])
  );

  const enriched = toTag.map((e) => ({
    ...e,
    category_name: statsByid.get(e.id)?.category_name ?? null,
    location_name: statsByid.get(e.id)?.location_name ?? null,
  }));

  console.log(`📊 Events to tag: ${enriched.length}`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);

    console.log(
      `\n💡 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(enriched.length / BATCH_SIZE)} (${batch.length} events)...`
    );

    let tagResults: string[][] = [];

    try {
      const completion = await openrouter.chat.completions.create({
        model: VIBE_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "user", content: buildVibePrompt(batch) },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";

      // Extract JSON array from response (strip any surrounding text)
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error(`No JSON array in response: ${raw.slice(0, 200)}`);

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) throw new Error("Response is not an array");

      tagResults = parsed;
    } catch (err) {
      console.error(`  ❌ LLM batch error:`, err instanceof Error ? err.message : err);
      failed += batch.length;
      if (i + BATCH_SIZE < enriched.length) await sleep(DELAY_MS);
      continue;
    }

    // Persist each event's tags
    for (let j = 0; j < batch.length; j++) {
      const event = batch[j];
      const rawTags = tagResults[j];
      const tags = sanitizeTags(rawTags);

      if (tags.length < MIN_TAGS) {
        console.warn(`  ⚠️  Too few tags for "${event.title}" (got ${tags.length}), skipping`);
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({ vibe_tags: tags })
        .eq("id", event.id);

      if (updateError) {
        console.warn(`  ❌ Failed to update "${event.title}": ${updateError.message}`);
        failed++;
      } else {
        console.log(`  ✓ "${event.title.slice(0, 45)}" → [${tags.join(", ")}]`);
        processed++;
      }
    }

    if (i + BATCH_SIZE < enriched.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Done! Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed, skipped: 0 };
}

// Standalone entrypoint
const isMain = process.argv[1]?.endsWith("generate-vibe-tags.ts");
if (isMain) {
  validateConfig();
  generateMissingVibeTags().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
