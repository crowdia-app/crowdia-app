/**
 * Pre-compute similar_event_ids for upcoming published events.
 * Uses the similar_events(event_id, limit_count) RPC (pgvector cosine distance)
 * and caches the result in events.similar_event_ids to avoid per-load RPC calls.
 *
 * Run standalone: npx tsx agents/generate-similar-events.ts
 * Or import generateSimilarEvents() to call from other agents.
 *
 * Idempotent: skips events updated within the last 24 hours.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { config, validateConfig } from "./config";

const BATCH_SIZE = 50;
const DELAY_MS = 500;
const SIMILAR_LIMIT = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-compute similar_event_ids for all upcoming published events that
 * either have never been computed or were computed more than 24 hours ago.
 */
export async function generateSimilarEvents(): Promise<{ processed: number; failed: number; skipped: number }> {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  console.log("🔗 Fetching upcoming events needing similar-events computation...");

  // Fetch upcoming published events with embeddings, skipping those computed in the last 24h
  const toProcess: Array<{ id: string; title: string }> = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  while (true) {
    const { data: page, error } = await supabase
      .from("events")
      .select("id, title")
      .eq("is_published", true)
      .gte("event_start_time", new Date().toISOString())
      .not("embedding", "is", null)
      .or(`similar_events_updated_at.is.null,similar_events_updated_at.lt.${cutoff}`)
      .order("event_start_time", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch events:", error);
      throw error;
    }
    if (!page || page.length === 0) break;
    toProcess.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (toProcess.length === 0) {
    console.log("✅ All upcoming events already have fresh similar_event_ids!");
    return { processed: 0, failed: 0, skipped: 0 };
  }

  console.log(`📊 Events to process: ${toProcess.length}`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    console.log(
      `\n🔗 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toProcess.length / BATCH_SIZE)} (${batch.length} events)...`
    );

    for (const event of batch) {
      const { data: similar, error: rpcError } = await supabase.rpc("similar_events", {
        event_id: event.id,
        limit_count: SIMILAR_LIMIT,
      });

      if (rpcError) {
        console.warn(`  ❌ RPC error for "${event.title}": ${rpcError.message}`);
        failed++;
        continue;
      }

      const similarIds = ((similar as Array<{ id: string }>) ?? []).map((e) => e.id);

      const { error: updateError } = await supabase
        .from("events")
        .update({
          similar_event_ids: similarIds.length > 0 ? similarIds : [],
          similar_events_updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (updateError) {
        console.warn(`  ❌ Failed to update "${event.title}": ${updateError.message}`);
        failed++;
      } else {
        console.log(`  ✓ "${event.title.slice(0, 50)}" → ${similarIds.length} similar`);
        processed++;
      }
    }

    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Done! Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed, skipped: 0 };
}

// Standalone entrypoint
const isMain = process.argv[1]?.endsWith("generate-similar-events.ts");
if (isMain) {
  validateConfig();
  generateSimilarEvents().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
