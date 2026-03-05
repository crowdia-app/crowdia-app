import "dotenv/config";
import { validateConfig } from "./config";
import { getSupabase } from "./db/client";

interface EventRecord {
  id: string;
  title: string;
  event_start_time: string;
  confidence_score: number | null;
  created_at: string | null;
  cover_image_url: string | null;
}

interface DuplicateGroup {
  title: string;
  event_date: string;
  events: EventRecord[];
  keep_id: string;
  delete_ids: string[];
}

/**
 * Normalize title for comparison (unicode-aware)
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two titles are similar (fuzzy match)
 */
function titlesAreSimilar(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // Exact match
  if (norm1 === norm2) return true;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Shared prefix (first 30 chars)
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen >= 30) {
    if (norm1.substring(0, 30) === norm2.substring(0, 30)) return true;
  }

  return false;
}

/**
 * Find and remove duplicate events in the database using fuzzy matching
 */
async function cleanupDuplicates(dryRun: boolean = true): Promise<void> {
  validateConfig();
  console.log(`Running duplicate cleanup (${dryRun ? "DRY RUN" : "LIVE MODE"})...\n`);

  const supabase = getSupabase();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, event_start_time, confidence_score, created_at, cover_image_url")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch events:", error.message);
    return;
  }

  if (!events || events.length === 0) {
    console.log("No events found.");
    return;
  }

  console.log(`Found ${events.length} total events\n`);

  // Group events by date first, then find duplicates within each date
  const byDate = new Map<string, EventRecord[]>();
  for (const event of events) {
    const date = event.event_start_time.split("T")[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(event);
  }

  // Find duplicate groups using fuzzy matching
  const duplicates: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (const [date, dateEvents] of byDate) {
    // Skip dates with only one event
    if (dateEvents.length < 2) continue;

    // Find similar events within this date
    for (let i = 0; i < dateEvents.length; i++) {
      if (processed.has(dateEvents[i].id)) continue;

      const group: EventRecord[] = [dateEvents[i]];
      processed.add(dateEvents[i].id);

      for (let j = i + 1; j < dateEvents.length; j++) {
        if (processed.has(dateEvents[j].id)) continue;

        if (titlesAreSimilar(dateEvents[i].title, dateEvents[j].title)) {
          group.push(dateEvents[j]);
          processed.add(dateEvents[j].id);
        }
      }

      if (group.length > 1) {
        // Sort: highest confidence first, then has image, then earliest created
        group.sort((a, b) => {
          const confDiff = (b.confidence_score || 0) - (a.confidence_score || 0);
          if (confDiff !== 0) return confDiff;

          const aHasImg = a.cover_image_url && a.cover_image_url.length > 0 ? 1 : 0;
          const bHasImg = b.cover_image_url && b.cover_image_url.length > 0 ? 1 : 0;
          if (aHasImg !== bHasImg) return bHasImg - aHasImg;

          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        duplicates.push({
          title: group[0].title,
          event_date: date,
          events: group,
          keep_id: group[0].id,
          delete_ids: group.slice(1).map((e) => e.id),
        });
      }
    }
  }

  // Second pass: find cross-date duplicates with identical normalized titles
  // Only flags events where at least one duplicate has event_start_time date == created_at date
  // (a reliable signal the date was set to "today" by the scraper rather than the real event date)
  const allEvents = events.filter((e) => !processed.has(e.id));
  const byNormalizedTitle = new Map<string, EventRecord[]>();
  for (const event of allEvents) {
    const norm = normalizeTitle(event.title);
    if (!byNormalizedTitle.has(norm)) {
      byNormalizedTitle.set(norm, []);
    }
    byNormalizedTitle.get(norm)!.push(event);
  }

  for (const [, titleEvents] of byNormalizedTitle) {
    if (titleEvents.length < 2) continue;

    // Only deduplicate if events span different dates
    const uniqueDates = new Set(titleEvents.map((e) => e.event_start_time.split("T")[0]));
    if (uniqueDates.size < 2) continue;

    // Only flag if at least one event has event_start_time date == created_at date
    // (the wrong-date signature from scraping)
    const hasWrongDateSignature = titleEvents.some(
      (e) => e.created_at && e.event_start_time.split("T")[0] === e.created_at.split("T")[0]
    );
    if (!hasWrongDateSignature) continue;

    // Sort: deprioritize events where event date == creation date (likely wrong date from scraping),
    // then by highest confidence, then has image, then earliest created
    titleEvents.sort((a, b) => {
      const aDateMatchesCreated = a.event_start_time.split("T")[0] === a.created_at?.split("T")[0] ? 1 : 0;
      const bDateMatchesCreated = b.event_start_time.split("T")[0] === b.created_at?.split("T")[0] ? 1 : 0;
      if (aDateMatchesCreated !== bDateMatchesCreated) return aDateMatchesCreated - bDateMatchesCreated;

      const confDiff = (b.confidence_score || 0) - (a.confidence_score || 0);
      if (confDiff !== 0) return confDiff;

      const aHasImg = a.cover_image_url && a.cover_image_url.length > 0 ? 1 : 0;
      const bHasImg = b.cover_image_url && b.cover_image_url.length > 0 ? 1 : 0;
      if (aHasImg !== bHasImg) return bHasImg - aHasImg;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    for (const e of titleEvents) processed.add(e.id);

    duplicates.push({
      title: titleEvents[0].title,
      event_date: "cross-date",
      events: titleEvents,
      keep_id: titleEvents[0].id,
      delete_ids: titleEvents.slice(1).map((e) => e.id),
    });
  }

  if (duplicates.length === 0) {
    console.log("No duplicates found!");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);

  let totalToDelete = 0;
  for (const dup of duplicates) {
    console.log(`"${dup.title.substring(0, 60)}${dup.title.length > 60 ? "..." : ""}" (${dup.event_date})`);
    console.log(`  Keep: ${dup.keep_id}`);
    console.log(`  Delete (${dup.delete_ids.length}):`);
    for (const event of dup.events.slice(1)) {
      console.log(`    - ${event.id}: "${event.title.substring(0, 50)}..."`);
    }
    totalToDelete += dup.delete_ids.length;
  }

  console.log(`\nTotal events to delete: ${totalToDelete}`);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes made. Run with --live to delete duplicates.");
    return;
  }

  // Delete duplicates
  console.log("\nDeleting duplicates...");
  let deleted = 0;

  for (const dup of duplicates) {
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .in("id", dup.delete_ids);

    if (deleteError) {
      console.error(`Failed to delete duplicates for "${dup.title}":`, deleteError.message);
    } else {
      deleted += dup.delete_ids.length;
      console.log(`Deleted ${dup.delete_ids.length} duplicate(s) of "${dup.title.substring(0, 40)}..."`);
    }
  }

  console.log(`\nDeleted ${deleted} duplicate events.`);
}

// Run
const args = process.argv.slice(2);
const dryRun = !args.includes("--live");
cleanupDuplicates(dryRun).catch(console.error);
