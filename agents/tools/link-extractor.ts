/**
 * Link Extractor - Extracts social, venue, and event platform links from HTML
 */

export interface ExtractedLinks {
  socialLinks: { platform: string; url: string; handle?: string }[];
  venueLinks: { name: string; url: string }[];
  organizerLinks: { name: string; url: string }[];
  eventPlatformLinks: { platform: string; url: string }[];
}

// Social media patterns
const SOCIAL_PATTERNS = {
  instagram: {
    url: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/gi,
    mention: /@([a-zA-Z0-9_.]+)/g,
  },
  facebook: {
    url: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/([a-zA-Z0-9.]+)\/?/gi,
  },
  twitter: {
    url: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?/gi,
  },
};

// Event platform patterns
const EVENT_PLATFORMS = [
  { name: "Eventbrite", pattern: /(?:https?:\/\/)?(?:www\.)?eventbrite\.(com|it)\/[^\s"'<>]+/gi },
  { name: "Dice", pattern: /(?:https?:\/\/)?(?:www\.)?dice\.fm\/[^\s"'<>]+/gi },
  { name: "RA", pattern: /(?:https?:\/\/)?(?:www\.)?ra\.co\/[^\s"'<>]+/gi },
  { name: "Xceed", pattern: /(?:https?:\/\/)?(?:www\.)?xceed\.me\/[^\s"'<>]+/gi },
  { name: "Ticketone", pattern: /(?:https?:\/\/)?(?:www\.)?ticketone\.it\/[^\s"'<>]+/gi },
  { name: "TicketSMS", pattern: /(?:https?:\/\/)?(?:www\.)?ticketsms\.it\/[^\s"'<>]+/gi },
  { name: "Feverup", pattern: /(?:https?:\/\/)?(?:www\.)?feverup\.com\/[^\s"'<>]+/gi },
  { name: "Shotgun", pattern: /(?:https?:\/\/)?(?:www\.)?shotgun\.live\/[^\s"'<>]+/gi },
];

// Organizer/venue section patterns (text near links)
const ORGANIZER_PATTERNS = [
  /(?:presented by|organiz(?:ed|er)|promoter|in collaboration with|curated by|hosted by|a cura di|organizzato da|presentato da|in collaborazione con)\s*[:\-]?\s*/gi,
];

const VENUE_PATTERNS = [
  /(?:venue|location|at|presso|@|luogo|dove)\s*[:\-]?\s*/gi,
];

/**
 * Extract Instagram handle from URL or mention
 */
function extractInstagramHandle(text: string): string | null {
  // URL format
  const urlMatch = text.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  
  // @mention format
  const mentionMatch = text.match(/@([a-zA-Z0-9_.]+)/);
  if (mentionMatch) return mentionMatch[1].toLowerCase();
  
  return null;
}

/**
 * Extract Facebook page name from URL
 */
function extractFacebookPage(url: string): string | null {
  const match = url.match(/(?:facebook\.com|fb\.com)\/([a-zA-Z0-9.]+)/i);
  if (match) {
    const page = match[1].toLowerCase();
    // Filter out common non-page paths
    const invalidPages = ["events", "pages", "groups", "profile.php", "sharer", "share"];
    if (!invalidPages.includes(page)) {
      return page;
    }
  }
  return null;
}

/**
 * Normalize and deduplicate URLs
 */
function normalizeUrl(url: string, baseUrl?: string): string {
  try {
    // Handle relative URLs
    if (url.startsWith("/") && baseUrl) {
      const base = new URL(baseUrl);
      url = `${base.protocol}//${base.host}${url}`;
    }
    
    // Add protocol if missing
    if (!url.startsWith("http")) {
      url = "https://" + url.replace(/^\/\//, "");
    }
    
    const parsed = new URL(url);
    // Remove tracking params
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("fbclid");
    parsed.searchParams.delete("igshid");
    
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/**
 * Check if URL is internal (same domain) or external
 */
function isExternalUrl(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(normalizeUrl(url, baseUrl)).hostname.replace("www.", "");
    const baseHost = new URL(baseUrl).hostname.replace("www.", "");
    return urlHost !== baseHost;
  } catch {
    return true;
  }
}

/**
 * Extract all links from HTML content
 */
export function extractLinksFromHtml(html: string, baseUrl: string): ExtractedLinks {
  const result: ExtractedLinks = {
    socialLinks: [],
    venueLinks: [],
    organizerLinks: [],
    eventPlatformLinks: [],
  };

  const seenUrls = new Set<string>();

  // Extract Instagram links and @mentions
  const igUrlMatches = html.matchAll(SOCIAL_PATTERNS.instagram.url);
  for (const match of igUrlMatches) {
    const url = normalizeUrl(match[0], baseUrl);
    const handle = extractInstagramHandle(url);
    if (handle && !seenUrls.has(`instagram:${handle}`)) {
      seenUrls.add(`instagram:${handle}`);
      result.socialLinks.push({
        platform: "instagram",
        url: `https://www.instagram.com/${handle}/`,
        handle,
      });
    }
  }

  // Also extract @mentions in text (not in URLs)
  const igMentionMatches = html.matchAll(SOCIAL_PATTERNS.instagram.mention);
  for (const match of igMentionMatches) {
    const handle = match[1].toLowerCase();
    // Skip short handles and common words
    if (handle.length >= 3 && !["the", "and", "for", "via"].includes(handle)) {
      if (!seenUrls.has(`instagram:${handle}`)) {
        seenUrls.add(`instagram:${handle}`);
        result.socialLinks.push({
          platform: "instagram",
          url: `https://www.instagram.com/${handle}/`,
          handle,
        });
      }
    }
  }

  // Extract Facebook links
  const fbMatches = html.matchAll(SOCIAL_PATTERNS.facebook.url);
  for (const match of fbMatches) {
    const url = normalizeUrl(match[0], baseUrl);
    const page = extractFacebookPage(url);
    if (page && !seenUrls.has(`facebook:${page}`)) {
      seenUrls.add(`facebook:${page}`);
      result.socialLinks.push({
        platform: "facebook",
        url,
        handle: page,
      });
    }
  }

  // Extract event platform links
  for (const platform of EVENT_PLATFORMS) {
    const matches = html.matchAll(platform.pattern);
    for (const match of matches) {
      const url = normalizeUrl(match[0], baseUrl);
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        result.eventPlatformLinks.push({
          platform: platform.name,
          url,
        });
      }
    }
  }

  // Extract venue/organizer links with context
  // Look for <a> tags with href and extract nearby text for context
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  const linkMatches = html.matchAll(linkPattern);

  for (const match of linkMatches) {
    const href = match[1];
    const linkText = match[2].trim();
    
    // Skip if already captured as social or event platform
    const normalizedHref = normalizeUrl(href, baseUrl);
    if (seenUrls.has(normalizedHref)) continue;
    
    // Skip internal links and common navigation
    if (!isExternalUrl(href, baseUrl)) continue;
    if (href.startsWith("#") || href.startsWith("javascript:")) continue;
    if (href.includes("mailto:") || href.includes("tel:")) continue;
    
    // Check if it's near an organizer mention
    const contextBefore = html.substring(Math.max(0, html.indexOf(match[0]) - 100), html.indexOf(match[0]));
    const isNearOrganizer = ORGANIZER_PATTERNS.some(p => p.test(contextBefore));
    const isNearVenue = VENUE_PATTERNS.some(p => p.test(contextBefore));

    if (isNearOrganizer && linkText.length >= 2) {
      result.organizerLinks.push({
        name: linkText,
        url: normalizedHref,
      });
      seenUrls.add(normalizedHref);
    } else if (isNearVenue && linkText.length >= 2) {
      result.venueLinks.push({
        name: linkText,
        url: normalizedHref,
      });
      seenUrls.add(normalizedHref);
    }
  }

  return result;
}

/**
 * Extract organizer/promoter names from text (without URLs)
 * Returns names that might be searchable on Instagram
 */
export function extractOrganizerNames(text: string): string[] {
  const names: string[] = [];
  
  for (const pattern of ORGANIZER_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      // Get text after the pattern (up to 100 chars or newline)
      const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 100);
      const nameMatch = afterMatch.match(/^([A-Z][a-zA-Z0-9\s&.']+?)(?:[,.\n\r<]|$)/);
      if (nameMatch && nameMatch[1].trim().length >= 3) {
        names.push(nameMatch[1].trim());
      }
    }
  }

  return [...new Set(names)];
}

/**
 * Extract venue names from text
 */
export function extractVenueNames(text: string): string[] {
  const names: string[] = [];
  
  for (const pattern of VENUE_PATTERNS) {
    pattern.lastIndex = 0;
    
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 100);
      const nameMatch = afterMatch.match(/^([A-Z][a-zA-Z0-9\s&.'-]+?)(?:[,.\n\r<]|$)/);
      if (nameMatch && nameMatch[1].trim().length >= 3) {
        names.push(nameMatch[1].trim());
      }
    }
  }

  return [...new Set(names)];
}

/**
 * Analyze page for embedded event widgets
 */
export function detectEventEmbeds(html: string): { platform: string; type: string }[] {
  const embeds: { platform: string; type: string }[] = [];
  
  // Eventbrite embed
  if (html.includes("eventbrite.com/widget") || html.includes("eventbritewidget")) {
    embeds.push({ platform: "Eventbrite", type: "widget" });
  }
  
  // Dice embed
  if (html.includes("dice.fm/embed") || html.includes("dice-event-widget")) {
    embeds.push({ platform: "Dice", type: "widget" });
  }
  
  // RA embed
  if (html.includes("ra.co/widget") || html.includes("resident-advisor")) {
    embeds.push({ platform: "RA", type: "widget" });
  }

  // iframes pointing to event platforms
  const iframeMatches = html.matchAll(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi);
  for (const match of iframeMatches) {
    const src = match[1].toLowerCase();
    if (src.includes("eventbrite")) {
      embeds.push({ platform: "Eventbrite", type: "iframe" });
    } else if (src.includes("dice.fm")) {
      embeds.push({ platform: "Dice", type: "iframe" });
    } else if (src.includes("ra.co")) {
      embeds.push({ platform: "RA", type: "iframe" });
    }
  }

  return embeds;
}
