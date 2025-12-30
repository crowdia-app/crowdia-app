import { config } from "./config";
import { getSupabase } from "./db";
import {
  searchEventSources,
  sendAgentReport,
  alertError,
  type SearchResult,
  type AgentReport,
} from "./tools";

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

  const stats: DiscoveryStats = {
    searchesPerformed: 0,
    resultsFound: 0,
    newSourcesAdded: 0,
    duplicatesSkipped: 0,
  };

  try {
    console.log("Starting Discovery Agent...");
    console.log(`Target metro: ${config.targetMetro}`);

    // Search for event sources
    const searchResults = await searchEventSources(config.targetMetro);
    stats.searchesPerformed = 5; // We run 5 different queries
    stats.resultsFound = searchResults.length;

    console.log(`Found ${searchResults.length} search results`);

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
              console.error(`Failed to add aggregator: ${error.message}`);
              errors.push(`Failed to add ${result.url}: ${error.message}`);
            }
          } else {
            console.log(`Added new source: ${result.url}`);
            existingUrls.add(normalizedUrl);
            stats.newSourcesAdded++;
          }
        }
      } catch (error) {
        const errorMsg = `Error processing ${result.url}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
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

    console.log("\n--- Discovery Complete ---");
    console.log(`Results found: ${stats.resultsFound}`);
    console.log(`New sources added: ${stats.newSourcesAdded}`);
    console.log(`Duplicates skipped: ${stats.duplicatesSkipped}`);

    return stats;
  } catch (error) {
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
