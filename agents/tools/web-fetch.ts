const rateLimitState: Record<string, number> = {};

const domainDelays: Record<string, number> = {
  "ra.co": 2000,
  "dice.fm": 2000,
  "eventbrite.com": 1500,
  "eventbrite.it": 1500,
  default: 2000,
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
 * Fetch with fallback
 */
export async function fetchPageWithFallback(url: string): Promise<string> {
  try {
    return await fetchPage(url);
  } catch (jinaError) {
    console.warn(`Jina failed for ${url}, trying direct fetch`);
    return fetchPageDirect(url);
  }
}
