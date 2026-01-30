import { config } from "./config";
import {
  getSupabase,
  cleanupStuckRuns,
  getPendingPotentialSources,
  getPendingWebsiteSources,
  updatePotentialSourceStatus,
  createEventSourceWithProvenance,
  getTopHashtags,
  findOrCreateOrganizer,
  queuePotentialSources,
} from "./db";
import {
  searchEventSources,
  sendAgentReport,
  alertError,
  scrapeInstagramProfile,
  isApifyConfigured,
  fetchPageWithFallback,
  extractLinksFromHtml,
  type SearchResult,
  type AgentReport,
  type InstagramPost,
} from "./tools";
import { openrouter } from "./tools/openrouter";
import { AgentLogger } from "./logger";

interface DiscoveryStats {
  // Web search discovery
  searchesPerformed: number;
  resultsFound: number;
  newSourcesAdded: number;
  duplicatesSkipped: number;
  blockedSkipped: number;
  // Mention/collab discovery
  potentialSourcesProcessed: number;
  sourcesValidated: number;
  sourcesRejected: number;
  sourcesSkipped: number;
  // Auto-validation stats
  accountsChecked: number;
  accountsPublic: number;
  accountsActive: number;
  accountsEventRelated: number;
  accountsInPalermo: number;
  // Enrichment stats
  organizersCreated: number;
  // Website validation stats
  websitesProcessed: number;
  websitesValidated: number;
  websitesSkipped: number;
  // Instagram search stats
  orgNamesSearched: number;
  instagramHandlesFound: number;
}

interface ValidationResult {
  isValid: boolean;
  score: number; // 0-5
  checks: {
    accountExists: boolean;
    isPublic: boolean;
    isActive: boolean; // Posted in last 30 days
    isEventRelated: boolean; // LLM check
    isInPalermo: boolean; // Location check
  };
  notes: string;
  bio?: string;
  website?: string;
  followerCount?: number;
  postCount?: number;
  recentPosts?: InstagramPost[];
}

interface WebsiteValidationResult {
  isValid: boolean;
  score: number; // 0-5
  checks: {
    isAccessible: boolean;
    hasEventContent: boolean;
    isActive: boolean;
    isPalermoRelated: boolean;
    hasSocialLinks: boolean;
  };
  notes: string;
  instagramHandles?: string[];
  eventPlatformLinks?: string[];
}

// Known event aggregator patterns - prioritized by extraction success rate
const AGGREGATOR_PATTERNS = [
  // High priority - Italian sources that work well
  { pattern: /feverup\.com/i, name: "Feverup", priority: 75 },
  { pattern: /ticketone\.it/i, name: "Ticketone", priority: 80 },
  { pattern: /ticketsms\.it/i, name: "TicketSMS", priority: 80 },
  { pattern: /teatro\.it/i, name: "Teatro.it", priority: 70 },
  { pattern: /palermotoday\.it/i, name: "PalermoToday", priority: 85 },
  { pattern: /palermoviva\.it/i, name: "Palermoviva", priority: 60 },
  { pattern: /balarm\.it/i, name: "Balarm", priority: 75 },
  { pattern: /terradamare\.org/i, name: "Terradamare", priority: 40 },
  { pattern: /itinerarinellarte\.it/i, name: "Itinerarinellarte", priority: 35 },
  // International platforms
  { pattern: /eventbrite\.(com|it)/i, name: "Eventbrite", priority: 70 },
  { pattern: /ra\.co/i, name: "Resident Advisor", priority: 100 },
  { pattern: /dice\.fm/i, name: "Dice", priority: 60 },
  // Lower priority - may have limited Italian coverage
  { pattern: /xceed\.me/i, name: "Xceed", priority: 50 },
  { pattern: /songkick\.com/i, name: "Songkick", priority: 40 },
  { pattern: /bandsintown\.com/i, name: "Bandsintown", priority: 40 },
];

// Patterns that likely indicate an event page
const EVENT_PAGE_PATTERNS = [
  /eventi/i, /events/i, /concerti/i, /concerts/i, /nightlife/i,
  /clubbing/i, /discoteca/i, /calendario/i, /programma/i,
  /spettacoli/i, /teatro/i, /mostre/i, /appuntamenti/i,
  /cosa-fare/i, /agenda/i, /biglietti/i, /tickets/i,
];

// Domains that should never be added
const BLOCKED_DOMAINS = new Set([
  "facebook.com", "instagram.com", "twitter.com", "x.com",
  "reddit.com", "youtube.com", "tiktok.com", "linkedin.com",
  "pinterest.com", "tripadvisor.it", "tripadvisor.com",
  "yelp.com", "yelp.it", "booking.com", "airbnb.com",
  "expedia.com", "google.com", "maps.google.com",
  "wikipedia.org", "amazon.com", "amazon.it",
]);

// URL patterns to block
const BLOCKED_URL_PATTERNS = [
  /\/magazine\//i, /\/blog\//i, /\/article\//i, /\/news\//i,
  /\/guide\//i, /\/guida\//i, /\/comments\//i, /\/search\?/i,
  /\/find_desc=/i, /\/Attractions-/i, /prontopro\.it/i,
  /area-stampa/i, /\/groups\//i, /nightlife-pubs-and-fun/i,
  /palermos-nightlife\/?$/i, /nightlife-in-palermo-events\/?$/i,
  /palermo-welcome-nightlife/i, /palermo-welcome-news/i,
];

// Keywords indicating event-related content
const EVENT_KEYWORDS = [
  "evento", "event", "concerto", "concert", "party", "festa",
  "serata", "night", "live", "dj", "club", "disco", "rave",
  "festival", "spettacolo", "show", "teatro", "theatre",
  "mostra", "exhibition", "aperitivo", "happy hour",
  "presentazione", "release", "opening", "inaugurazione",
  "sabato", "saturday", "venerdi", "friday", "domenica", "sunday",
  "ingresso", "ticket", "biglietti", "prevendita", "presale",
  "palermo", "sicilia", "sicily",
];

// Location keywords for Palermo/Sicily
const PALERMO_KEYWORDS = [
  "palermo", "sicilia", "sicily", "mondello", "cefalù",
  "bagheria", "monreale", "terrasini", "balestrate",
  "via ", "piazza ", "corso ", // Italian address patterns
];

function isBlockedSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (BLOCKED_DOMAINS.has(hostname)) return true;
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.endsWith(`.${blocked}`)) return true;
    }
    for (const pattern of BLOCKED_URL_PATTERNS) {
      if (pattern.test(url)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validate a website for event content
 */
async function validateWebsite(
  url: string,
  logger: AgentLogger
): Promise<WebsiteValidationResult> {
  const result: WebsiteValidationResult = {
    isValid: false,
    score: 0,
    checks: {
      isAccessible: false,
      hasEventContent: false,
      isActive: false,
      isPalermoRelated: false,
      hasSocialLinks: false,
    },
    notes: "",
    instagramHandles: [],
    eventPlatformLinks: [],
  };

  try {
    await logger.debug(`Validating website: ${url}`);
    
    // Fetch the page
    const content = await fetchPageWithFallback(url);
    
    if (!content || content.length < 100) {
      result.notes = "Page content too short or inaccessible";
      return result;
    }
    
    result.checks.isAccessible = true;
    result.score++;
    
    const contentLower = content.toLowerCase();
    
    // Check for event-related content
    const eventKeywordCount = EVENT_KEYWORDS.filter(kw => 
      contentLower.includes(kw.toLowerCase())
    ).length;
    
    if (eventKeywordCount >= 3) {
      result.checks.hasEventContent = true;
      result.score++;
    } else {
      result.notes += "Limited event-related content. ";
    }
    
    // Check for Palermo/Sicily location
    const locationMatches = PALERMO_KEYWORDS.filter(kw =>
      contentLower.includes(kw.toLowerCase())
    );
    
    if (locationMatches.length >= 1) {
      result.checks.isPalermoRelated = true;
      result.score++;
    } else {
      result.notes += "No Palermo/Sicily location indicators. ";
    }
    
    // Check for date patterns (indicates active events)
    const datePatterns = [
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,  // DD/MM/YYYY or similar
      /\b(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{1,2}/i,
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
      /\b\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i,
    ];
    
    const hasRecentDates = datePatterns.some(pattern => pattern.test(content));
    if (hasRecentDates) {
      result.checks.isActive = true;
      result.score++;
    } else {
      result.notes += "No recent date patterns found. ";
    }
    
    // Extract social links
    const extractedLinks = extractLinksFromHtml(content, url);
    
    const igHandles = extractedLinks.socialLinks
      .filter(l => l.platform === "instagram" && l.handle)
      .map(l => l.handle!);
    
    if (igHandles.length > 0) {
      result.checks.hasSocialLinks = true;
      result.instagramHandles = igHandles;
      result.score++;
    }
    
    result.eventPlatformLinks = extractedLinks.eventPlatformLinks.map(l => l.url);
    
    // Determine validity (need at least 3/5 checks)
    result.isValid = result.score >= 3;
    result.notes = result.notes.trim() || `Validation score: ${result.score}/5`;
    
    return result;
  } catch (error) {
    result.notes = `Validation error: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}

/**
 * Search Instagram for an organization name
 * Uses Apify to search/lookup profiles
 */
async function searchInstagramForOrg(
  orgName: string,
  logger: AgentLogger
): Promise<string | null> {
  try {
    // Clean up the org name for search
    const searchTerm = orgName
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "")
      .substring(0, 30);
    
    if (searchTerm.length < 3) return null;
    
    await logger.debug(`Searching Instagram for: ${orgName} (${searchTerm})`);
    
    // Try direct profile lookup first (most common pattern)
    try {
      const posts = await scrapeInstagramProfile(searchTerm, 1);
      if (posts && posts.length > 0) {
        await logger.debug(`Found @${searchTerm} directly`);
        return searchTerm;
      }
    } catch {
      // Profile doesn't exist with that exact name
    }
    
    // Try common variations
    const variations = [
      searchTerm.replace(/\s/g, "_"),
      searchTerm.replace(/\s/g, "."),
      `${searchTerm}_official`,
      `${searchTerm}_palermo`,
    ];
    
    for (const variant of variations) {
      if (variant.length < 3 || variant.length > 30) continue;
      
      try {
        const posts = await scrapeInstagramProfile(variant, 1);
        if (posts && posts.length > 0) {
          await logger.debug(`Found @${variant} as variant`);
          return variant;
        }
      } catch {
        // Variant doesn't exist
      }
      
      // Rate limit between attempts
      await sleep(1000);
    }
    
    return null;
  } catch (error) {
    await logger.warn(`Instagram search failed for "${orgName}": ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Process pending website sources
 */
async function processWebsiteSources(
  logger: AgentLogger,
  stats: DiscoveryStats,
  limit: number = 5
): Promise<void> {
  const pending = await getPendingWebsiteSources(limit);
  
  if (pending.length === 0) {
    await logger.info("No pending website sources to process");
    return;
  }
  
  await logger.info(`Processing ${pending.length} website sources`);
  
  for (const source of pending) {
    stats.websitesProcessed++;
    
    try {
      // Skip blocked sources
      if (isBlockedSource(source.handle)) {
        await updatePotentialSourceStatus(source.id, "skipped", 0, "Blocked domain");
        stats.websitesSkipped++;
        continue;
      }
      
      const validation = await validateWebsite(source.handle, logger);
      
      if (validation.isValid) {
        // Create event source
        await createEventSourceWithProvenance({
          url: source.handle,
          type: "website",
          discoveredViaSourceId: source.discovered_via_source_id || undefined,
          discoveredViaMethod: source.discovered_via_method,
          reliabilityScore: validation.score * 20,
          enabled: validation.score >= 4, // Auto-enable high-scoring sites
        });
        
        await updatePotentialSourceStatus(source.id, "validated", validation.score, validation.notes);
        stats.websitesValidated++;
        await logger.success(`Validated website: ${source.handle} (score: ${validation.score}/5)`);
        
        // Queue discovered Instagram handles
        if (validation.instagramHandles && validation.instagramHandles.length > 0) {
          const { queued } = await queuePotentialSources(validation.instagramHandles, {
            sourceId: source.id,
            method: "website_crawl",
          });
          if (queued > 0) {
            await logger.debug(`Queued ${queued} Instagram handles from ${source.handle}`);
          }
        }
      } else {
        await updatePotentialSourceStatus(source.id, "skipped", validation.score, validation.notes);
        stats.websitesSkipped++;
        await logger.debug(`Skipped website: ${source.handle} (score: ${validation.score}/5)`);
      }
      
      // Rate limiting
      await sleep(2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await updatePotentialSourceStatus(source.id, "rejected", 0, `Error: ${errorMsg}`);
      stats.websitesSkipped++;
      await logger.warn(`Failed to validate website ${source.handle}: ${errorMsg}`);
    }
  }
}

/**
 * Process organization names to find Instagram handles
 */
async function processOrgNames(
  logger: AgentLogger,
  stats: DiscoveryStats,
  limit: number = 3
): Promise<void> {
  // Get org names from potential_sources where platform = 'org_name'
  const { data: pending, error } = await getSupabase()
    .from("potential_sources")
    .select("id, handle, metadata")
    .eq("platform", "org_name")
    .eq("validation_status", "pending")
    .limit(limit);
  
  if (error || !pending || pending.length === 0) {
    return;
  }
  
  await logger.info(`Searching Instagram for ${pending.length} organization names`);
  
  for (const org of pending) {
    stats.orgNamesSearched++;
    
    const originalName = (org.metadata as any)?.original_name || org.handle;
    const igHandle = await searchInstagramForOrg(originalName, logger);
    
    if (igHandle) {
      // Queue the found handle
      const { queued } = await queuePotentialSources([igHandle], {
        sourceId: org.id,
        method: "website_crawl",
      });
      
      if (queued > 0) {
        stats.instagramHandlesFound++;
        await logger.success(`Found Instagram @${igHandle} for "${originalName}"`);
      }
      
      await updatePotentialSourceStatus(org.id, "validated", 5, `Found Instagram: @${igHandle}`);
    } else {
      await updatePotentialSourceStatus(org.id, "skipped", 0, "No Instagram found");
    }
    
    // Rate limiting between searches
    await sleep(3000);
  }
}

/**
 * Validate an Instagram account for event relevance
 */
async function validateInstagramAccount(
  handle: string,
  logger: AgentLogger
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: false,
    score: 0,
    checks: {
      accountExists: false,
      isPublic: false,
      isActive: false,
      isEventRelated: false,
      isInPalermo: false,
    },
    notes: "",
  };

  try {
    // Scrape the profile (limit to 5 posts for validation)
    await logger.debug(`Validating @${handle}...`);
    const posts = await scrapeInstagramProfile(handle, 5);

    // Check 1: Account exists
    if (!posts || posts.length === 0) {
      result.notes = "No posts found or account is private/doesn't exist";
      return result;
    }
    result.checks.accountExists = true;
    result.score++;

    // Check 2: Is public (if we got posts, it's public)
    result.checks.isPublic = true;
    result.score++;
    result.recentPosts = posts;

    // Get account metadata from first post if available
    const firstPost = posts[0] as any;
    if (firstPost?.ownerFullName) {
      result.bio = firstPost.ownerFullName;
    }
    if (firstPost?.ownerUsername) {
      // This confirms we have the right account
    }

    // Check 3: Is active (posted in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPost = posts.find(post => {
      const postDate = new Date(post.timestamp);
      return postDate >= thirtyDaysAgo;
    });
    
    if (recentPost) {
      result.checks.isActive = true;
      result.score++;
    } else {
      result.notes += "No posts in last 30 days. ";
    }

    // Combine all captions for analysis
    const allCaptions = posts.map(p => p.caption || "").join("\n");
    const allHashtags = posts.flatMap(p => p.hashtags || []);
    const combinedText = `${allCaptions} ${allHashtags.join(" ")}`.toLowerCase();

    // Check 4: Is event-related (keyword + LLM check)
    const keywordMatches = EVENT_KEYWORDS.filter(kw => combinedText.includes(kw.toLowerCase()));
    
    if (keywordMatches.length >= 3) {
      // Strong keyword signal, use that
      result.checks.isEventRelated = true;
      result.score++;
    } else if (keywordMatches.length >= 1) {
      // Some keywords, use LLM for deeper analysis
      const isEventRelated = await checkEventRelevanceWithLLM(handle, allCaptions, logger);
      if (isEventRelated) {
        result.checks.isEventRelated = true;
        result.score++;
      } else {
        result.notes += "Content doesn't appear event-related. ";
      }
    } else {
      result.notes += "No event-related keywords found. ";
    }

    // Check 5: Is in Palermo/Sicily
    const locationMatches = PALERMO_KEYWORDS.filter(kw => combinedText.includes(kw.toLowerCase()));
    if (locationMatches.length >= 1) {
      result.checks.isInPalermo = true;
      result.score++;
    } else {
      result.notes += "No Palermo/Sicily location indicators. ";
    }

    // Final determination
    result.isValid = result.score >= 4;
    result.notes = result.notes.trim() || `Validation score: ${result.score}/5`;

    return result;
  } catch (error) {
    result.notes = `Validation error: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}

/**
 * Use LLM to check if content is event-related
 */
async function checkEventRelevanceWithLLM(
  handle: string,
  captions: string,
  logger: AgentLogger
): Promise<boolean> {
  try {
    const truncatedCaptions = captions.slice(0, 2000); // Limit tokens
    
    const response = await openrouter.chat.completions.create({
      model: config.llmModel,
      messages: [
        {
          role: "system",
          content: `You are analyzing an Instagram account to determine if it's an event organizer, venue, or promoter.
Respond with ONLY "yes" or "no".

Consider "yes" if the account appears to:
- Organize parties, concerts, or events
- Be a nightclub, venue, or event space
- Promote music events, festivals, or shows
- Be a DJ, artist, or performer who hosts events
- Be a cultural organization hosting exhibitions or shows

Consider "no" if the account appears to be:
- A regular personal account
- A business not related to events
- A news/media outlet
- A restaurant without event hosting`,
        },
        {
          role: "user",
          content: `Instagram handle: @${handle}\n\nRecent post captions:\n${truncatedCaptions}\n\nIs this an event-related account?`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const answer = response.choices[0]?.message?.content?.toLowerCase().trim();
    return answer === "yes";
  } catch (error) {
    await logger.warn(`LLM check failed for @${handle}: ${error instanceof Error ? error.message : String(error)}`);
    return false; // Fail closed
  }
}

/**
 * Process potential sources from the queue
 */
async function processPotentialSources(
  logger: AgentLogger,
  stats: DiscoveryStats,
  limit: number = 10
): Promise<void> {
  const pending = await getPendingPotentialSources(limit);
  
  if (pending.length === 0) {
    await logger.info("No pending potential sources to process");
    return;
  }

  await logger.info(`Processing ${pending.length} potential sources from queue`);

  for (const source of pending) {
    stats.potentialSourcesProcessed++;
    stats.accountsChecked++;

    try {
      const validation = await validateInstagramAccount(source.handle, logger);
      
      // Track validation results
      if (validation.checks.accountExists) stats.accountsPublic++;
      if (validation.checks.isActive) stats.accountsActive++;
      if (validation.checks.isEventRelated) stats.accountsEventRelated++;
      if (validation.checks.isInPalermo) stats.accountsInPalermo++;

      if (validation.score >= 5) {
        // Perfect score - auto-enable
        await createValidatedSource(source, validation, true, logger);
        await updatePotentialSourceStatus(source.id, "validated", validation.score, validation.notes);
        stats.sourcesValidated++;
        await logger.success(`Auto-enabled @${source.handle} (score: 5/5)`);
      } else if (validation.score === 4) {
        // Good score - enable but flag for monitoring
        await createValidatedSource(source, validation, true, logger);
        await updatePotentialSourceStatus(source.id, "validated", validation.score, `${validation.notes} [Flagged for monitoring]`);
        stats.sourcesValidated++;
        await logger.info(`Enabled @${source.handle} with monitoring (score: 4/5)`);
      } else {
        // Low score - skip
        await updatePotentialSourceStatus(source.id, "skipped", validation.score, validation.notes);
        stats.sourcesSkipped++;
        await logger.debug(`Skipped @${source.handle} (score: ${validation.score}/5) - ${validation.notes}`);
      }

      // Rate limiting between validations
      await sleep(2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await updatePotentialSourceStatus(source.id, "rejected", 0, `Error: ${errorMsg}`);
      stats.sourcesRejected++;
      await logger.warn(`Failed to validate @${source.handle}: ${errorMsg}`);
    }
  }
}

/**
 * Create a validated event source
 */
async function createValidatedSource(
  potentialSource: {
    id: string;
    handle: string;
    discovered_via_source_id: string | null;
    discovered_via_method: string;
  },
  validation: ValidationResult,
  enabled: boolean,
  logger: AgentLogger
): Promise<void> {
  const instagramUrl = `https://www.instagram.com/${potentialSource.handle}/`;
  
  // Try to create or find organizer
  const organizerName = validation.bio || `@${potentialSource.handle}`;
  const { organizer, created } = await findOrCreateOrganizer(organizerName);
  
  if (created) {
    await logger.debug(`Created organizer: ${organizerName}`);
  }

  // Create event source with provenance
  const sourceId = await createEventSourceWithProvenance({
    url: instagramUrl,
    type: "instagram",
    instagramHandle: potentialSource.handle,
    organizerId: organizer?.id,
    discoveredViaSourceId: potentialSource.discovered_via_source_id || undefined,
    discoveredViaMethod: potentialSource.discovered_via_method,
    reliabilityScore: validation.score * 20, // Convert 0-5 to 0-100 scale
    enabled,
  });

  if (sourceId) {
    await logger.success(`Created event source for @${potentialSource.handle}`);
  }
}

/**
 * Run web search discovery (original functionality)
 */
async function runWebSearchDiscovery(
  logger: AgentLogger,
  stats: DiscoveryStats
): Promise<void> {
  await logger.info("Running web search discovery...");

  const searchResults = await searchEventSources(config.targetMetro);
  stats.searchesPerformed = 14;
  stats.resultsFound = searchResults.length;

  await logger.info(`Found ${searchResults.length} search results`);

  // Get existing URLs
  const { data: existingAggregators } = await getSupabase()
    .from("event_aggregators")
    .select("base_url, events_url");

  const existingUrls = new Set<string>();
  existingAggregators?.forEach((a) => {
    if (a.base_url) existingUrls.add(normalizeUrl(a.base_url));
    if (a.events_url) existingUrls.add(normalizeUrl(a.events_url));
  });

  // Also check event_sources
  const { data: existingSources } = await getSupabase()
    .from("event_sources")
    .select("url");
  
  existingSources?.forEach((s) => {
    if (s.url) existingUrls.add(normalizeUrl(s.url));
  });

  for (const result of searchResults) {
    const normalizedUrl = normalizeUrl(result.url);

    if (isBlockedSource(result.url)) {
      stats.blockedSkipped++;
      continue;
    }

    if (existingUrls.has(normalizedUrl)) {
      stats.duplicatesSkipped++;
      continue;
    }

    const aggregatorMatch = AGGREGATOR_PATTERNS.find((p) => p.pattern.test(result.url));
    const looksLikeEventPage = EVENT_PAGE_PATTERNS.some((p) => 
      p.test(result.url) || p.test(result.title)
    );

    if (aggregatorMatch || looksLikeEventPage) {
      const slug = extractSiteName(result.url).toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const { error } = await getSupabase().from("event_aggregators").insert({
        name: aggregatorMatch?.name || extractSiteName(result.url),
        slug,
        base_url: getBaseUrl(result.url),
        events_url: result.url,
        is_active: false,
        scrape_priority: aggregatorMatch?.priority || 30,
        metro_area: config.targetMetro,
      });

      if (error) {
        if (error.code === "23505") {
          stats.duplicatesSkipped++;
        }
      } else {
        await logger.success(`Added new aggregator: ${result.url}`);
        existingUrls.add(normalizedUrl);
        stats.newSourcesAdded++;
      }
    }
  }
}

export async function runDiscoveryAgent(): Promise<DiscoveryStats> {
  const startTime = Date.now();
  const errors: string[] = [];
  const logger = new AgentLogger("discovery");

  const stats: DiscoveryStats = {
    searchesPerformed: 0,
    resultsFound: 0,
    newSourcesAdded: 0,
    duplicatesSkipped: 0,
    blockedSkipped: 0,
    potentialSourcesProcessed: 0,
    sourcesValidated: 0,
    sourcesRejected: 0,
    sourcesSkipped: 0,
    accountsChecked: 0,
    accountsPublic: 0,
    accountsActive: 0,
    accountsEventRelated: 0,
    accountsInPalermo: 0,
    organizersCreated: 0,
  };

  try {
    const cleanedUp = await cleanupStuckRuns();
    if (cleanedUp > 0) {
      console.log(`Cleaned up ${cleanedUp} stuck agent runs`);
    }

    await logger.startRun();
    await logger.info("Starting Discovery Agent v2...");
    await logger.info(`Target metro: ${config.targetMetro}`);

    // Phase 1: Process queued potential sources (from mentions/collabs)
    if (isApifyConfigured()) {
      await processPotentialSources(logger, stats, 10);
    } else {
      await logger.warn("Apify not configured - skipping Instagram validation");
    }

    // Phase 2: Web search discovery
    await runWebSearchDiscovery(logger, stats);

    // Phase 3: Log top hashtags (for monitoring)
    const topHashtags = await getTopHashtags(10);
    if (topHashtags.length > 0) {
      await logger.info(`Top hashtags: ${topHashtags.map(h => `#${h.tag} (${h.occurrence_count})`).join(", ")}`);
    }

    // Send report
    const duration = Date.now() - startTime;
    const report: AgentReport = {
      agentName: "Discovery Agent v2",
      status: errors.length === 0 ? "success" : errors.length < 3 ? "partial" : "failed",
      duration,
      stats: {
        "Web Searches": stats.searchesPerformed,
        "Search Results": stats.resultsFound,
        "New Sources Added": stats.newSourcesAdded,
        "Duplicates Skipped": stats.duplicatesSkipped,
        "Blocked Skipped": stats.blockedSkipped,
        "Potential Sources Processed": stats.potentialSourcesProcessed,
        "Sources Validated": stats.sourcesValidated,
        "Sources Rejected": stats.sourcesRejected,
        "Sources Skipped": stats.sourcesSkipped,
        "Accounts Checked": stats.accountsChecked,
        "Accounts Public": stats.accountsPublic,
        "Accounts Active": stats.accountsActive,
        "Event-Related": stats.accountsEventRelated,
        "In Palermo": stats.accountsInPalermo,
      },
      errors,
    };

    await sendAgentReport(report);

    const summary = `Validated ${stats.sourcesValidated} sources, added ${stats.newSourcesAdded} aggregators`;
    await logger.completeRun(
      errors.length === 0 ? "completed" : "failed",
      stats,
      summary,
      errors.length > 0 ? errors.join("; ") : undefined
    );

    await logger.success("--- Discovery v2 Complete ---");
    await logger.info(`Potential sources processed: ${stats.potentialSourcesProcessed}`);
    await logger.info(`Sources validated: ${stats.sourcesValidated}`);
    await logger.info(`Sources skipped: ${stats.sourcesSkipped}`);
    await logger.info(`Web search sources added: ${stats.newSourcesAdded}`);

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Fatal error in discovery agent: ${errorMessage}`);
    await logger.completeRun("failed", stats, "Agent failed with fatal error", errorMessage);
    await alertError(error instanceof Error ? error : new Error(String(error)), "Discovery Agent v2");
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
