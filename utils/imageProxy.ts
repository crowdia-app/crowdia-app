/**
 * Image proxy utility to work around CORS/ORB restrictions
 * Uses wsrv.nl (free image proxy service) for blocked domains
 */

// Domains that are known to block cross-origin requests or hotlink images
const BLOCKED_DOMAINS = [
  'palermotoday.it',
  'citynews-palermotoday.stgy.ovh',
  'citynews',
  'teatro.it',
  'orchestrasinfonicasiciliana.it',
  'teatrobiondo.it',
  'teatromassimo.it',
  'teatrogoldenpalermo.it',
];

/**
 * Check if a URL is from a blocked domain
 */
function isBlockedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return BLOCKED_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Get a proxied image URL if needed
 * Uses wsrv.nl as a free image proxy service
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('http')) {
    return null;
  }

  // Only proxy blocked domains
  if (isBlockedDomain(url)) {
    // wsrv.nl proxy format with output=jpg to ensure correct content-type
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=85`;
  }

  return url;
}

/**
 * Get a proxied image URL with resize options
 */
export function getProxiedImageUrlWithSize(
  url: string | null | undefined,
  width?: number,
  height?: number
): string | null {
  if (!url || !url.startsWith('http')) {
    return null;
  }

  // Only proxy blocked domains
  if (isBlockedDomain(url)) {
    let proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
    if (width) proxyUrl += `&w=${width}`;
    if (height) proxyUrl += `&h=${height}`;
    proxyUrl += '&fit=cover';
    return proxyUrl;
  }

  return url;
}
