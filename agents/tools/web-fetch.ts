import { fetchPageHeadless } from "./headless";
import {
  isFlareSolverrAvailable,
  fetchWithFlareSolverr,
  extractTextFromHtml,
} from "./flaresolverr";
import { isRAUrl, fetchRAEvents } from "./ra-fetcher";

const rateLimitState: Record<string, number> = {};
let flareSolverrChecked = false;
let flareSolverrAvailable = false;

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

// Domains with Cloudflare protection that may need FlareSolverr
const cloudflareDomains = new Set(["ra.co", "dice.fm"]);

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
 * Check if FlareSolverr is available (cached check)
 */
async function checkFlareSolverr(): Promise<boolean> {
  if (!flareSolverrChecked) {
    flareSolverrAvailable = await isFlareSolverrAvailable();
    flareSolverrChecked = true;
    if (flareSolverrAvailable) {
      console.log("FlareSolverr is available for Cloudflare bypass");
    }
  }
  return flareSolverrAvailable;
}

/**
 * Fetch page using Playwright headless browser (preferred method)
 * Returns text content extracted from the page
 */
export async function fetchPageWithFallback(url: string): Promise<string> {
  const domain = getDomain(url);

  // Special handling for RA.co - use GraphQL API to bypass Cloudflare
  if (isRAUrl(url)) {
    console.log("Using RA.co GraphQL API");
    try {
      const content = await fetchRAEvents();
      if (content && content.length > 100) {
        return content;
      }
    } catch (error) {
      console.warn(`RA.co GraphQL failed: ${error}`);
      // Fall through to other methods
    }
  }

  // For Cloudflare-protected domains, try FlareSolverr first if available
  if (cloudflareDomains.has(domain)) {
    const hasFlareSolverr = await checkFlareSolverr();
    if (hasFlareSolverr) {
      try {
        const html = await fetchWithFlareSolverr(url);
        if (html && html.length > 500) {
          return extractTextFromHtml(html);
        }
      } catch (error) {
        console.warn(`FlareSolverr failed for ${url}: ${error}`);
      }
    }
  }

  // Use Playwright headless browser for all sites (preserves images in content)
  console.log(`Using headless browser for ${domain}`);
  try {
    const selector = domainSelectors[domain];
    const content = await fetchPageHeadless(url, {
      waitForSelector: selector,
      waitTime: 3000,
    });

    if (content && content.length > 100) {
      return content;
    }
    throw new Error("Headless fetch returned insufficient content");
  } catch (headlessError) {
    console.warn(`Headless failed for ${url}: ${headlessError}`);
    // Fall through to direct fetch
  }

  // Fallback to direct fetch
  try {
    return await fetchPageDirect(url);
  } catch (directError) {
    console.warn(`Direct fetch also failed for ${url}`);
    throw directError;
  }
}
