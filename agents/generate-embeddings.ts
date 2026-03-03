/**
 * Generate embeddings for all published events and store them in the database.
 * Uses OpenRouter API (openai/text-embedding-3-small, 1536 dims).
 *
 * Run: npx tsx agents/generate-embeddings.ts
 *
 * Safe to re-run: only processes events with missing or outdated embeddings.
 */

import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config, validateConfig } from "./config";

validateConfig();

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterKey,
  defaultHeaders: {
    "HTTP-Referer": "https://crowdia.app",
    "X-Title": "Crowdia Embedding Generator",
  },
});

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

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

async function main() {
  console.log("🔍 Fetching events without embeddings...");

  // Get all published events with their stats (for category_name, location fields)
  const { data: events, error } = await supabase
    .from("events_with_stats")
    .select("id, title, description, category_name, location_name, location_address")
    .eq("is_published", true)
    .order("event_start_time", { ascending: true });

  if (error) {
    console.error("Failed to fetch events:", error);
    process.exit(1);
  }

  if (!events || events.length === 0) {
    console.log("No events found.");
    return;
  }

  // Filter to events without embeddings by checking the events table directly
  const { data: withEmbeddings } = await supabase
    .from("events")
    .select("id")
    .not("embedding", "is", null);

  const embeddedIds = new Set((withEmbeddings ?? []).map((e: { id: string }) => e.id));
  const toEmbed = events.filter((e: { id: string }) => !embeddedIds.has(e.id));

  console.log(
    `📊 Total events: ${events.length}, already embedded: ${embeddedIds.size}, to embed: ${toEmbed.length}`
  );

  if (toEmbed.length === 0) {
    console.log("✅ All events already have embeddings!");
    return;
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
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
