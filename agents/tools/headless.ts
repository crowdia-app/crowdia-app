import puppeteer, { Browser } from "puppeteer";

let browser: Browser | null = null;

/**
 * Get or create a shared browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

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

    // Additional wait for JS to render
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // Extract text content
    const content = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());

      // Get text content
      return document.body?.innerText || "";
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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setViewport({ width: 1920, height: 1080 });

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
