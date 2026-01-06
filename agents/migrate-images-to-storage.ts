/**
 * Migrate event images to Supabase Storage
 *
 * Downloads images from external URLs and stores them in our bucket,
 * then updates the cover_image_url to point to the stored image.
 *
 * Run with: npx tsx agents/migrate-images-to-storage.ts
 */

import { getSupabase } from "./db/client";
import { uploadEventImage, isStoredInBucket } from "./tools/image-storage";

interface MigrationStats {
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  alreadyStored: number;
}

async function migrateImages(batchSize = 50): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    alreadyStored: 0,
  };

  const supabase = getSupabase();

  // Get events with external image URLs (not already in our bucket)
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, cover_image_url")
    .not("cover_image_url", "eq", "")
    .not("cover_image_url", "is", null)
    .not("cover_image_url", "like", "%supabase.co%")
    .limit(batchSize);

  if (error) {
    console.error("Failed to fetch events:", error.message);
    return stats;
  }

  if (!events || events.length === 0) {
    console.log("No events to process");
    return stats;
  }

  stats.total = events.length;
  console.log(`Processing ${events.length} events...\n`);

  for (const event of events) {
    const shortTitle = event.title.substring(0, 50);
    process.stdout.write(`${shortTitle}... `);

    // Skip if already in our bucket
    if (isStoredInBucket(event.cover_image_url)) {
      console.log("✓ already stored");
      stats.alreadyStored++;
      continue;
    }

    // Upload to storage
    const result = await uploadEventImage(event.id, event.cover_image_url);

    if (result.success && result.publicUrl) {
      // Update the event with the new URL
      const { error: updateError } = await supabase
        .from("events")
        .update({ cover_image_url: result.publicUrl })
        .eq("id", event.id);

      if (updateError) {
        console.log(`✗ update failed: ${updateError.message}`);
        stats.failed++;
      } else {
        console.log("✓ uploaded");
        stats.uploaded++;
      }
    } else {
      console.log(`✗ ${result.error || "failed"}`);
      if (result.error === "Invalid image URL") {
        stats.skipped++;
      } else {
        stats.failed++;
      }
    }

    // Rate limit to avoid overwhelming the storage service
    await new Promise((r) => setTimeout(r, 200));
  }

  return stats;
}

async function main() {
  console.log("=== Image Migration to Supabase Storage ===\n");

  // Run multiple batches until all images are migrated
  let totalStats: MigrationStats = {
    total: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    alreadyStored: 0,
  };

  let batchNum = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`\n--- Batch ${batchNum} ---\n`);
    const stats = await migrateImages(50);

    totalStats.total += stats.total;
    totalStats.uploaded += stats.uploaded;
    totalStats.skipped += stats.skipped;
    totalStats.failed += stats.failed;
    totalStats.alreadyStored += stats.alreadyStored;

    // If we got fewer than 50 events, we're done
    // Continue if we uploaded any OR if we have failed ones (they might succeed on retry)
    if (stats.total < 50) {
      hasMore = false;
    }

    // Stop if no progress in this batch (all already stored or all failed)
    if (stats.uploaded === 0 && stats.alreadyStored > 0) {
      hasMore = false;
    }

    batchNum++;

    // Safety limit
    if (batchNum > 20) {
      console.log("\nReached batch limit (20). Run again to continue.");
      break;
    }
  }

  console.log("\n=== Migration Complete ===");
  console.log(`Total processed: ${totalStats.total}`);
  console.log(`Uploaded: ${totalStats.uploaded}`);
  console.log(`Already stored: ${totalStats.alreadyStored}`);
  console.log(`Skipped (invalid): ${totalStats.skipped}`);
  console.log(`Failed: ${totalStats.failed}`);
}

main().catch(console.error);
