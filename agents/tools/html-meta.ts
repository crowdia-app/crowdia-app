/**
 * Extract metadata from HTML pages (og: tags, JSON-LD, time elements)
 * Used to enrich extracted events with data from their specific detail pages.
 */

export interface HtmlMetadata {
  image?: string;
  description?: string;
  startDate?: string; // ISO 8601
  endDate?: string;   // ISO 8601
}

/**
 * Extract Open Graph and structured data metadata from HTML.
 * Priority: JSON-LD > og: meta tags > <time> elements
 */
export function extractHtmlMetadata(html: string): HtmlMetadata {
  const meta: HtmlMetadata = {};

  // Try JSON-LD first — most accurate for event pages
  const jsonLdBlocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const [, jsonContent] of jsonLdBlocks) {
    try {
      const data = JSON.parse(jsonContent.trim());
      const items: unknown[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (
          typeof item !== "object" ||
          item === null ||
          !("@type" in item)
        )
          continue;
        const obj = item as Record<string, unknown>;
        const type = obj["@type"];
        if (type !== "Event" && type !== "MusicEvent" && type !== "SocialEvent")
          continue;

        if (obj.startDate && !meta.startDate)
          meta.startDate = String(obj.startDate);
        if (obj.endDate && !meta.endDate)
          meta.endDate = String(obj.endDate);
        if (obj.image && !meta.image) {
          const img = obj.image;
          if (typeof img === "string") meta.image = img;
          else if (Array.isArray(img) && img.length > 0)
            meta.image = String(img[0]);
          else if (typeof img === "object" && img !== null && "url" in img)
            meta.image = String((img as Record<string, unknown>).url);
        }
        if (obj.description && !meta.description)
          meta.description = htmlDecode(String(obj.description));
      }
    } catch {
      /* ignore JSON parse errors */
    }
  }

  // og:image
  if (!meta.image) {
    const m =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );
    if (m) meta.image = m[1];
  }

  // og:description
  if (!meta.description) {
    const m =
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i
      );
    if (m) meta.description = htmlDecode(m[1]);
  }

  // Fallback: first <time> element with a full date in datetime attribute
  if (!meta.startDate) {
    const m = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (m && /\d{4}-\d{2}-\d{2}/.test(m[1])) meta.startDate = m[1];
  }

  return meta;
}

function htmlDecode(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
