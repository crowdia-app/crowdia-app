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

const SCRAPLING_URL =
  process.env.SCRAPLING_URL || "http://127.0.0.1:8321";
let scraplingAvailable: boolean | null = null; // null = not checked yet

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

// Domains that work better with Jina reader (headless returns poor content)
const jinaPreferredDomains = new Set([
  "palermotoday.it",
  "eventbrite.it",
  "eventbrite.com",
]);

// Domains with Cloudflare protection that may need FlareSolverr
// Note: ra.co is handled separately via GraphQL API
const cloudflareDomains = new Set(["dice.fm"]);

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

// ---------------------------------------------------------------------------
// Scrapling service (primary tier)
// ---------------------------------------------------------------------------

interface ScraplingResponse {
  url: string;
  status: number;
  mode_used: string;
  html: string | null;
  text: string | null;
  elapsed_ms: number;
  error: string | null;
}

/**
 * Check if the Scrapling service is reachable (cached, re-checked on failure)
 */
async function isScraplingAvailable(): Promise<boolean> {
  if (scraplingAvailable === true) return true;
  try {
    const res = await fetch(`${SCRAPLING_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    scraplingAvailable = res.ok;
  } catch {
    scraplingAvailable = false;
  }
  return scraplingAvailable;
}

/**
 * Fetch via the Scrapling microservice.
 * Returns text content or null if the service is unavailable / fails.
 */
async function fetchWithScrapling(
  url: string,
  mode: "auto" | "direct" | "stealth" = "auto"
): Promise<string | null> {
  if (!(await isScraplingAvailable())) return null;

  try {
    const res = await fetch(`${SCRAPLING_URL}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, mode, timeout: 30 }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      console.warn(`Scrapling HTTP ${res.status} for ${url}`);
      return null;
    }

    const data: ScraplingResponse = await res.json();

    if (data.error) {
      console.warn(`Scrapling error for ${url}: ${data.error}`);
      return null;
    }

    // Prefer text extraction, fall back to HTML
    const content = data.text || data.html;
    if (content && content.length > 100) {
      console.log(
        `Scrapling OK (${data.mode_used}, ${data.elapsed_ms}ms): ${url}`
      );
      return content;
    }

    console.warn(`Scrapling returned insufficient content for ${url}`);
    return null;
  } catch (err) {
    // Service might have gone down mid-request
    scraplingAvailable = null;
    console.warn(`Scrapling fetch failed for ${url}: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy fetchers (kept as fallbacks)
// ---------------------------------------------------------------------------

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
 * Fetch page using the best method for the domain.
 *
 * Priority order:
 *   1. RA.co → dedicated GraphQL API (no fallback)
 *   2. Scrapling service (TLS-impersonated direct + stealth browser)
 *   3. Jina Reader (for known-good domains, legacy fallback)
 *   4. FlareSolverr (Cloudflare domains, legacy fallback)
 *   5. Headless Puppeteer (JS-rendered sites, legacy fallback)
 *   6. Direct HTTP fetch (last resort)
 */
export async function fetchPageWithFallback(url: string): Promise<string> {
  const domain = getDomain(url);

  // 1. RA.co — exclusive GraphQL, no fallback
  if (isRAUrl(url)) {
    console.log("Using RA.co GraphQL API (exclusive - no fallback)");
    const content = await fetchRAEvents();
    if (content && content.length > 100) {
      return content;
    }
    throw new Error("RA.co GraphQL returned insufficient content");
  }

  // 2. Try Scrapling first (handles most domains via TLS impersonation)
  const scraplingContent = await fetchWithScrapling(url);
  if (scraplingContent) {
    return scraplingContent;
  }

  // --- Scrapling failed or unavailable, fall back to legacy methods ---

  // 3. Jina Reader for domains where it works well
  if (jinaPreferredDomains.has(domain)) {
    console.log(`[fallback] Using Jina reader for ${domain}`);
    try {
      const content = await fetchPage(url);
      if (content && content.length > 500) {
        return content;
      }
    } catch (error) {
      console.warn(`Jina failed for ${url}: ${error}`);
    }
  }

  // 4. FlareSolverr for Cloudflare-protected domains
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

  // 5. Headless Puppeteer
  console.log(`[fallback] Using headless browser for ${domain}`);
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
  }

  // 6. Direct HTTP fetch (last resort)
  try {
    return await fetchPageDirect(url);
  } catch (directError) {
    console.warn(`Direct fetch also failed for ${url}`);
    throw directError;
  }
}
