import { config } from "./config";
import { getSupabase } from "./db";
import {
  searchEventSources,
  sendAgentReport,
  alertError,
  type SearchResult,
  type AgentReport,
} from "./tools";
import { AgentLogger } from "./logger";

interface DiscoveryStats {
  searchesPerformed: number;
  resultsFound: number;
  newSourcesAdded: number;
  duplicatesSkipped: number;
}

// Known event aggregator patterns
const AGGREGATOR_PATTERNS = [
  { pattern: /eventbrite\.(com|it)/i, name: "Eventbrite" },
  { pattern: /dice\.fm/i, name: "Dice" },
  { pattern: /ra\.co/i, name: "Resident Advisor" },
  { pattern: /xceed\.me/i, name: "Xceed" },
  { pattern: /clubbable\.com/i, name: "Clubbable" },
  { pattern: /songkick\.com/i, name: "Songkick" },
  { pattern: /bandsintown\.com/i, name: "Bandsintown" },
  { pattern: /facebook\.com\/events/i, name: "Facebook Events" },
];

// Patterns that likely indicate an event page
const EVENT_PAGE_PATTERNS = [
  /eventi/i,
  /events/i,
  /concerti/i,
  /concerts/i,
  /nightlife/i,
  /clubbing/i,
  /discoteca/i,
  /calendario/i,
  /programma/i,
];

export async function runDiscoveryAgent(): Promise<DiscoveryStats> {
  const startTime = Date.now();
  const errors: string[] = [];
  const logger = new AgentLogger('discovery');

  const stats: DiscoveryStats = {
    searchesPerformed: 0,
    resultsFound: 0,
    newSourcesAdded: 0,
    duplicatesSkipped: 0,
  };

  try {
    // Start the agent run in the database
    await logger.startRun();

    await logger.info("Starting Discovery Agent...");
    await logger.info(`Target metro: ${config.targetMetro}`);

    // Search for event sources
    const searchResults = await searchEventSources(config.targetMetro);
    stats.searchesPerformed = 5; // We run 5 different queries
    stats.resultsFound = searchResults.length;

    await logger.info(`Found ${searchResults.length} search results`);

    // Get existing aggregator URLs
    const { data: existingAggregators } = await getSupabase()
      .from("event_aggregators")
      .select("base_url, events_url");

    const existingUrls = new Set<string>();
    existingAggregators?.forEach((a) => {
      if (a.base_url) existingUrls.add(normalizeUrl(a.base_url));
      if (a.events_url) existingUrls.add(normalizeUrl(a.events_url));
    });

    // Process search results
    for (const result of searchResults) {
      try {
        const normalizedUrl = normalizeUrl(result.url);

        // Skip if already tracked
        if (existingUrls.has(normalizedUrl)) {
          stats.duplicatesSkipped++;
          continue;
        }

        // Check if it matches known aggregator patterns
        const aggregatorMatch = AGGREGATOR_PATTERNS.find((p) => p.pattern.test(result.url));

        // Check if URL/title suggests event content
        const looksLikeEventPage =
          EVENT_PAGE_PATTERNS.some((p) => p.test(result.url) || p.test(result.title));

        if (aggregatorMatch || looksLikeEventPage) {
          // Add as new aggregator
          const slug = extractSiteName(result.url).toLowerCase().replace(/[^a-z0-9]+/g, "-");

          const { error } = await getSupabase().from("event_aggregators").insert({
            name: aggregatorMatch?.name || extractSiteName(result.url),
            slug,
            base_url: getBaseUrl(result.url),
            events_url: result.url,
            is_active: false, // Require manual review
            scrape_priority: aggregatorMatch ? 5 : 3,
          });

          if (error) {
            if (error.code === "23505") {
              // Unique constraint violation
              stats.duplicatesSkipped++;
            } else {
              await logger.error(`Failed to add aggregator: ${error.message}`);
              errors.push(`Failed to add ${result.url}: ${error.message}`);
            }
          } else {
            await logger.success(`Added new source: ${result.url}`);
            existingUrls.add(normalizedUrl);
            stats.newSourcesAdded++;
          }
        }
      } catch (error) {
        const errorMsg = `Error processing ${result.url}: ${error instanceof Error ? error.message : String(error)}`;
        await logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Send report
    const duration = Date.now() - startTime;
    const report: AgentReport = {
      agentName: "Discovery Agent",
      status: errors.length === 0 ? "success" : errors.length < 3 ? "partial" : "failed",
      duration,
      stats: {
        "Searches Performed": stats.searchesPerformed,
        "Results Found": stats.resultsFound,
        "New Sources Added": stats.newSourcesAdded,
        "Duplicates Skipped": stats.duplicatesSkipped,
      },
      errors,
    };

    await sendAgentReport(report);

    // Complete the agent run in the database
    const summary = `Found ${stats.resultsFound} results, added ${stats.newSourcesAdded} new sources`;
    await logger.completeRun(
      errors.length === 0 ? 'completed' : 'failed',
      stats,
      summary,
      errors.length > 0 ? errors.join('; ') : undefined
    );

    await logger.success("--- Discovery Complete ---");
    await logger.info(`Results found: ${stats.resultsFound}`);
    await logger.info(`New sources added: ${stats.newSourcesAdded}`);
    await logger.info(`Duplicates skipped: ${stats.duplicatesSkipped}`);

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Fatal error in discovery agent: ${errorMessage}`);
    await logger.completeRun('failed', stats, 'Agent failed with fatal error', errorMessage);
    await alertError(error instanceof Error ? error : new Error(String(error)), "Discovery Agent");
    throw error;
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "");
  } catch {
    return url.toLowerCase();
  }
}

function getBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return url;
  }
}

function extractSiteName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname
      .split(".")[0]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "Unknown Source";
  }
}
