import { fetchPageHeadless } from "./headless";

const rateLimitState: Record<string, number> = {};

const domainDelays: Record<string, number> = {
  "ra.co": 2000,
  "dice.fm": 2000,
  "eventbrite.com": 1500,
  "eventbrite.it": 1500,
  default: 2000,
};

// Domains that require headless browser (JS-rendered)
const headlessDomains = new Set([
  "ra.co",
  "dice.fm",
  "xceed.me",
  "ticketsms.it",
  "teatro.it",
  "palermoviva.it",
  "rockol.it",
  "virgilio.it",
]);

// Selectors to wait for on specific domains
const domainSelectors: Record<string, string> = {
  "ra.co": "[class*='event']",
  "dice.fm": "[class*='event']",
  "xceed.me": "[class*='event']",
};

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "default";
  }
}

async function respectRateLimit(domain: string): Promise<void> {
  const delay = domainDelays[domain] || domainDelays.default;
  const lastTime = rateLimitState[domain] || 0;
  const elapsed = Date.now() - lastTime;

  if (elapsed < delay) {
    await new Promise((resolve) => setTimeout(resolve, delay - elapsed));
  }

  rateLimitState[domain] = Date.now();
}

/**
 * Check if a domain requires headless browser
 */
export function requiresHeadless(url: string): boolean {
  const domain = getDomain(url);
  return headlessDomains.has(domain);
}

/**
 * Fetch a page using Jina AI Reader (converts HTML to markdown)
 */
export async function fetchPage(url: string): Promise<string> {
  await respectRateLimit("r.jina.ai");

  const jinaUrl = `https://r.jina.ai/${url}`;

  const response = await fetch(jinaUrl, {
    headers: {
      Accept: "text/plain",
      "X-Return-Format": "markdown",
    },
  });

  if (!response.ok) {
    throw new Error(`Jina fetch failed (${response.status}): ${await response.text()}`);
  }

  const content = await response.text();

  if (!content || content.length < 100) {
    throw new Error("Page content too short or empty");
  }

  return content;
}

/**
 * Fetch page directly (fallback)
 */
export async function fetchPageDirect(url: string): Promise<string> {
  const domain = getDomain(url);
  await respectRateLimit(domain);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CrowdiaBot/1.0; +https://crowdia.app)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Direct fetch failed (${response.status})`);
  }

  return response.text();
}

/**
 * Fetch with smart fallback - uses headless for JS-heavy sites
 */
export async function fetchPageWithFallback(url: string): Promise<string> {
  const domain = getDomain(url);

  // Use headless browser for known JS-heavy sites
  if (requiresHeadless(url)) {
    console.log(`Using headless browser for ${domain}`);
    try {
      const selector = domainSelectors[domain];
      const content = await fetchPageHeadless(url, {
        waitForSelector: selector,
        waitTime: 4000,
      });

      if (content && content.length > 100) {
        return content;
      }
      throw new Error("Headless fetch returned insufficient content");
    } catch (headlessError) {
      console.warn(`Headless failed for ${url}: ${headlessError}`);
      // Fall through to Jina
    }
  }

  // Try Jina first for non-headless sites
  try {
    return await fetchPage(url);
  } catch (jinaError) {
    console.warn(`Jina failed for ${url}, trying direct fetch`);
    return fetchPageDirect(url);
  }
}
