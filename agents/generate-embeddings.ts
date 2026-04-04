/**
 * Generate embeddings for all published events and store them in the database.
 * Uses OpenRouter API (openai/text-embedding-3-small, 1536 dims).
 *
 * Run standalone: npx tsx agents/generate-embeddings.ts
 * Or import generateMissingEmbeddings() to call from other agents.
 *
 * Safe to re-run: only processes events with missing embeddings.
 */

import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config, validateConfig } from "./config";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const BATCH_SIZE = 10; // Embed 10 events at a time (OpenRouter allows batching)
const DELAY_MS = 1000; // 1s between batches to avoid rate limits

/**
 * Build a rich text representation of an event for embedding.
 * Concatenates the most semantically relevant fields.
 */
function buildEventText(event: {
  title: string;
  description?: string | null;
  category_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
}): string {
  const parts: string[] = [];

  if (event.title) parts.push(event.title);
  if (event.category_name) parts.push(`Categoria: ${event.category_name}`);
  if (event.location_name) parts.push(`Luogo: ${event.location_name}`);
  if (event.location_address) parts.push(event.location_address);
  if (event.description) {
    // Truncate description to 500 chars to keep embedding focused
    const desc = event.description.slice(0, 500);
    parts.push(desc);
  }

  return parts.join(". ");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for all published events that don't have one yet.
 * Returns counts of processed and failed events.
 */
export async function generateMissingEmbeddings(): Promise<{ processed: number; failed: number; skipped: number }> {
  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.openRouterKey,
    defaultHeaders: {
      "HTTP-Referer": "https://crowdia.app",
      "X-Title": "Crowdia Embedding Generator",
    },
  });

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  console.log("🔍 Fetching events without embeddings...");

  // Paginate through all published events
  const allEvents: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("events_with_stats")
      .select("id, title, description, category_name, location_name, location_address")
      .eq("is_published", true)
      .order("event_start_time", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch events:", error);
      throw error;
    }
    if (!page || page.length === 0) break;
    allEvents.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (allEvents.length === 0) {
    console.log("No events found.");
    return { processed: 0, failed: 0, skipped: 0 };
  }

  // Paginate through all events that already have embeddings
  const allEmbeddedIds: string[] = [];
  from = 0;
  while (true) {
    const { data: page } = await supabase
      .from("events")
      .select("id")
      .not("embedding", "is", null)
      .range(from, from + PAGE_SIZE - 1);

    if (!page || page.length === 0) break;
    allEmbeddedIds.push(...page.map((e: { id: string }) => e.id));
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const embeddedIds = new Set(allEmbeddedIds);
  const toEmbed = allEvents.filter((e: { id: string }) => !embeddedIds.has(e.id));

  console.log(
    `📊 Total events: ${allEvents.length}, already embedded: ${embeddedIds.size}, to embed: ${toEmbed.length}`
  );

  if (toEmbed.length === 0) {
    console.log("✅ All events already have embeddings!");
    return { processed: 0, failed: 0, skipped: allEvents.length };
  }

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEventText);

    console.log(
      `\n⚡ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toEmbed.length / BATCH_SIZE)} (${batch.length} events)...`
    );

    try {
      const response = await openrouter.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });

      // Update each event with its embedding
      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const embedding = response.data[j]?.embedding;

        if (!embedding) {
          console.warn(`  ⚠️  No embedding for event "${event.title}"`);
          failed++;
          continue;
        }

        const { error: updateError } = await supabase
          .from("events")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", event.id);

        if (updateError) {
          console.warn(
            `  ❌ Failed to update event "${event.title}": ${updateError.message}`
          );
          failed++;
        } else {
          console.log(`  ✓ "${event.title.slice(0, 50)}"`);
          processed++;
        }
      }
    } catch (err) {
      console.error(`  ❌ Batch error:`, err);
      failed += batch.length;
    }

    // Rate limit delay between batches
    if (i + BATCH_SIZE < toEmbed.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Done! Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed, skipped: embeddedIds.size };
}

// Standalone entrypoint — only runs when executed directly, not when imported
const isMain = process.argv[1]?.endsWith("generate-embeddings.ts");
if (isMain) {
  validateConfig();
  generateMissingEmbeddings().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
