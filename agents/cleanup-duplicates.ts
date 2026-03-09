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
  event_url: string | null;
  source: string | null;
}

interface DuplicateGroup {
  title: string;
  event_date: string;
  reason: "same-day-title" | "cross-date-title" | "event-url";
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

  // One contains the other (only if the shorter one is >= 10 chars to avoid false positives)
  const shorter = norm1.length <= norm2.length ? norm1 : norm2;
  const longer = norm1.length <= norm2.length ? norm2 : norm1;
  if (shorter.length >= 10 && longer.includes(shorter)) return true;

  // Shared prefix (first 30 chars)
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen >= 30) {
    if (norm1.substring(0, 30) === norm2.substring(0, 30)) return true;
  }

  return false;
}

/**
 * Sort a group of events, best candidate first (keep this one)
 */
function sortByQuality(events: EventRecord[]): EventRecord[] {
  return [...events].sort((a, b) => {
    // Prefer events where event date != creation date (not a scraping-date artifact)
    const aDateMatchesCreated = a.event_start_time.split("T")[0] === a.created_at?.split("T")[0] ? 1 : 0;
    const bDateMatchesCreated = b.event_start_time.split("T")[0] === b.created_at?.split("T")[0] ? 1 : 0;
    if (aDateMatchesCreated !== bDateMatchesCreated) return aDateMatchesCreated - bDateMatchesCreated;

    // Highest confidence first
    const confDiff = (b.confidence_score || 0) - (a.confidence_score || 0);
    if (confDiff !== 0) return confDiff;

    // Prefer events with an image
    const aHasImg = a.cover_image_url && a.cover_image_url.length > 0 ? 1 : 0;
    const bHasImg = b.cover_image_url && b.cover_image_url.length > 0 ? 1 : 0;
    if (aHasImg !== bHasImg) return bHasImg - aHasImg;

    // Earliest created wins (was entered first)
    return new Date(a.created_at ?? "").getTime() - new Date(b.created_at ?? "").getTime();
  });
}

/**
 * Normalize a URL for comparison (lowercase, strip trailing slash and common tracking params)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    // Remove common tracking query params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ref"];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Lowercase hostname, keep path as-is, strip trailing slash
    return (parsed.hostname.toLowerCase() + parsed.pathname.replace(/\/$/, "") + parsed.search).toLowerCase();
  } catch {
    // Not a valid URL, just normalize as a string
    return url.trim().toLowerCase().replace(/\/$/, "");
  }
}

/**
 * Fetch all events with pagination (Supabase default limit is 1000 rows)
 */
async function fetchAllEvents(): Promise<EventRecord[]> {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  const allEvents: EventRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("events")
      .select("id, title, event_start_time, confidence_score, created_at, cover_image_url, event_url, source")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch events:", error.message);
      break;
    }

    if (!data || data.length === 0) break;

    allEvents.push(...data);
    console.log(`  Fetched ${allEvents.length} events so far...`);

    if (data.length < PAGE_SIZE) break; // Last page
    from += PAGE_SIZE;
  }

  return allEvents;
}

/**
 * Find and remove duplicate events in the database using multiple signals
 */
async function cleanupDuplicates(dryRun: boolean = true): Promise<void> {
  validateConfig();
  console.log(`Running duplicate cleanup (${dryRun ? "DRY RUN" : "LIVE MODE"})...\n`);

  const events = await fetchAllEvents();

  if (events.length === 0) {
    console.log("No events found.");
    return;
  }

  console.log(`\nFound ${events.length} total events\n`);

  const duplicates: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // ── Pass 1: event_url deduplication (strongest signal) ──────────────────
  // If two events share the same non-null event_url they are definitely the same event,
  // regardless of title or date differences.
  const byEventUrl = new Map<string, EventRecord[]>();
  for (const event of events) {
    if (!event.event_url) continue;
    const key = normalizeUrl(event.event_url);
    if (!byEventUrl.has(key)) byEventUrl.set(key, []);
    byEventUrl.get(key)!.push(event);
  }

  for (const [, urlEvents] of byEventUrl) {
    if (urlEvents.length < 2) continue;

    const sorted = sortByQuality(urlEvents);
    for (const e of sorted) processed.add(e.id);

    duplicates.push({
      title: sorted[0].title,
      event_date: "url-match",
      reason: "event-url",
      events: sorted,
      keep_id: sorted[0].id,
      delete_ids: sorted.slice(1).map((e) => e.id),
    });
  }

  // ── Pass 2: same-day fuzzy title deduplication ──────────────────────────
  const remainingAfterUrlPass = events.filter((e) => !processed.has(e.id));

  const byDate = new Map<string, EventRecord[]>();
  for (const event of remainingAfterUrlPass) {
    const date = event.event_start_time.split("T")[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(event);
  }

  for (const [date, dateEvents] of byDate) {
    if (dateEvents.length < 2) continue;

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
        const sorted = sortByQuality(group);
        duplicates.push({
          title: sorted[0].title,
          event_date: date,
          reason: "same-day-title",
          events: sorted,
          keep_id: sorted[0].id,
          delete_ids: sorted.slice(1).map((e) => e.id),
        });
      }
    }
  }

  // ── Pass 3: cross-date fuzzy title deduplication ────────────────────────
  // Only flags events where at least one duplicate has event_start_time date == created_at date
  // (a reliable signal the date was set to "today" by the scraper rather than the real event date)
  const remainingAfterSameDayPass = events.filter((e) => !processed.has(e.id));

  const byNormalizedTitle = new Map<string, EventRecord[]>();
  for (const event of remainingAfterSameDayPass) {
    const norm = normalizeTitle(event.title);
    if (!byNormalizedTitle.has(norm)) byNormalizedTitle.set(norm, []);
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

    const sorted = sortByQuality(titleEvents);
    for (const e of sorted) processed.add(e.id);

    duplicates.push({
      title: sorted[0].title,
      event_date: "cross-date",
      reason: "cross-date-title",
      events: sorted,
      keep_id: sorted[0].id,
      delete_ids: sorted.slice(1).map((e) => e.id),
    });
  }

  // ── Report ───────────────────────────────────────────────────────────────
  if (duplicates.length === 0) {
    console.log("No duplicates found!");
    return;
  }

  const byReason = {
    "event-url": duplicates.filter((d) => d.reason === "event-url"),
    "same-day-title": duplicates.filter((d) => d.reason === "same-day-title"),
    "cross-date-title": duplicates.filter((d) => d.reason === "cross-date-title"),
  };

  console.log(`Found ${duplicates.length} duplicate groups:`);
  console.log(`  • URL match:        ${byReason["event-url"].length}`);
  console.log(`  • Same-day title:   ${byReason["same-day-title"].length}`);
  console.log(`  • Cross-date title: ${byReason["cross-date-title"].length}`);
  console.log();

  let totalToDelete = 0;
  for (const dup of duplicates) {
    const label = dup.reason === "event-url" ? `[URL] (${dup.events[0].event_url?.substring(0, 50)})` : `(${dup.event_date})`;
    console.log(`"${dup.title.substring(0, 60)}${dup.title.length > 60 ? "..." : ""}" ${label}`);
    console.log(`  Keep: ${dup.keep_id}`);
    console.log(`  Delete (${dup.delete_ids.length}):`);
    for (const event of dup.events.slice(1)) {
      console.log(`    - ${event.id}: "${event.title.substring(0, 50)}"`);
    }
    totalToDelete += dup.delete_ids.length;
  }

  console.log(`\nTotal events to delete: ${totalToDelete}`);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes made. Run with --live to delete duplicates.");
    return;
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  console.log("\nDeleting duplicates...");
  const supabase = getSupabase();
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
