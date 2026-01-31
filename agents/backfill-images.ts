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
  /\/spettacoli\/?$/i,
  /xceed\.me\/[a-z]{2}\/[a-z]+\/events\/?$/i,
  /teatromassimo\.it\/calendario\/?$/i,
  /orchestrasinfonicasiciliana\.it\/.*\/calendario\/?$/i,
  /teatrobiondo\.it\/spettacoli\/?$/i,
  // Additional patterns for sources that store listing URLs
  /enjoysicilia\.it\/.*feste-sagre-eventi/i,
  /palermoviva\.it\/eventi-a-palermo\/?$/i,
  /canzoni\.it\/concerti\/italia\/[a-z]+\/?$/i,
  /rockol\.it\/concerti-[a-z]+-p-/i,
  /teatrogoldenpalermo\.it\/eventi-in-programma\/?$/i,
  /itinerarinellarte\.it\/.*\/eventi\/[a-z]+\/?$/i,
];

// Sites that require headless browser
const HEADLESS_DOMAINS = new Set(["ra.co", "dice.fm", "xceed.me", "teatro.it", "teatrobiondo.it"]);

// Known generic/listing page images that should be filtered out
const GENERIC_IMAGE_PATTERNS = [
  /eventi-palermo-e-dintorni\.png$/i,  // enjoysicilia.it generic
  /canzoni-fb\.png$/i,                  // canzoni.it generic
  /teatro\.it-spettacoli-teatrali\.jpg$/i, // teatro.it listing
  /\/default[-_]?image/i,
  /\/placeholder/i,
  /\/no[-_]?image/i,
  /\/missing[-_]?image/i,
  /\/generic[-_]?event/i,
  /\/logo[-_]?(site|header|main)/i,
];

// Crowdia fallback image URL (uploaded to Supabase storage)
const CROWDIA_FALLBACK_IMAGE = "https://mqcufztknioapxuzsevn.supabase.co/storage/v1/object/public/event-images/fallback/crowdia-logo.png";

/**
 * Check if an image URL is a known generic/listing image
 */
function isGenericImage(url: string): boolean {
  return GENERIC_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}

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
 * Falls back to CSS background-image and content images if no meta tags found
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

  // Try CSS background-image (used by teatro.it and others)
  // Look for main-image, hero, poster patterns in background URLs
  const bgImagePattern = /background(?:-image)?\s*:\s*url\(['"]?(https?:\/\/[^'")\s]+(?:main-image|hero|poster|cover|featured)[^'")\s]*)['"]\)/gi;
  const bgMatch = bgImagePattern.exec(html);
  if (bgMatch?.[1]) return bgMatch[1];

  // Try any background-image with common image extensions
  const anyBgPattern = /background(?:-image)?\s*:\s*url\(['"]?(https?:\/\/[^'")\s]+\.(?:jpg|jpeg|png|webp)[^'")\s]*)['"]\)/gi;
  const anyBgMatch = anyBgPattern.exec(html);
  if (anyBgMatch?.[1]) return anyBgMatch[1];

  // Try img tags with hero/main/poster classes
  const heroImgMatch = html.match(
    /<img[^>]*class=["'][^"']*(?:hero|main|poster|cover|featured|event-image)[^"']*["'][^>]*src=["']([^"']+)["']/i
  );
  if (heroImgMatch?.[1] && heroImgMatch[1].startsWith('http')) return heroImgMatch[1];

  // Try img with src first (alternate attribute order)
  const heroImgAltMatch = html.match(
    /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*(?:hero|main|poster|cover|featured|event-image)[^"']*["']/i
  );
  if (heroImgAltMatch?.[1] && heroImgAltMatch[1].startsWith('http')) return heroImgAltMatch[1];

  // Try data-src for lazy-loaded images
  const dataSrcMatch = html.match(
    /<img[^>]*data-src=["']([^"']+)["'][^>]*class=["'][^"']*(?:hero|main|poster|cover|featured)[^"']*["']/i
  );
  if (dataSrcMatch?.[1] && dataSrcMatch[1].startsWith('http')) return dataSrcMatch[1];

  return null;
}

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  if (url.includes("placeholder") || url.includes("default")) return false;
  if (url.length < 20) return false;
  // Filter out known generic/listing images
  if (isGenericImage(url)) {
    console.log(`    ⚠️ Skipping generic image: ${url.substring(url.lastIndexOf('/') + 1)}`);
    return false;
  }
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
  } else if (domain === "teatromassimo.it") {
    query = `site:teatromassimo.it "${title}"`;
  } else if (domain === "orchestrasinfonicasiciliana.it") {
    query = `site:orchestrasinfonicasiciliana.it "${title}"`;
  } else if (domain === "teatrobiondo.it") {
    query = `site:teatrobiondo.it "${title}"`;
  } else if (domain === "enjoysicilia.it") {
    // enjoysicilia events - try to find specific event pages
    query = `site:enjoysicilia.it "${title}"`;
  } else if (domain === "palermotoday.it") {
    query = `site:palermotoday.it "${title}"`;
  } else if (domain === "canzoni.it" || domain === "rockol.it") {
    // Music concert sites - search for specific concert page
    query = `"${title}" concerto palermo sicilia`;
  } else if (domain === "teatrogoldenpalermo.it") {
    query = `site:teatrogoldenpalermo.it "${title}"`;
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
        } else if (
          domain === "teatromassimo.it" &&
          result.url.includes("teatromassimo.it/event/")
        ) {
          // Teatro Massimo event pages are like /event/turandot-2/
          return result.url;
        } else if (
          domain === "orchestrasinfonicasiciliana.it" &&
          result.url.includes("/evento/")
        ) {
          // Orchestra Sinfonica event pages have /evento/ in the URL
          return result.url;
        } else if (
          domain === "teatrobiondo.it" &&
          result.url.includes("teatrobiondo.it/") &&
          !result.url.endsWith("/spettacoli/")
        ) {
          return result.url;
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
        let imageUrl = extractImageFromHtml(html);
        let usingFallback = false;

        if (!imageUrl || !isValidImageUrl(imageUrl)) {
          console.log(`  ⚠️ No valid image found, using Crowdia fallback`);
          imageUrl = CROWDIA_FALLBACK_IMAGE;
          usingFallback = true;
        } else {
          console.log(`  📷 Found image: ${imageUrl.substring(0, 60)}...`);
        }

        // Upload image to Supabase Storage (skip if using fallback - already in storage)
        let finalImageUrl = imageUrl;
        if (!usingFallback) {
          const uploadResult = await uploadEventImage(event.id, imageUrl);
          if (uploadResult.success && uploadResult.publicUrl) {
            console.log(`  ☁️ Uploaded to storage`);
            finalImageUrl = uploadResult.publicUrl;
          } else {
            console.log(`  ⚠️ Storage upload failed, using original URL`);
          }
        } else {
          console.log(`  🫒 Using Crowdia fallback image`);
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
