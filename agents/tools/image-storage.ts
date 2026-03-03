import { getSupabase } from "../db";
import { randomUUID } from "crypto";

interface ImageUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

/**
 * Download an image from a URL
 * Returns null if download fails or content is not a valid image
 */
async function downloadImage(url: string): Promise<DownloadedImage | null> {
  try {
    // Determine appropriate headers based on domain
    const domain = new URL(url).hostname;
    let headers: Record<string, string>;
    
    if (domain.includes("instagram") || domain.includes("cdninstagram") || domain.includes("fbcdn")) {
      // Instagram/Facebook CDN
      headers = {
        "User-Agent": "Instagram 219.0.0.12.117 Android",
        Accept: "image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.instagram.com/",
      };
    } else {
      // Standard browser headers for other sites
      headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
        Referer: `https://${domain}/`,
      };
    }
    
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      console.log(`Image download failed: ${response.status} for ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      console.log(`Not an image: ${contentType} for ${url}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Skip tiny/placeholder images (less than 5KB)
    if (buffer.length < 5000) {
      console.log(`Image too small (${buffer.length} bytes): ${url}`);
      return null;
    }

    return { buffer, contentType };
  } catch (error) {
    console.error(`Failed to download image: ${url}`, error);
    return null;
  }
}

/**
 * Get file extension from URL or content type
 */
function getFileExtension(url: string, contentType: string): string {
  // Try to get from URL
  const urlMatch = url.match(/\.(jpe?g|png|webp|gif)/i);
  if (urlMatch) return urlMatch[1].toLowerCase().replace("jpeg", "jpg");

  // Fall back to content type
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Check if URL is already stored in our bucket
 */
export function isStoredInBucket(url: string): boolean {
  if (!url) return false;
  return url.includes("supabase.co/storage") && url.includes("event-images");
}

/**
 * Patterns for URLs that are known to be generic/placeholder/logo images,
 * not images that are specific to a particular event.
 *
 * Used to reject images before they are stored as event cover images so
 * that multiple events don't end up sharing the same placeholder artwork.
 */
const GENERIC_IMAGE_URL_PATTERNS: RegExp[] = [
  // Explicit placeholder/no-image filenames
  /\/placeholder\b/i,
  /\/no[-_]?image/i,
  /\/no[-_]?photo/i,
  /\/default[-_]?image/i,
  /\/missing[-_]?image/i,
  /\/generic[-_]?event/i,
  // Site-specific generic images we have observed in the wild
  /events\/placeholder\.jpg/i,              // teatro.it/images/events/placeholder.jpg
  /spettacoli\/placeholder\.jpg/i,          // teatrobiondo.it/images/spettacoli/placeholder.jpg
  /no-image-event\.jpg/i,                   // teatro.it/images/no-image-event.jpg
  /eventi-palermo-e-dintorni/i,             // enjoysicilia.it generic banner
  /canzoni-fb\.png/i,                       // canzoni.it generic Facebook image
  /teatro\.it-spettacoli-teatrali\.jpg/i,   // teatro.it listing page image
  // Logo images (site branding, not event artwork)
  /\/logo[-_]?(site|header|main|footer)/i,
  /balarm_logo/i,
  /crowdia[-_]logo/i,
  // Fallback image stored in our own bucket under /fallback/ prefix
  /\/event-images\/fallback\//i,
  // URLs that are not image files at all (e.g., a homepage URL assigned as image_url)
  // We detect these by checking that the URL has no image extension AND no image CDN pattern
];

/**
 * Return true when the URL is a known generic, placeholder, or logo image
 * that should NOT be used as an event cover image.
 *
 * This prevents multiple events from sharing the same non-specific artwork.
 */
export function isGenericImageUrl(url: string): boolean {
  if (!url) return false;
  return GENERIC_IMAGE_URL_PATTERNS.some((p) => p.test(url));
}

/**
 * Return true when a URL is a valid, event-specific image URL suitable for
 * use as a cover image.
 *
 * Rejects:
 * - empty / non-http URLs
 * - known generic/placeholder/logo images
 * - URLs that appear to be HTML pages rather than image files
 */
export function isValidEventImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  if (url.length < 20) return false;
  if (url.includes("placeholder") || url.includes("no-image")) return false;
  if (isGenericImageUrl(url)) return false;

  // Reject URLs that look like HTML pages (no extension or clearly HTML path)
  // A valid image URL typically ends with an image extension, a query string,
  // or is served from a known image CDN.
  const hasImageExtension = /\.(jpe?g|png|webp|gif|avif|svg)(\?|#|$)/i.test(url);
  const isImageCdn =
    url.includes("supabase.co/storage") ||
    url.includes("cdninstagram") ||
    url.includes("fbcdn.net") ||
    url.includes("wsrv.nl") ||
    url.includes("/storage/") ||
    url.includes("/uploads/") ||
    url.includes("/images/") ||
    url.includes("/media/") ||
    url.includes("/img/") ||
    url.includes("/photos/") ||
    url.includes("/assets/");

  return hasImageExtension || isImageCdn;
}

/**
 * Upload an event image to Supabase Storage
 * Downloads the image from the source URL and stores it in our bucket
 */
export async function uploadEventImage(
  eventId: string,
  imageUrl: string
): Promise<ImageUploadResult> {
  // Skip if already in our bucket
  if (isStoredInBucket(imageUrl)) {
    return { success: false, error: "Already stored in bucket" };
  }

  // Skip invalid URLs
  if (!imageUrl || imageUrl.length < 10 || !imageUrl.startsWith("http")) {
    return { success: false, error: "Invalid image URL" };
  }

  // Reject known generic/placeholder/logo images so multiple events don't
  // end up sharing the same non-specific artwork.
  if (isGenericImageUrl(imageUrl)) {
    return { success: false, error: "Generic or placeholder image — skipped" };
  }

  const imageData = await downloadImage(imageUrl);
  if (!imageData) {
    return { success: false, error: "Failed to download image" };
  }

  const ext = getFileExtension(imageUrl, imageData.contentType);
  const filePath = `events/${eventId}.${ext}`;

  const supabase = getSupabase();

  const { error } = await supabase.storage.from("event-images").upload(filePath, imageData.buffer, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: true,
    cacheControl: "31536000", // 1 year cache
  });

  if (error) {
    console.error(`Storage upload failed for ${eventId}: ${error.message}`);
    return { success: false, error: error.message };
  }

  const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(filePath);

  console.log(`Uploaded image for event ${eventId}: ${urlData.publicUrl}`);
  return { success: true, publicUrl: urlData.publicUrl };
}

/**
 * Pre-upload Instagram images immediately after scraping (before CDN URLs expire)
 * Returns a map of original URL -> storage URL for replacement
 */
export async function preUploadInstagramImages(
  posts: Array<{ shortCode: string; displayUrl?: string; images?: string[] }>
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const supabase = getSupabase();
  
  for (const post of posts) {
    const imageUrl = post.displayUrl || post.images?.[0];
    if (!imageUrl || isStoredInBucket(imageUrl)) continue;
    
    try {
      const imageData = await downloadImage(imageUrl);
      if (!imageData) continue;
      
      const ext = getFileExtension(imageUrl, imageData.contentType);
      // Use post shortCode for unique naming
      const filePath = `instagram/${post.shortCode}.${ext}`;
      
      const { error } = await supabase.storage.from("event-images").upload(filePath, imageData.buffer, {
        contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: true,
        cacheControl: "31536000",
      });
      
      if (error) {
        console.error(`Pre-upload failed for ${post.shortCode}: ${error.message}`);
        continue;
      }
      
      const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(filePath);
      urlMap.set(imageUrl, urlData.publicUrl);
      console.log(`Pre-uploaded ${post.shortCode} image to storage`);
    } catch (err) {
      console.error(`Pre-upload error for ${post.shortCode}:`, err);
    }
  }
  
  return urlMap;
}
