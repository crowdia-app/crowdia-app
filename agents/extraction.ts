import { config } from "./config";
import {
  getEventSources,
  findEventByTitleAndDate,
  createEvent,
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

interface ExtractionStats {
  sourcesProcessed: number;
  eventsFound: number;
  eventsCreated: number;
  eventsDuplicate: number;
  eventsSkippedPast: number;
  eventsFailed: number;
  locationsCreated: number;
  organizersCreated: number;
}

interface ProcessedEvent {
  extracted: ExtractedEvent;
  source: EventSource;
}

export async function runExtractionAgent(): Promise<ExtractionStats> {
  const startTime = Date.now();
  const errors: string[] = [];

  const stats: ExtractionStats = {
    sourcesProcessed: 0,
    eventsFound: 0,
    eventsCreated: 0,
    eventsDuplicate: 0,
    eventsSkippedPast: 0,
    eventsFailed: 0,
    locationsCreated: 0,
    organizersCreated: 0,
  };

  try {
    console.log("Starting Extraction Agent...");
    console.log(`Target metro: ${config.targetMetro}`);
    console.log(`Max events per run: ${config.maxEventsPerRun}`);

    // Get event sources from database
    const sources = await getEventSources();
    console.log(`Found ${sources.length} event sources`);

    if (sources.length === 0) {
      console.log("No event sources configured. Add aggregators, locations, or organizers with event URLs.");
      return stats;
    }

    // Collect all events from all sources
    const allEvents: ProcessedEvent[] = [];

    for (const source of sources) {
      if (stats.eventsFound >= config.maxEventsPerRun) {
        console.log(`Reached max events limit (${config.maxEventsPerRun})`);
        break;
      }

      try {
        console.log(`\nProcessing source: ${source.name} (${source.type})`);
        console.log(`URL: ${source.url}`);

        // Fetch page content
        const content = await fetchPageWithFallback(source.url);
        console.log(`Fetched ${content.length} chars`);

        // Extract events using LLM
        const events = await extractEventsFromContent(content, source.name, source.url);
        console.log(`Extracted ${events.length} events from ${source.name}`);

        stats.sourcesProcessed++;

        // Add to collection
        for (const event of events) {
          if (allEvents.length < config.maxEventsPerRun) {
            allEvents.push({ extracted: event, source });
            stats.eventsFound++;
          }
        }

        // Rate limiting between sources
        await sleep(config.rateLimitMs);
      } catch (error) {
        const errorMsg = `Failed to process ${source.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`\nTotal events collected: ${allEvents.length}`);

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

        // Check for duplicate
        const existingId = await findEventByTitleAndDate(extracted.title, extracted.start_time);
        if (existingId) {
          console.log(`Duplicate: ${extracted.title}`);
          stats.eventsDuplicate++;
          continue;
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
    const report: AgentReport = {
      agentName: "Extraction Agent",
      status: errors.length === 0 ? "success" : errors.length < 3 ? "partial" : "failed",
      duration,
      stats: {
        "Sources Processed": stats.sourcesProcessed,
        "Events Found": stats.eventsFound,
        "Events Created": stats.eventsCreated,
        "Duplicates Skipped": stats.eventsDuplicate,
        "Past Events Skipped": stats.eventsSkippedPast,
        "Events Failed": stats.eventsFailed,
        "Locations Created": stats.locationsCreated,
        "Organizers Created": stats.organizersCreated,
      },
      errors,
    };

    await sendAgentReport(report);

    console.log("\n--- Extraction Complete ---");
    console.log(`Sources processed: ${stats.sourcesProcessed}`);
    console.log(`Events found: ${stats.eventsFound}`);
    console.log(`Events created: ${stats.eventsCreated}`);
    console.log(`Duplicates: ${stats.eventsDuplicate}`);
    console.log(`Past events skipped: ${stats.eventsSkippedPast}`);
    console.log(`Failed: ${stats.eventsFailed}`);

    return stats;
  } catch (error) {
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
