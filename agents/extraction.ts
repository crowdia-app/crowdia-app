import { config } from "./config";
import {
  getEventSources,
  findDuplicateEvent,
  createEvent,
  updateEvent,
  getEventById,
  findOrCreateLocation,
  findOrCreateOrganizer,
  findOrCreateCategory,
  type EventSource,
} from "./db";
import {
  fetchPageWithFallback,
  extractEventsFromContent,
  sendAgentReport,
  alertError,
  closeBrowser,
  type ExtractedEvent,
  type AgentReport,
} from "./tools";
import type { EventInsert } from "../types/database";
import { AgentLogger } from "./logger";

interface ExtractionStats {
  sourcesProcessed: number;
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDuplicateInRun: number;
  eventsDuplicateExact: number;
  eventsDuplicateFuzzy: number;
  eventsSkippedPast: number;
  eventsSkippedListingUrl: number;
  eventsFailed: number;
  locationsCreated: number;
  organizersCreated: number;
}

interface ProcessedEvent {
  extracted: ExtractedEvent;
  source: EventSource;
}

/**
 * Normalize title for comparison (lowercase, remove punctuation, normalize whitespace)
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // remove punctuation (unicode-aware)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two titles are similar (fuzzy match)
 * Returns true if titles match exactly after normalization, or if one contains the other
 */
function titlesAreSimilar(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // One title contains the other (handles truncated vs full titles)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check if they share a significant prefix (first 30 chars after normalization)
  const minLen = Math.min(norm1.length, norm2.length);
  if (minLen >= 30) {
    const prefix1 = norm1.substring(0, 30);
    const prefix2 = norm2.substring(0, 30);
    if (prefix1 === prefix2) return true;
  }

  return false;
}

interface SeenEvent {
  title: string;
  normalizedTitle: string;
  date: string;
}

/**
 * Check if an event is a duplicate of any previously seen event
 */
function isDuplicateOfSeen(title: string, startTime: string, seen: SeenEvent[]): boolean {
  const date = startTime.split("T")[0];
  const normalizedTitle = normalizeTitle(title);

  for (const event of seen) {
    if (event.date !== date) continue;

    // Check if titles are similar
    if (
      event.normalizedTitle === normalizedTitle ||
      event.normalizedTitle.includes(normalizedTitle) ||
      normalizedTitle.includes(event.normalizedTitle)
    ) {
      return true;
    }

    // Check shared prefix for longer titles
    const minLen = Math.min(event.normalizedTitle.length, normalizedTitle.length);
    if (minLen >= 30) {
      if (event.normalizedTitle.substring(0, 30) === normalizedTitle.substring(0, 30)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate confidence score for an extracted event (0-100)
 */
function calculateConfidence(event: ExtractedEvent): number {
  let score = 0;

  // Has image URL? (+20)
  if (event.image_url && event.image_url.length > 10) {
    score += 20;
  }

  // Has description > 50 chars? (+20)
  if (event.description && event.description.length > 50) {
    score += 20;
  }

  // Has ticket URL? (+15)
  if (event.ticket_url && event.ticket_url.length > 10) {
    score += 15;
  }

  // Has end_time different from start_time? (+10)
  if (event.end_time && event.end_time !== event.start_time) {
    score += 10;
  }

  // Has organizer name? (+15)
  if (event.organizer_name && event.organizer_name.length > 2) {
    score += 15;
  }

  // Has location address? (+20)
  if (event.location_address && event.location_address.length > 10) {
    score += 20;
  }

  return score;
}

/**
 * Detect if a URL is a listing page rather than a specific event page
 */
function isListingPageUrl(url: string): boolean {
  if (!url) return true;

  // Known listing page patterns
  const listingPatterns = [
    /ra\.co\/events\/[a-z]{2}\/[a-z-]+$/i, // ra.co/events/it/sicily (no event ID)
    /\/events\/?$/i, // ends with /events or /events/
    /\/eventi\/?$/i, // Italian: ends with /eventi
    /\/eventi-a-palermo\/?$/i, // palermoviva listing page
    /\/spettacoli\/[a-z]+\/?$/i, // teatro.it/spettacoli/palermo
    /xceed\.me\/[a-z]{2}\/[a-z]+\/events\/?$/i, // xceed.me/en/palermo/events
  ];

  for (const pattern of listingPatterns) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

export async function runExtractionAgent(): Promise<ExtractionStats> {
  const startTime = Date.now();
  const errors: string[] = [];
  const logger = new AgentLogger('extraction');

  const stats: ExtractionStats = {
    sourcesProcessed: 0,
    eventsFound: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDuplicateInRun: 0,
    eventsDuplicateExact: 0,
    eventsDuplicateFuzzy: 0,
    eventsSkippedPast: 0,
    eventsSkippedListingUrl: 0,
    eventsFailed: 0,
    locationsCreated: 0,
    organizersCreated: 0,
  };

  try {
    // Start the agent run in the database
    await logger.startRun();

    await logger.info("Starting Extraction Agent...");
    await logger.info(`Target metro: ${config.targetMetro}`);
    await logger.info(`Max events per run: ${config.maxEventsPerRun}`);

    // Get event sources from database
    const sources = await getEventSources();
    await logger.info(`Found ${sources.length} event sources`);

    if (sources.length === 0) {
      await logger.warn("No event sources configured. Add aggregators, locations, or organizers with event URLs.");
      await logger.completeRun('completed', stats, 'No event sources configured');
      return stats;
    }

    // Collect all events from all sources (with in-run deduplication)
    const allEvents: ProcessedEvent[] = [];
    const seenInRun: SeenEvent[] = []; // Track events seen in this run for fuzzy matching

    for (const source of sources) {
      if (stats.eventsFound >= config.maxEventsPerRun) {
        await logger.info(`Reached max events limit (${config.maxEventsPerRun})`);
        break;
      }

      try {
        await logger.info(`Processing source: ${source.name} (${source.type})`, { source_name: source.name, source_type: source.type, url: source.url });

        // Fetch page content
        const content = await fetchPageWithFallback(source.url);
        await logger.debug(`Fetched ${content.length} chars from ${source.name}`);

        // Extract events using LLM
        const events = await extractEventsFromContent(content, source.name, source.url);
        await logger.info(`Extracted ${events.length} events from ${source.name}`);

        // Log extraction details for debugging
        for (const event of events) {
          const hasImage = event.image_url && event.image_url.startsWith("http");
          const hasValidUrl = event.detail_url && !isListingPageUrl(event.detail_url);
          console.log(`  → ${event.title.substring(0, 50)}...`);
          console.log(`    URL: ${event.detail_url || "(none)"} ${hasValidUrl ? "✓" : "⚠ listing page"}`);
          console.log(`    Image: ${hasImage ? event.image_url?.substring(0, 50) + "..." : "(none)"}`);
        }

        stats.sourcesProcessed++;

        // Add to collection (with in-run deduplication using fuzzy matching)
        for (const event of events) {
          if (allEvents.length >= config.maxEventsPerRun) break;

          // Check for in-run duplicate using fuzzy matching
          if (isDuplicateOfSeen(event.title, event.start_time, seenInRun)) {
            console.log(`  Skipping in-run duplicate: ${event.title.substring(0, 40)}...`);
            stats.eventsDuplicateInRun++;
            continue;
          }

          // Add to seen events
          seenInRun.push({
            title: event.title,
            normalizedTitle: normalizeTitle(event.title),
            date: event.start_time.split("T")[0],
          });
          allEvents.push({ extracted: event, source });
          stats.eventsFound++;
        }

        // Rate limiting between sources
        await sleep(config.rateLimitMs);
      } catch (error) {
        const errorMsg = `Failed to process ${source.name}: ${error instanceof Error ? error.message : String(error)}`;
        await logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    await logger.info(`Total events collected: ${allEvents.length}`);

    // Process collected events
    for (const { extracted, source } of allEvents) {
      try {
        // Skip events in the past
        const eventDate = new Date(extracted.start_time);
        if (eventDate < new Date()) {
          console.log(`Skipping past event: ${extracted.title} (${extracted.start_time})`);
          stats.eventsSkippedPast++;
          continue;
        }

        // Skip events with listing page URLs instead of specific event URLs
        if (isListingPageUrl(extracted.detail_url)) {
          console.log(`Skipping event with listing URL: ${extracted.title}`);
          stats.eventsSkippedListingUrl++;
          continue;
        }

        // Check for duplicate (exact and fuzzy)
        const duplicateCheck = await findDuplicateEvent(extracted.title, extracted.start_time);

        if (duplicateCheck.isDuplicate && duplicateCheck.existingId) {
          if (duplicateCheck.matchType === "exact") {
            // Exact match - check if we should update
            const existing = await getEventById(duplicateCheck.existingId);
            const newConfidence = calculateConfidence(extracted);

            // Update if new data has higher confidence
            if (existing && newConfidence > (existing.confidence_score || 0)) {
              const updated = await updateEvent(duplicateCheck.existingId, {
                description: extracted.description || existing.description,
                cover_image_url: extracted.image_url || existing.cover_image_url,
                external_ticket_url: extracted.ticket_url || existing.external_ticket_url,
                confidence_score: newConfidence,
              });
              if (updated) {
                console.log(`Updated: ${extracted.title} (confidence ${existing.confidence_score} → ${newConfidence})`);
                stats.eventsUpdated++;
              }
            } else {
              console.log(`Duplicate: ${extracted.title}`);
              stats.eventsDuplicateExact++;
            }
            continue;
          } else {
            // Fuzzy match
            console.log(`Fuzzy duplicate: ${extracted.title}`);
            stats.eventsDuplicateFuzzy++;
            continue;
          }
        }

        // Find or create location
        const locationName = extracted.location_name || source.name;
        const { location, created: locationCreated } = await findOrCreateLocation(
          locationName,
          extracted.location_address
        );

        if (!location) {
          console.error(`Could not find/create location for: ${extracted.title}`);
          stats.eventsFailed++;
          continue;
        }

        if (locationCreated) {
          stats.locationsCreated++;
        }

        // Find or create organizer
        const organizerName = extracted.organizer_name || source.name;
        const { organizer, created: organizerCreated } = await findOrCreateOrganizer(organizerName);

        if (!organizer) {
          console.error(`Could not find/create organizer for: ${extracted.title}`);
          stats.eventsFailed++;
          continue;
        }

        if (organizerCreated) {
          stats.organizersCreated++;
        }

        // Find or create category
        const categoryId = extracted.category ? await findOrCreateCategory(extracted.category) : null;

        // Calculate confidence score
        const confidenceScore = calculateConfidence(extracted);

        // Create the event
        const eventData: EventInsert = {
          organizer_id: organizer.id,
          location_id: location.id,
          title: extracted.title,
          description: extracted.description || "",
          cover_image_url: extracted.image_url || "",
          event_start_time: extracted.start_time,
          event_end_time: extracted.end_time || extracted.start_time,
          external_ticket_url: extracted.ticket_url,
          category_id: categoryId,
          event_url: extracted.detail_url,
          source: source.type,
          is_published: true,
          confidence_score: confidenceScore,
        };

        const eventId = await createEvent(eventData);

        if (eventId) {
          console.log(`Created: ${extracted.title}`);
          stats.eventsCreated++;
        } else {
          stats.eventsFailed++;
        }
      } catch (error) {
        const errorMsg = `Failed to process event "${extracted.title}": ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        stats.eventsFailed++;
      }
    }

    // Send report
    const duration = Date.now() - startTime;
    const totalDuplicates = stats.eventsDuplicateInRun + stats.eventsDuplicateExact + stats.eventsDuplicateFuzzy;
    const report: AgentReport = {
      agentName: "Extraction Agent",
      status: errors.length === 0 ? "success" : errors.length < 3 ? "partial" : "failed",
      duration,
      stats: {
        "Sources Processed": stats.sourcesProcessed,
        "Events Found": stats.eventsFound,
        "Events Created": stats.eventsCreated,
        "Events Updated": stats.eventsUpdated,
        "Duplicates (In-Run)": stats.eventsDuplicateInRun,
        "Duplicates (Exact)": stats.eventsDuplicateExact,
        "Duplicates (Fuzzy)": stats.eventsDuplicateFuzzy,
        "Past Events Skipped": stats.eventsSkippedPast,
        "Listing URL Skipped": stats.eventsSkippedListingUrl,
        "Events Failed": stats.eventsFailed,
        "Locations Created": stats.locationsCreated,
        "Organizers Created": stats.organizersCreated,
      },
      errors,
    };

    await sendAgentReport(report);

    // Complete the agent run in the database
    const summary = `Processed ${stats.sourcesProcessed} sources, created ${stats.eventsCreated} events, updated ${stats.eventsUpdated} events`;
    await logger.completeRun(
      errors.length === 0 ? 'completed' : 'failed',
      stats,
      summary,
      errors.length > 0 ? errors.join('; ') : undefined
    );

    await logger.success("--- Extraction Complete ---");
    await logger.info(`Sources processed: ${stats.sourcesProcessed}`);
    await logger.info(`Events found: ${stats.eventsFound}`);
    await logger.info(`Events created: ${stats.eventsCreated}`);
    await logger.info(`Events updated: ${stats.eventsUpdated}`);
    await logger.info(`Duplicates: ${totalDuplicates} (${stats.eventsDuplicateInRun} in-run, ${stats.eventsDuplicateExact} exact, ${stats.eventsDuplicateFuzzy} fuzzy)`);
    await logger.info(`Past events skipped: ${stats.eventsSkippedPast}`);
    await logger.info(`Listing URL skipped: ${stats.eventsSkippedListingUrl}`);
    await logger.info(`Failed: ${stats.eventsFailed}`);

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Fatal error in extraction agent: ${errorMessage}`);
    await logger.completeRun('failed', stats, 'Agent failed with fatal error', errorMessage);
    await alertError(error instanceof Error ? error : new Error(String(error)), "Extraction Agent");
    throw error;
  } finally {
    // Clean up headless browser if it was used
    await closeBrowser();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
