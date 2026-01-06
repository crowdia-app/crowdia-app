import { getSupabase } from "./db/client";
import { updateEvent } from "./db/events";
import { braveSearch } from "./tools/brave-search";
import { fetchPageHtmlHeadless, closeBrowser } from "./tools/headless";
import { uploadEventImage } from "./tools/image-storage";

interface EventWithMissingImage {
  id: string;
  title: string;
  event_url: string;
}

// Known listing page patterns that need individual URL lookup
const LISTING_PAGE_PATTERNS = [
  /ra\.co\/events\/[a-z]{2}\/[a-z-]+$/i,
  /\/events\/?$/i,
  /\/eventi\/?$/i,
  /\/eventi-a-palermo\/?$/i,
  /\/spettacoli\/[a-z]+\/?$/i,
  /xceed\.me\/[a-z]{2}\/[a-z]+\/events\/?$/i,
];

// Sites that require headless browser
const HEADLESS_DOMAINS = new Set(["ra.co", "dice.fm", "xceed.me", "teatro.it"]);

function isListingPageUrl(url: string): boolean {
  return LISTING_PAGE_PATTERNS.some((pattern) => pattern.test(url));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function needsHeadless(url: string): boolean {
  return HEADLESS_DOMAINS.has(getDomain(url));
}

/**
 * Extract og:image or other image URL from HTML content
 */
function extractImageFromHtml(html: string): string | null {
  // Try og:image first (most reliable)
  const ogImageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  );
  if (ogImageMatch?.[1]) return ogImageMatch[1];

  // Try alternate og:image format
  const ogImageAltMatch = html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
  );
  if (ogImageAltMatch?.[1]) return ogImageAltMatch[1];

  // Try twitter:image
  const twitterImageMatch = html.match(
    /<meta[^>]*(?:name|property)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
  );
  if (twitterImageMatch?.[1]) return twitterImageMatch[1];

  // Try itemprop image
  const itemPropMatch = html.match(
    /<meta[^>]*itemprop=["']image["'][^>]*content=["']([^"']+)["']/i
  );
  if (itemPropMatch?.[1]) return itemPropMatch[1];

  return null;
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  if (url.includes("placeholder") || url.includes("default")) return false;
  if (url.length < 20) return false;
  return true;
}

/**
 * Fetch HTML - uses headless for JS-heavy sites
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    if (needsHeadless(url)) {
      console.log(`    Using headless browser for ${getDomain(url)}`);
      return await fetchPageHtmlHeadless(url, { waitTime: 3000 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;
    return response.text();
  } catch (error) {
    return null;
  }
}

/**
 * Search for a specific event URL using Brave Search
 */
async function findEventUrl(
  title: string,
  currentUrl: string
): Promise<string | null> {
  const domain = getDomain(currentUrl);

  // Build search query based on domain
  let query: string;
  if (domain === "ra.co") {
    query = `site:ra.co "${title}" palermo`;
  } else if (domain === "teatro.it") {
    query = `site:teatro.it "${title}" palermo`;
  } else {
    query = `"${title}" palermo evento`;
  }

  console.log(`    Searching: ${query}`);

  try {
    // Add delay before search to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));

    const results = await braveSearch(query, { count: 5 });

    // Find the first result that's a specific event page (not a listing)
    for (const result of results) {
      if (!isListingPageUrl(result.url)) {
        // Verify the URL matches the expected domain pattern
        if (domain === "ra.co" && result.url.includes("ra.co/events/")) {
          // ra.co event pages have numeric IDs like /events/12345
          if (/ra\.co\/events\/\d+/.test(result.url)) {
            return result.url;
          }
        } else if (
          domain === "teatro.it" &&
          result.url.includes("teatro.it/")
        ) {
          // teatro.it event pages have /spettacolo/ or specific event URLs
          if (
            result.url.includes("/spettacolo/") ||
            result.url.includes("/spettacoli/")
          ) {
            // Check it's not just the listing page
            if (!/\/spettacoli\/[a-z]+\/?$/i.test(result.url)) {
              return result.url;
            }
          }
        } else if (!isListingPageUrl(result.url)) {
          return result.url;
        }
      }
    }
  } catch (error) {
    console.error(`    Search failed: ${error}`);
  }

  return null;
}

async function getEventsWithMissingImages(): Promise<EventWithMissingImage[]> {
  const { data, error } = await getSupabase()
    .from("events")
    .select("id, title, event_url")
    .eq("cover_image_url", "")
    .not("event_url", "is", null)
    .neq("event_url", "")
    .gte("event_start_time", new Date().toISOString());

  if (error) {
    console.error("Failed to fetch events:", error.message);
    return [];
  }

  return data || [];
}

export async function backfillImages(): Promise<void> {
  console.log("Starting enhanced image backfill...\n");

  const events = await getEventsWithMissingImages();
  console.log(`Found ${events.length} events with missing images\n`);

  let updated = 0;
  let urlsFixed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    for (const event of events) {
      try {
        console.log(`Processing: ${event.title}`);
        console.log(`  Current URL: ${event.event_url}`);

        let eventUrl = event.event_url;

        // If it's a listing page URL, try to find the real event URL
        if (isListingPageUrl(eventUrl)) {
          console.log(`  ⚠️ Listing page detected, searching for real URL...`);
          const newUrl = await findEventUrl(event.title, eventUrl);

          if (newUrl) {
            console.log(`  🔗 Found specific URL: ${newUrl}`);
            eventUrl = newUrl;
            urlsFixed++;
          } else {
            console.log(`  ❌ Could not find specific event URL\n`);
            skipped++;
            continue;
          }

          // Rate limit for search API
          await new Promise((r) => setTimeout(r, 1500));
        }

        // Fetch the page
        const html = await fetchHtml(eventUrl);

        if (!html) {
          console.log(`  ❌ Failed to fetch page\n`);
          failed++;
          continue;
        }

        // Extract image
        const imageUrl = extractImageFromHtml(html);

        if (!imageUrl || !isValidImageUrl(imageUrl)) {
          console.log(`  ⚠️ No valid image found\n`);
          skipped++;
          continue;
        }

        console.log(`  📷 Found image: ${imageUrl.substring(0, 60)}...`);

        // Upload image to Supabase Storage
        const uploadResult = await uploadEventImage(event.id, imageUrl);

        let finalImageUrl = imageUrl;
        if (uploadResult.success && uploadResult.publicUrl) {
          console.log(`  ☁️ Uploaded to storage`);
          finalImageUrl = uploadResult.publicUrl;
        } else {
          console.log(`  ⚠️ Storage upload failed, using original URL`);
        }

        // Update the event with both new URL (if changed) and image
        const updates: { cover_image_url: string; event_url?: string } = {
          cover_image_url: finalImageUrl,
        };

        if (eventUrl !== event.event_url) {
          updates.event_url = eventUrl;
        }

        const success = await updateEvent(event.id, updates);

        if (success) {
          console.log(`  ✅ Updated successfully\n`);
          updated++;
        } else {
          console.log(`  ❌ Failed to update\n`);
          failed++;
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(
          `  ❌ Error: ${error instanceof Error ? error.message : String(error)}\n`
        );
        failed++;
      }
    }
  } finally {
    // Clean up headless browser
    await closeBrowser();
  }

  console.log("\n--- Backfill Complete ---");
  console.log(`Updated: ${updated}`);
  console.log(`URLs fixed: ${urlsFixed}`);
  console.log(`Skipped (no image/URL found): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

// Run if executed directly
backfillImages().catch(console.error);
