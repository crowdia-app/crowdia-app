import OpenAI from "openai";
import { z } from "zod";
import { config } from "../config";

/**
 * Fix unescaped quotes in JSON string values
 * This handles cases where the LLM generates strings like: "title": "Film "Title" here"
 * and converts them to: "title": "Film \"Title\" here"
 */
function fixUnescapedQuotes(jsonStr: string): string {
  // Use a state machine to track if we're inside a string value
  let result = '';
  let inString = false;
  let inPropertyName = false;
  let afterColon = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const prevChar = i > 0 ? jsonStr[i - 1] : '';
    const nextChar = i < jsonStr.length - 1 ? jsonStr[i + 1] : '';

    if (char === '"' && prevChar !== '\\') {
      if (!inString) {
        // Starting a new string
        inString = true;
        inPropertyName = !afterColon;
        afterColon = false;
        result += char;
      } else {
        // Ending a string or unescaped quote inside?
        // Check if this is the closing quote by looking ahead
        const isClosingQuote = nextChar === ',' || nextChar === '}' || nextChar === ']' ||
                               nextChar === ':' || nextChar === ' ' || nextChar === '\n' ||
                               nextChar === '\r' || nextChar === '\t';

        if (inPropertyName && nextChar === ':') {
          // End of property name
          inString = false;
          inPropertyName = false;
          result += char;
        } else if (isClosingQuote) {
          // End of string value
          inString = false;
          result += char;
        } else {
          // Unescaped quote inside string value - escape it
          result += '\\' + char;
        }
      }
    } else if (char === ':' && !inString) {
      afterColon = true;
      result += char;
    } else {
      result += char;
    }
  }

  return result;
}

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterKey,
  defaultHeaders: {
    "HTTP-Referer": "https://crowdia.app",
    "X-Title": "Crowdia Event Scout",
  },
});

export interface ExtractedEvent {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location_name?: string;
  location_address?: string;
  organizer_name?: string;
  ticket_url?: string;
  image_url?: string;
  detail_url: string;
  category?: string;
}

// Zod schema for validation
const ExtractedEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  start_time: z.string().min(1),
  end_time: z.string().optional().nullable(),
  location_name: z.string().optional().nullable(),
  location_address: z.string().optional().nullable(),
  organizer_name: z.string().optional().nullable(),
  ticket_url: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  detail_url: z.string().min(1),
  category: z.string().optional().nullable(),
});

const ExtractedEventsResponseSchema = z.object({
  events: z.array(ExtractedEventSchema),
});

// Standardized categories for event extraction
const STANDARD_CATEGORIES = [
  "Nightlife",      // Club nights, DJ sets, disco, afterparties
  "Concert",        // Live music performances, bands, artists
  "Party",          // Private parties, themed parties, celebrations
  "Theater",        // Plays, drama, stage performances
  "Comedy",         // Stand-up, cabaret, comedy shows
  "Art",            // Exhibitions, galleries, art shows
  "Food & Wine",    // Tastings, food festivals, culinary events
  "Tour",           // Guided tours, walking tours, excursions
  "Festival",       // Multi-day festivals, street festivals
  "Workshop",       // Classes, seminars, hands-on activities
  "Cultural",       // Museums, heritage, historical events
  "Sports",         // Sporting events, fitness activities
  "Family",         // Kid-friendly events, family activities
  "Networking",     // Business events, meetups, professional gatherings
  "Film",           // Cinema, screenings, film festivals
  "Other",          // Events that don't fit other categories
];

const eventSchema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          start_time: { type: "string", description: "ISO 8601 datetime" },
          end_time: { type: "string" },
          location_name: { type: "string" },
          location_address: { type: "string" },
          organizer_name: { type: "string" },
          ticket_url: { type: "string" },
          image_url: { type: "string" },
          detail_url: { type: "string", description: "The specific URL to this event's detail page (NOT a listing page)" },
          category: { type: "string", description: "Event category from the standard list", enum: STANDARD_CATEGORIES },
        },
        required: ["title", "start_time", "detail_url", "category"],
      },
    },
  },
  required: ["events"],
};

/**
 * Sleep helper for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry helper with exponential backoff
 * Retries on rate limit errors with delays: 4s, 8s, 16s, 32s
 * This matches OpenRouter's 20 req/min limit (1 req every 3 seconds)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 4,
  initialDelayMs: number = 4000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a rate limit error
      const isRateLimit =
        lastError.message.includes('429') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('Rate limit');

      if (!isRateLimit || attempt === maxRetries) {
        // Not a rate limit error, or we've exhausted retries
        throw lastError;
      }

      // Calculate delay with exponential backoff: 4s, 8s, 16s, 32s
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  throw lastError!;
}

/**
 * Extract events with validation and retry on parsing failures
 */
async function extractWithValidation(
  truncatedContent: string,
  sourceName: string,
  sourceUrl: string,
  attempt: number = 1
): Promise<ExtractedEvent[]> {
  const maxAttempts = 3;

  const response = await retryWithBackoff(async () => {
    return await openrouter.chat.completions.create({
      model: config.model,
      response_format: { type: "json_object" }, // Enable JSON mode
      messages: [
        {
          role: "system",
          content: `You are an event extraction assistant. Extract upcoming events from the provided page content.

CRITICAL LOCATION FILTER:
- ONLY extract events physically located in Palermo, Sicily or the Palermo province (e.g., Monreale, Bagheria, Cefalù, Terrasini, Carini, etc.)
- REJECT any events in other Italian cities (Rome, Milan, Catania, etc.) or other countries
- If an event's location is unclear or outside Palermo province, DO NOT include it

CATEGORY CLASSIFICATION (REQUIRED):
You MUST assign a category to every event from this list:
- "Nightlife" - Club nights, DJ sets, disco, techno, house music, afterparties, rave events
- "Concert" - Live music performances, bands, solo artists, orchestra
- "Party" - Private parties, themed parties, celebrations, New Year's Eve parties
- "Theater" - Plays, drama, musicals, stage performances, opera
- "Comedy" - Stand-up comedy, cabaret, comedy shows
- "Art" - Exhibitions, galleries, art shows, installations
- "Food & Wine" - Wine tastings, food festivals, culinary events, degustazioni
- "Tour" - Guided tours, walking tours, excursions, visite guidate
- "Festival" - Multi-day festivals, street festivals, sagre
- "Workshop" - Classes, seminars, hands-on activities, corsi
- "Cultural" - Museums, heritage sites, historical events, conferences
- "Sports" - Sporting events, fitness activities, marathons
- "Family" - Kid-friendly events, family activities
- "Networking" - Business events, meetups, professional gatherings, aperitivi
- "Film" - Cinema, screenings, film festivals
- "Other" - Only if no other category fits

IMPORTANT CATEGORY HINTS:
- Events from ra.co, Xceed, Dice are typically "Nightlife" (club/DJ events)
- Events with "DJ", "techno", "house", "disco", "rave", "afterparty" in title → "Nightlife"
- Candlelight concerts → "Concert"
- Teatro/theater venues → "Theater"
- Pub crawls, aperitivo events → "Nightlife" or "Networking"

EXTRACTION RULES:
- Extract as much information as possible for each event
- If a date doesn't have a year, assume it's the upcoming occurrence
- Convert dates to ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
- If no specific time is given, use 21:00 as default for evening events, 10:00 for morning events
- Only include events with clear dates (skip "coming soon" or TBA events)

IMAGE EXTRACTION (IMPORTANT):
- The content contains pre-extracted event data in this format:
  EVENT: title
    URL: event_url
    IMAGE: image_url
    DATE: date_info
- Copy the IMAGE URL directly as image_url for each event
- If IMAGE is present, ALWAYS include it - this is critical for the UI
- The image_url must be an absolute URL starting with http:// or https://

EVENT URL EXTRACTION (CRITICAL):
- detail_url MUST be the specific URL to THIS event's detail page, NOT a listing page
- Look for links like "/events/12345", "/event/event-name", or similar patterns
- NEVER use the source listing page URL (like /events or /events/city) as detail_url
- If you cannot find a specific event detail URL, skip that event entirely
- The detail_url should be a complete absolute URL (https://...)`,
          },
          {
            role: "user",
            content: `Extract all events from this page (source: ${sourceName}, URL: ${sourceUrl}):

${truncatedContent}

IMPORTANT: You MUST respond with valid JSON. Use the response_format JSON mode properly:
- All string values with quotes must escape them (e.g., "He said \\"hello\\"")
- All properties must have valid values (no undefined)
- Return JSON matching this schema:
${JSON.stringify(eventSchema, null, 2)}`,
        },
      ],
      max_tokens: 16384,
      temperature: 0.3,
    });
  });

  const responseContent = response.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("Empty response from LLM");
  }

  // Check if response was truncated
  const finishReason = response.choices[0]?.finish_reason;
  if (finishReason === 'length') {
    console.warn(`⚠️  LLM response truncated (hit max_tokens). Source: ${sourceName}, attempt: ${attempt}/${maxAttempts}`);
  }

  // Fix unescaped quotes in JSON strings before parsing
  const fixedContent = fixUnescapedQuotes(responseContent);

  // Parse and validate with Zod
  try {
    const parsed = JSON.parse(fixedContent);
    const validated = ExtractedEventsResponseSchema.parse(parsed);
    return validated.events as ExtractedEvent[];
  } catch (error) {
    // Log validation error
    if (error instanceof z.ZodError) {
      console.error(`Zod validation failed (attempt ${attempt}/${maxAttempts}):`, error.errors);
    } else {
      console.error(`JSON parsing failed (attempt ${attempt}/${maxAttempts}):`, error);
    }

    // Retry on validation failure (up to maxAttempts)
    if (attempt < maxAttempts) {
      console.warn(`Retrying extraction for ${sourceName} (attempt ${attempt + 1}/${maxAttempts})...`);
      await sleep(2000); // Wait 2 seconds before retry
      return extractWithValidation(truncatedContent, sourceName, sourceUrl, attempt + 1);
    }

    // If all retries exhausted, throw error
    throw new Error(
      `Failed to extract valid events after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function extractEventsFromContent(
  content: string,
  sourceName: string,
  sourceUrl: string
): Promise<ExtractedEvent[]> {
  // Truncate if too long
  const maxLength = 100000;
  const truncatedContent =
    content.length > maxLength
      ? content.substring(0, maxLength) + "\n\n[Content truncated...]"
      : content;

  try {
    return await extractWithValidation(truncatedContent, sourceName, sourceUrl);
  } catch (error) {
    // Check for rate limit errors
    if (error instanceof Error && error.message.includes('429')) {
      const rateLimitError = new Error(`Rate limit exceeded on OpenRouter after retries. Consider adding credits to your account.`);
      (rateLimitError as any).isRateLimitError = true;
      (rateLimitError as any).originalError = error;
      throw rateLimitError;
    }
    throw error;
  }
}
