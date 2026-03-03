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
  cleanupStuckRuns,
  createEventMention,
  updateSourceLastScraped,
  extractMentions,
  extractHashtags,
  updateHashtagStats,
  queuePotentialSources,
  queueWebsiteSources,
  queueOrganizerNames,
  type EventSource,
} from "./db";
import {
  fetchPageWithFallback,
  fetchPageDirect,
  extractEventsFromContent,
  extractEventsFromInstagramPosts,
  sendAgentReport,
  alertError,
  closeBrowser,
  uploadEventImage,
  preUploadInstagramImages,
  isGenericImageUrl,
  withRetry,
  SOURCE_RETRY_OPTIONS,
  scrapeInstagramProfile,
  isApifyConfigured,
  extractLinksFromHtml,
  extractOrganizerNames,
  extractVenueNames,
  extractHtmlMetadata,
  normalizePalermoDatetime,
  type ExtractedEvent,
  type AgentReport,
  type InstagramPost,
  type ExtractedLinks,
} from "./tools";
import type { EventInsert } from "../types/database";
import { AgentLogger } from "./logger";

interface ExtractionStats {
  sourcesProcessed: number;
  sourcesFailed: number;
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDuplicateInRun: number;
  eventsDuplicateExact: number;
  eventsDuplicateFuzzy: number;
  eventsSkippedPast: number;
  eventsSkippedListingUrl: number;
  eventsSkippedNonPalermo: number;
  eventsFailed: number;
  locationsCreated: number;
  organizersCreated: number;
  rateLimitErrors: number;
  imagesStored: number;
  // Instagram-specific stats
  instagramSourcesProcessed: number;
  instagramPostsScraped: number;
  instagramApifyCost: number;
  // Discovery v2 stats
  mentionsExtracted: number;
  hashtagsExtracted: number;
  potentialSourcesQueued: number;
  collabUsersExtracted: number;
  // Web crawling stats
  socialLinksExtracted: number;
  eventPlatformLinksExtracted: number;
  websiteSourcesQueued: number;
  organizerNamesQueued: number;
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

/**
 * Sources that legitimately only have listing page URLs
 * Events from these sources are accepted even with listing URLs
 */
const TRUSTED_LISTING_SOURCES = new Set([
  "teatro.it",
  "palermoviva.it",
  "sanlorenzomercato.it",
  "palermotoday.it",
  "feverup.com",
  "instagram.com", // Instagram posts are their own detail pages
]);

function isTrustedListingSource(url: string): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return TRUSTED_LISTING_SOURCES.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Enrich events by fetching their specific detail pages.
 *
 * When events are extracted from listing pages, the data can be incomplete:
 * - Dates may be generic (e.g., "March 2026" → defaulted to March 1)
 * - Images may be missing (listing page thumbnails are unreliable)
 * - Descriptions may be truncated
 *
 * This function fetches each event's detail URL and extracts better data
 * from HTML metadata (JSON-LD structured data, og: tags, <time> elements).
 */
async function enrichEventsFromDetailPages(
  events: ExtractedEvent[],
  sourceUrl: string,
  logger: AgentLogger
): Promise<void> {
  let sourceHost: string;
  try {
    sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return;
  }

  for (const event of events) {
    if (!event.detail_url || isListingPageUrl(event.detail_url)) continue;

    // Only enrich from same-domain detail pages to avoid crawling external sites
    let detailHost: string;
    try {
      detailHost = new URL(event.detail_url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (detailHost !== sourceHost) continue;

    // Only enrich if we're missing key data — avoids unnecessary HTTP requests.
    // Also enrich if the image is generic (listing-page og:image that will be
    // stripped later) or if the date looks like a first-of-month default set by
    // the LLM when the listing page only says "March 2026" with no specific day.
    const needsImage = !event.image_url || isGenericImageUrl(event.image_url);
    const needsDescription = !event.description || event.description.length < 100;
    const needsDate = /-\d{2}-01T/.test(event.start_time); // day=01 → likely defaulted
    if (!needsImage && !needsDescription && !needsDate) continue;

    try {
      const html = await fetchPageDirect(event.detail_url);
      const meta = extractHtmlMetadata(html);

      if (meta.image && needsImage && !isGenericImageUrl(meta.image)) {
        event.image_url = meta.image;
        await logger.debug(
          `Detail page image for "${event.title.slice(0, 30)}": ${meta.image.slice(0, 60)}`
        );
      }

      if (needsDescription) {
        // Prefer og:description / JSON-LD description
        if (meta.description && meta.description.length > (event.description?.length ?? 0)) {
          event.description = meta.description;
          await logger.debug(
            `Detail page description for "${event.title.slice(0, 30)}": ${meta.description.slice(0, 60)}`
          );
        } else if (
          (!event.description || event.description.length < 50) &&
          meta.bodyText && meta.bodyText.length > 80
        ) {
          // Fall back to extracted body text excerpt
          event.description = meta.bodyText.slice(0, 500);
          await logger.debug(
            `Body text description for "${event.title.slice(0, 30)}": ${event.description.slice(0, 60)}`
          );
        }
      }

      // Prefer the detail page date — it's the authoritative source for this event
      if (meta.startDate) {
        // Preserve extracted time component if detail page only has a date
        const timeComponent = event.start_time.includes("T")
          ? event.start_time.split("T")[1].replace(/[+-]\d{2}:\d{2}$/, "").replace(/Z$/, "")
          : "21:00:00";
        const rawStartTime = meta.startDate.includes("T")
          ? meta.startDate
          : `${meta.startDate}T${timeComponent}`;
        const normalizedStart = normalizePalermoDatetime(rawStartTime);
        if (normalizedStart && normalizedStart !== event.start_time) {
          await logger.debug(
            `Updated date for "${event.title.slice(0, 30)}" via detail page: ${event.start_time} → ${normalizedStart}`
          );
          event.start_time = normalizedStart;
        }
        if (meta.endDate) {
          const normalizedEnd = normalizePalermoDatetime(meta.endDate);
          if (normalizedEnd) event.end_time = normalizedEnd;
        }
      }
    } catch {
      // Enrichment is non-critical — continue without it
    }

    // Brief pause to avoid hammering the site
    await new Promise((r) => setTimeout(r, 300));
  }
}

/**
 * Regex patterns for locations clearly outside Palermo/Sicily.
 * Used as a safety net after LLM extraction to catch any non-local events
 * that slip through the LLM's location filter instruction.
 */
const NON_PALERMO_PATTERNS = [
  // Foreign countries
  /\bfrance\b/i, /\bfrancia\b/i, /\bgermany\b/i, /\bdeutschland\b/i,
  /\bspain\b/i, /\bespana\b/i, /\bespagna\b/i, /\bengland\b/i, /\buk\b/i,
  /\busa\b/i, /\bamerica\b/i, /\bswitzerland\b/i, /\bsvizzera\b/i,
  /\baustria\b/i, /\bbelgium\b/i, /\bbelgio\b/i, /\bnetherlands\b/i,
  /\bportugal\b/i, /\bportogallo\b/i, /\bgreece\b/i, /\bgrecia\b/i,
  /\baustralia\b/i, /\bjapan\b/i, /\bgiappone\b/i,
  // Foreign cities
  /\bparis\b/i, /\blondon\b/i, /\bberlin\b/i, /\bamsterdam\b/i,
  /\bbarcelona\b/i, /\bmadrid\b/i, /\bvienna\b/i, /\bwien\b/i,
  /\bzurich\b/i, /\bgen[eè]ve\b/i, /\bgenevois\b/i, /\bbruxelles\b/i,
  /\bbruselas\b/i, /\blisbon\b/i, /\blisbona\b/i, /\bathens\b/i, /\batene\b/i,
  // Non-Palermo Sicilian cities
  /\bcatania\b/i, /\bmessina\b/i, /\bsiracusa\b/i, /\bsyracuse\b/i,
  /\btrapani\b/i, /\bagrigento\b/i, /\bargigento\b/i, /\bragusa\b/i,
  /\benna\b/i, /\bcaltanissetta\b/i,
  // Italian mainland cities
  /\broma\b/i, /\brome\b/i, /\bmilano\b/i, /\bmilan\b/i, /\bnapoli\b/i,
  /\bnaples\b/i, /\btorino\b/i, /\bturin\b/i, /\bvenezia\b/i, /\bvenice\b/i,
  /\bfirenze\b/i, /\bflorence\b/i, /\bbologna\b/i, /\bgenova\b/i, /\bgenoa\b/i,
  /\bbari\b/i, /\bverona\b/i, /\bpadova\b/i, /\bpadua\b/i, /\bpisa\b/i,
];

/**
 * Check if an extracted event's location is consistent with Palermo/Sicily.
 * Returns true if the event should be accepted, false if it should be filtered out.
 * When no location info is present, we accept the event (trust the source).
 */
function isLocationInPalermo(event: ExtractedEvent): { ok: boolean; reason?: string } {
  const locationText = [event.location_name || "", event.location_address || ""].join(" ").trim();

  // No location info — accept (source is a Palermo source)
  if (!locationText) return { ok: true };

  for (const pattern of NON_PALERMO_PATTERNS) {
    if (pattern.test(locationText)) {
      return { ok: false, reason: `Location "${locationText}" matches non-Palermo pattern: ${pattern}` };
    }
  }

  return { ok: true };
}

export async function runExtractionAgent(
  options: {
    isInstagramOnly?: boolean;
    maxSourcesPerRun?: number;
  } = {}
): Promise<ExtractionStats> {
  const startTime = Date.now();
  const errors: string[] = [];
  const logger = new AgentLogger('extraction');

  const stats: ExtractionStats = {
    sourcesProcessed: 0,
    sourcesFailed: 0,
    eventsFound: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsDuplicateInRun: 0,
    eventsDuplicateExact: 0,
    eventsDuplicateFuzzy: 0,
    eventsSkippedPast: 0,
    eventsSkippedListingUrl: 0,
    eventsSkippedNonPalermo: 0,
    eventsFailed: 0,
    locationsCreated: 0,
    organizersCreated: 0,
    rateLimitErrors: 0,
    imagesStored: 0,
    instagramSourcesProcessed: 0,
    instagramPostsScraped: 0,
    instagramApifyCost: 0,
    // Discovery v2 stats
    mentionsExtracted: 0,
    hashtagsExtracted: 0,
    potentialSourcesQueued: 0,
    collabUsersExtracted: 0,
    // Web crawling stats
    socialLinksExtracted: 0,
    eventPlatformLinksExtracted: 0,
    websiteSourcesQueued: 0,
    organizerNamesQueued: 0,
  };

  try {
    // Clean up any stuck runs from previous executions
    const cleanedUp = await cleanupStuckRuns();
    if (cleanedUp > 0) {
      console.log(`Cleaned up ${cleanedUp} stuck agent runs`);
    }
    // Start the agent run in the database
    await logger.startRun();

    await logger.info("Starting Extraction Agent...");
    await logger.info(`Target metro: ${config.targetMetro}`);
    await logger.info(`Max events per run: ${config.maxEventsPerRun}`);

    // Get event sources from database
    let sources = await getEventSources();
    await logger.info(`Found ${sources.length} total event sources`);

    if (options.isInstagramOnly) {
      sources = sources.filter(s => s.type === 'instagram' && s.enabled !== false);
      await logger.info(`Filtered to ${sources.length} enabled Instagram sources`);
    }

    // Always sort by last_scraped_at (null/never-scraped first, then oldest)
    // This ensures new sources get scraped before re-scraping old ones
    sources.sort((a, b) => {
      if (!a.last_scraped_at && !b.last_scraped_at) return 0;
      if (!a.last_scraped_at) return -1;
      if (!b.last_scraped_at) return 1;
      return new Date(a.last_scraped_at).getTime() - new Date(b.last_scraped_at).getTime();
    });

    if (options.maxSourcesPerRun && sources.length > options.maxSourcesPerRun) {
      sources = sources.slice(0, options.maxSourcesPerRun);
      await logger.info(`Limited to ${sources.length} sources by maxSourcesPerRun option`);
    }

    await logger.info(`Found ${sources.length} event sources`);

    if (sources.length === 0) {
      await logger.warn("No event sources configured. Add aggregators, locations, or organizers with event URLs.");
      await logger.completeRun('completed', stats, 'No event sources configured');
      return stats;
    }

    const allEvents: ProcessedEvent[] = [];
    const seenInRun: SeenEvent[] = []; // Track events seen in this run for fuzzy matching

    for (const source of sources) {
      if (stats.eventsFound >= config.maxEventsPerRun) {
        await logger.info(`Reached max events limit (${config.maxEventsPerRun})`);
        break;
      }

      try {
        // Handle Instagram sources differently
        if (source.type === "instagram") {
          // Check if Apify is configured
          if (!isApifyConfigured()) {
            await logger.warn(`Skipping Instagram source ${source.name}: APIFY_API_TOKEN not configured`);
            continue;
          }

          await logger.info(`Processing Instagram source: ${source.name} (@${source.instagramHandle})`, {
            source_name: source.name,
            source_type: source.type,
            instagram_handle: source.instagramHandle,
          });

          // Scrape Instagram posts using Apify
          const posts = await scrapeInstagramProfile(source.instagramHandle!, 10);
          stats.instagramPostsScraped += posts.length;
          stats.instagramSourcesProcessed++;

          await logger.info(`Scraped ${posts.length} Instagram posts from @${source.instagramHandle}`);

          // Pre-upload images to storage while CDN URLs are still fresh
          const imageUrlMap = await preUploadInstagramImages(posts);
          if (imageUrlMap.size > 0) {
            await logger.debug(`Pre-uploaded ${imageUrlMap.size} images to storage`);
            // Replace CDN URLs with storage URLs in posts
            for (const post of posts) {
              if (post.displayUrl && imageUrlMap.has(post.displayUrl)) {
                (post as any).displayUrl = imageUrlMap.get(post.displayUrl);
              }
              if (post.images) {
                post.images = post.images.map(url => imageUrlMap.get(url) || url);
              }
            }
          }

          // ========== DISCOVERY V2: Extract mentions, hashtags, collabs ==========
          const allMentions: string[] = [];
          const allHashtags: string[] = [];
          const allCollabUsers: string[] = [];
          const allTaggedUsers: string[] = [];

          for (const post of posts) {
            // Extract from caption
            const mentions = extractMentions(post.caption || "");
            const hashtags = extractHashtags(post.caption || "");
            
            allMentions.push(...mentions);
            allHashtags.push(...hashtags);

            // Extract coauthors (collaborative posts) - Apify field
            if ((post as any).coAuthors && Array.isArray((post as any).coAuthors)) {
              for (const coauthor of (post as any).coAuthors) {
                if (coauthor.username) {
                  allCollabUsers.push(coauthor.username);
                }
              }
            }

            // Extract tagged users - Apify field
            if ((post as any).taggedUsers && Array.isArray((post as any).taggedUsers)) {
              for (const tagged of (post as any).taggedUsers) {
                if (tagged.username || tagged.full_name) {
                  allTaggedUsers.push(tagged.username || tagged.full_name);
                }
              }
            }
          }

          // Update hashtag stats
          const uniqueHashtags = [...new Set(allHashtags)];
          if (uniqueHashtags.length > 0) {
            await updateHashtagStats(uniqueHashtags, source.id);
            stats.hashtagsExtracted += uniqueHashtags.length;
            await logger.debug(`Tracked ${uniqueHashtags.length} hashtags from @${source.instagramHandle}`);
          }

          // Queue mentions for discovery
          const uniqueMentions = [...new Set(allMentions)];
          if (uniqueMentions.length > 0) {
            const { queued } = await queuePotentialSources(uniqueMentions, {
              sourceId: source.id,
              method: "mention",
            });
            stats.mentionsExtracted += uniqueMentions.length;
            stats.potentialSourcesQueued += queued;
            await logger.debug(`Queued ${queued} new mentions from @${source.instagramHandle}`);
          }

          // Queue collab users for discovery (higher priority)
          const uniqueCollabs = [...new Set(allCollabUsers)];
          if (uniqueCollabs.length > 0) {
            const { queued } = await queuePotentialSources(uniqueCollabs, {
              sourceId: source.id,
              method: "collab_post",
            });
            stats.collabUsersExtracted += uniqueCollabs.length;
            stats.potentialSourcesQueued += queued;
            await logger.debug(`Queued ${queued} collab users from @${source.instagramHandle}`);
          }

          // Queue tagged users for discovery
          const uniqueTagged = [...new Set(allTaggedUsers)];
          if (uniqueTagged.length > 0) {
            const { queued } = await queuePotentialSources(uniqueTagged, {
              sourceId: source.id,
              method: "tagged_user",
            });
            stats.potentialSourcesQueued += queued;
            await logger.debug(`Queued ${queued} tagged users from @${source.instagramHandle}`);
          }
          // ========== END DISCOVERY V2 ==========

          // Convert posts to the format expected by the extraction function
          const postsForExtraction = posts.map((post: InstagramPost) => ({
            shortCode: post.shortCode,
            caption: post.caption || "",
            timestamp: post.timestamp,
            images: post.images || (post.displayUrl ? [post.displayUrl] : []),
            url: post.url,
          }));

          // Extract events from posts using LLM
          const events = await extractEventsFromInstagramPosts(
            postsForExtraction,
            source.name,
            source.instagramHandle!
          );
          await logger.info(`Extracted ${events.length} events from Instagram posts`);

          // Log extraction details
          for (const event of events) {
            const hasImage = event.image_url && event.image_url.startsWith("http");
            console.log(`  → ${event.title.substring(0, 50)}...`);
            console.log(`    URL: ${event.detail_url || "(none)"}`);
            console.log(`    Image: ${hasImage ? event.image_url?.substring(0, 50) + "..." : "(none)"}`);
          }

          // Add to collection (with in-run deduplication)
          for (const event of events) {
            if (allEvents.length >= config.maxEventsPerRun) break;

            if (isDuplicateOfSeen(event.title, event.start_time, seenInRun)) {
              console.log(`  Skipping in-run duplicate: ${event.title.substring(0, 40)}...`);
              stats.eventsDuplicateInRun++;
              continue;
            }

            seenInRun.push({
              title: event.title,
              normalizedTitle: normalizeTitle(event.title),
              date: event.start_time.split("T")[0],
            });
            allEvents.push({ extracted: event, source });
            stats.eventsFound++;
          }

          // Success - increment processed count and update last_scraped_at
          stats.sourcesProcessed++;
          await updateSourceLastScraped(source.id);

          // Rate limiting between sources
          await sleep(config.rateLimitMs);
          continue;
        }

        // Process regular web sources with retry logic
        await withRetry(async () => {
          await logger.info(`Processing source: ${source.name} (${source.type})`, { source_name: source.name, source_type: source.type, url: source.url });

          // Fetch page content
          const content = await fetchPageWithFallback(source.url);
          await logger.debug(`Fetched ${content.length} chars from ${source.name}`);

          // ========== WEB CRAWLING: Extract links for discovery ==========
          try {
            // Try to get raw HTML for link extraction (content may be markdown from Jina)
            let htmlContent = content;
            if (!content.includes("<a ") && !content.includes("href=")) {
              // Content is likely markdown, try to fetch raw HTML
              try {
                htmlContent = await fetchPageDirect(source.url);
              } catch {
                // Fall back to using the markdown content for @mentions
                htmlContent = content;
              }
            }

            const extractedLinks = extractLinksFromHtml(htmlContent, source.url);
            
            // Queue Instagram links from the page
            const instagramHandles = extractedLinks.socialLinks
              .filter(l => l.platform === "instagram" && l.handle)
              .map(l => l.handle!);
            
            if (instagramHandles.length > 0) {
              const { queued } = await queuePotentialSources(instagramHandles, {
                sourceId: source.id,
                method: "website_crawl",
              });
              stats.socialLinksExtracted += instagramHandles.length;
              stats.potentialSourcesQueued += queued;
              if (queued > 0) {
                await logger.debug(`Queued ${queued} Instagram handles from ${source.name}`);
              }
            }

            // Queue event platform links (Eventbrite, Dice, etc.)
            if (extractedLinks.eventPlatformLinks.length > 0) {
              const { queued } = await queueWebsiteSources(
                extractedLinks.eventPlatformLinks.map(l => ({ url: l.url, platform: l.platform })),
                { sourceId: source.id, method: "website_crawl" }
              );
              stats.eventPlatformLinksExtracted += extractedLinks.eventPlatformLinks.length;
              stats.websiteSourcesQueued += queued;
              if (queued > 0) {
                await logger.debug(`Queued ${queued} event platform links from ${source.name}`);
              }
            }

            // Queue organizer/venue links
            const allOrgVenueLinks = [
              ...extractedLinks.organizerLinks,
              ...extractedLinks.venueLinks,
            ];
            if (allOrgVenueLinks.length > 0) {
              const { queued } = await queueWebsiteSources(
                allOrgVenueLinks.map(l => ({ url: l.url, name: l.name })),
                { sourceId: source.id, method: "website_crawl" }
              );
              stats.websiteSourcesQueued += queued;
            }

            // Also extract organizer names from text for Instagram search
            const orgNames = extractOrganizerNames(content);
            if (orgNames.length > 0) {
              const { queued } = await queueOrganizerNames(orgNames, {
                sourceId: source.id,
                method: "website_crawl",
              });
              stats.organizerNamesQueued += queued;
              if (queued > 0) {
                await logger.debug(`Queued ${queued} organizer names for Instagram search`);
              }
            }
          } catch (linkError) {
            // Link extraction is non-critical, continue with event extraction
            await logger.debug(`Link extraction failed for ${source.name}: ${linkError instanceof Error ? linkError.message : String(linkError)}`);
          }
          // ========== END WEB CRAWLING ==========

          // Extract events using LLM
          const events = await extractEventsFromContent(content, source.name, source.url);
          await logger.info(`Extracted ${events.length} events from ${source.name}`);

          // Enrich events by fetching their specific detail pages.
          // This fixes issues where listing pages have generic dates (e.g., "March 2026"
          // defaulted to March 1) or missing images — the detail page has accurate data.
          await enrichEventsFromDetailPages(events, source.url, logger);

          // Log extraction details for debugging
          for (const event of events) {
            const hasImage = event.image_url && event.image_url.startsWith("http");
            const hasValidUrl = event.detail_url && !isListingPageUrl(event.detail_url);
            console.log(`  → ${event.title.substring(0, 50)}...`);
            console.log(`    URL: ${event.detail_url || "(none)"} ${hasValidUrl ? "✓" : "⚠ listing page"}`);
            console.log(`    Image: ${hasImage ? event.image_url?.substring(0, 50) + "..." : "(none)"}`);
          }

          // Strip generic/placeholder images before uploading.
          // These are site-wide images (placeholders, logos, listing banners)
          // that the LLM may have extracted from a listing page's og:image tag.
          // Keeping them would make multiple different events share the same image.
          for (const event of events) {
            if (event.image_url && isGenericImageUrl(event.image_url)) {
              await logger.debug(
                `Cleared generic image for "${event.title.substring(0, 30)}...": ${event.image_url.substring(0, 60)}`
              );
              event.image_url = undefined;
            }
          }

          // Strip images that are shared by multiple events in the same extraction batch.
          // When the same image URL appears on more than one event extracted from a single
          // listing page, it is almost certainly the page's own og:image (not per-event
          // artwork). Clearing it prevents different events from sharing the same image.
          if (events.length > 1) {
            const imageCounts = new Map<string, number>();
            for (const event of events) {
              if (event.image_url) {
                imageCounts.set(event.image_url, (imageCounts.get(event.image_url) ?? 0) + 1);
              }
            }
            for (const event of events) {
              if (event.image_url && (imageCounts.get(event.image_url) ?? 0) > 1) {
                await logger.debug(
                  `Cleared shared listing image for "${event.title.substring(0, 30)}...": ${event.image_url.substring(0, 60)}`
                );
                event.image_url = undefined;
              }
            }
          }

          // Pre-upload website images to Supabase storage (similar to Instagram)
          // This prevents external URLs from breaking (403/404) before event creation
          for (const event of events) {
            if (event.image_url && event.image_url.startsWith("http")) {
              try {
                // Use a temporary event ID for storage (we'll update the real event later)
                const tempEventId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                const uploadResult = await uploadEventImage(tempEventId, event.image_url);

                if (uploadResult.success && uploadResult.publicUrl) {
                  // Replace external URL with storage URL
                  const oldUrl = event.image_url;
                  event.image_url = uploadResult.publicUrl;
                  await logger.debug(`Pre-uploaded image for "${event.title.substring(0, 30)}...": ${oldUrl.substring(0, 40)}... → storage`);
                } else {
                  await logger.debug(`Failed to pre-upload image for "${event.title.substring(0, 30)}...": ${uploadResult.error || 'unknown error'}`);
                }
              } catch (uploadError) {
                // Non-critical - continue with external URL
                await logger.debug(`Image pre-upload error for "${event.title.substring(0, 30)}...": ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
              }
            }
          }

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
        }, SOURCE_RETRY_OPTIONS);

        // Success - increment processed count and update last_scraped_at
        stats.sourcesProcessed++;
        await updateSourceLastScraped(source.id);

        // Rate limiting between sources
        await sleep(config.rateLimitMs);
      } catch (error) {
        // Failed after retries - log and continue to next source
        const errorMsg = `Failed to process ${source.name}: ${error instanceof Error ? error.message : String(error)}`;
        await logger.error(errorMsg);
        errors.push(errorMsg);
        stats.sourcesFailed++;

        // Track rate limit errors specifically
        if ((error as any)?.isRateLimitError || (error instanceof Error && error.message.includes('Rate limit'))) {
          stats.rateLimitErrors++;
          await logger.warn(`Rate limit hit while processing ${source.name}. Consider adding OpenRouter credits.`);
        }

        // Continue processing other sources despite this failure
        continue;
      }
    }

    await logger.info(`Total events collected: ${allEvents.length}`);

    // Process collected events
    for (const { extracted, source } of allEvents) {
      try {
        // Normalize dates: LLM returns naive datetimes assumed to be local
        // Palermo time (Europe/Rome). Convert to UTC ISO strings so they are
        // stored correctly in PostgreSQL with the right timezone offset.
        const normalizedStart = normalizePalermoDatetime(extracted.start_time);
        if (normalizedStart) {
          extracted.start_time = normalizedStart;
        }
        if (extracted.end_time) {
          const normalizedEnd = normalizePalermoDatetime(extracted.end_time);
          if (normalizedEnd) extracted.end_time = normalizedEnd;
        }

        // Skip events in the past
        const eventDate = new Date(extracted.start_time);
        if (eventDate < new Date()) {
          console.log(`Skipping past event: ${extracted.title} (${extracted.start_time})`);
          stats.eventsSkippedPast++;
          continue;
        }

        // Skip events located outside Palermo/Sicily
        const locationCheck = isLocationInPalermo(extracted);
        if (!locationCheck.ok) {
          console.log(`Skipping non-Palermo event: ${extracted.title} — ${locationCheck.reason}`);
          stats.eventsSkippedNonPalermo++;
          continue;
        }

        // Skip events with listing page URLs instead of specific event URLs
        // But allow trusted sources that only have listing pages
        if (isListingPageUrl(extracted.detail_url)) {
          if (!isTrustedListingSource(extracted.detail_url)) {
            console.log(`Skipping event with listing URL: ${extracted.title}`);
            stats.eventsSkippedListingUrl++;
            continue;
          }
          // Trusted source - accept but log it
          console.log(`Accepting listing URL from trusted source: ${extracted.title}`);
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

          // Create event mention for provenance tracking
          await createEventMention(eventId, source.id, {
            title: extracted.title,
            detail_url: extracted.detail_url,
            extracted_at: new Date().toISOString(),
          }, confidenceScore);

          // Upload image to Supabase Storage if available
          if (extracted.image_url) {
            const imageResult = await uploadEventImage(eventId, extracted.image_url);
            if (imageResult.success && imageResult.publicUrl) {
              await updateEvent(eventId, { cover_image_url: imageResult.publicUrl });
              stats.imagesStored++;
            }
          }
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
        "Sources Failed": stats.sourcesFailed,
        "Events Found": stats.eventsFound,
        "Events Created": stats.eventsCreated,
        "Events Updated": stats.eventsUpdated,
        "Images Stored": stats.imagesStored,
        "Duplicates (In-Run)": stats.eventsDuplicateInRun,
        "Duplicates (Exact)": stats.eventsDuplicateExact,
        "Duplicates (Fuzzy)": stats.eventsDuplicateFuzzy,
        "Past Events Skipped": stats.eventsSkippedPast,
        "Listing URL Skipped": stats.eventsSkippedListingUrl,
        "Non-Palermo Skipped": stats.eventsSkippedNonPalermo,
        "Events Failed": stats.eventsFailed,
        "Rate Limit Errors": stats.rateLimitErrors,
        "Locations Created": stats.locationsCreated,
        "Organizers Created": stats.organizersCreated,
        // Discovery v2 stats
        "Mentions Extracted": stats.mentionsExtracted,
        "Hashtags Extracted": stats.hashtagsExtracted,
        "Potential Sources Queued": stats.potentialSourcesQueued,
        "Collab Users Found": stats.collabUsersExtracted,
        // Web crawling stats
        "Social Links Found": stats.socialLinksExtracted,
        "Event Platform Links": stats.eventPlatformLinksExtracted,
        "Website Sources Queued": stats.websiteSourcesQueued,
        "Organizer Names Queued": stats.organizerNamesQueued,
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
    if (stats.sourcesFailed > 0) {
      await logger.warn(`Sources failed: ${stats.sourcesFailed} (will retry on next run)`);
    }
    await logger.info(`Events found: ${stats.eventsFound}`);
    await logger.info(`Events created: ${stats.eventsCreated}`);
    await logger.info(`Events updated: ${stats.eventsUpdated}`);
    await logger.info(`Images stored: ${stats.imagesStored}`);
    await logger.info(`Duplicates: ${totalDuplicates} (${stats.eventsDuplicateInRun} in-run, ${stats.eventsDuplicateExact} exact, ${stats.eventsDuplicateFuzzy} fuzzy)`);
    await logger.info(`Past events skipped: ${stats.eventsSkippedPast}`);
    await logger.info(`Listing URL skipped: ${stats.eventsSkippedListingUrl}`);
    if (stats.eventsSkippedNonPalermo > 0) {
      await logger.warn(`Non-Palermo events skipped: ${stats.eventsSkippedNonPalermo}`);
    }
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
