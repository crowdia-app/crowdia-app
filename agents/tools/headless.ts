import puppeteer, { Browser } from "puppeteer";

let browser: Browser | null = null;

/**
 * Get or create a shared browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: "new", // Use new headless mode for better stealth
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled", // Hide automation
        "--disable-features=IsolateOrigins,site-per-process",
        "--window-size=1920,1080",
      ],
    });
  }
  return browser;
}

/**
 * Close the shared browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Fetch a page using headless browser (for JS-rendered content)
 */
export async function fetchPageHeadless(
  url: string,
  options: {
    waitForSelector?: string;
    waitTime?: number;
    timeout?: number;
  } = {}
): Promise<string> {
  const { waitForSelector, waitTime = 3000, timeout = 30000 } = options;

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Hide webdriver property to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      // Override plugins to look more like a real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'it'],
      });
    });

    // Navigate to the page
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout,
    });

    // Wait for specific selector if provided
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {
        console.warn(`Selector "${waitForSelector}" not found, continuing...`);
      });
    }

    // Scroll to trigger lazy loading of images
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollTo(0, (i + 1) * 1500);
        await new Promise(r => setTimeout(r, 300));
      }
      window.scrollTo(0, 0); // Scroll back to top
    });

    // Wait for JS to render
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // Extract structured content with event details and images
    const content = await page.evaluate(() => {
      const results: string[] = [];

      // Get og:image meta tag for the page
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      if (ogImage) {
        results.push(`[page og:image: ${ogImage}]`);
      }

      // Find event cards - prioritize well-structured cards with images
      const eventSelectors = [
        'article[class*="card"]', // PalermoToday, news sites
        '[class*="event-card"]', '[class*="eventcard"]',
        '.event-item', '.listing-item',
        '[class*="event"][class*="item"]',
      ];

      const seen = new Set<string>();

      for (const selector of eventSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Get the link
          const link = el.tagName === 'A' ? el as HTMLAnchorElement : el.querySelector('a');
          const href = link?.getAttribute('href') || '';

          if (!href || seen.has(href)) return;
          seen.add(href);

          // Get title
          const titleEl = el.querySelector('h1, h2, h3, h4, .title, [class*="title"]') || link;
          const title = titleEl?.textContent?.trim() || '';

          if (!title || title.length < 5) return;

          // Get image (handle protocol-relative URLs)
          const img = el.querySelector('img');
          let imgSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
          if (imgSrc.startsWith('//')) {
            imgSrc = 'https:' + imgSrc;
          }

          // Get date/time info
          const dateEl = el.querySelector('time, .date, [class*="date"], [class*="time"]');
          const dateText = dateEl?.textContent?.trim() || '';

          // Get description
          const descEl = el.querySelector('p, .description, [class*="desc"]');
          const desc = descEl?.textContent?.trim().substring(0, 200) || '';

          // Build event entry
          let entry = `EVENT: ${title}`;
          if (href) entry += `\n  URL: ${href.startsWith('http') ? href : (window.location.origin + (href.startsWith('/') ? '' : '/') + href)}`;
          if (imgSrc && imgSrc.startsWith('http')) entry += `\n  IMAGE: ${imgSrc}`;
          if (dateText) entry += `\n  DATE: ${dateText}`;
          if (desc) entry += `\n  DESC: ${desc}`;

          results.push(entry);
        });
      }

      // If no structured events found, fall back to text content
      if (results.length < 3) {
        const scripts = document.querySelectorAll("script, style, noscript");
        scripts.forEach((el) => el.remove());
        return document.body?.innerText || "";
      }

      return results.join('\n\n');
    });

    return content;
  } finally {
    await page.close();
  }
}

/**
 * Fetch page HTML using headless browser
 */
export async function fetchPageHtmlHeadless(
  url: string,
  options: {
    waitForSelector?: string;
    waitTime?: number;
    timeout?: number;
  } = {}
): Promise<string> {
  const { waitForSelector, waitTime = 3000, timeout = 30000 } = options;

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    await page.setViewport({ width: 1920, height: 1080 });

    // Hide webdriver property to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'it'],
      });
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout,
    });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {
        console.warn(`Selector "${waitForSelector}" not found, continuing...`);
      });
    }

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // Return full HTML
    return await page.content();
  } finally {
    await page.close();
  }
}
