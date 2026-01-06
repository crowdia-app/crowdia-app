import { getSupabase } from "../db";

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
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CrowdiaBot/1.0)",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
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
