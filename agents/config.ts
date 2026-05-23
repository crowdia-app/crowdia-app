import "dotenv/config";

export const config = {
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // OpenRouter (LLM)
  openRouterKey: process.env.OPEN_ROUTER_API_KEY!,
  model: process.env.OPENROUTER_MODEL || "xiaomi/mimo-v2-flash:free",

  // Brave Search
  braveKey: process.env.BRAVE_API_KEY!,

  // Google Maps
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY!,

  // Slack
  slackWebhook: process.env.SLACK_WEBHOOK_URL,

  // Apify (Instagram scraping)
  apifyApiToken: process.env.APIFY_API_TOKEN,

  // Agent settings
  maxEventsPerRun: 300,
  timeWindowDays: 14,
  rateLimitMs: 4000, // 4 seconds = 15 req/min, safely under OpenRouter's 20 req/min limit
  targetMetro: "Palermo",

  // Kill-switches for manual-curation mode (set env var to "true" to re-enable)
  autoCreateOrganizers: process.env.AUTO_CREATE_ORGANIZERS === "true", // default: false — paused per Mattia 2026-05-22
  autoDiscoverSources: process.env.AUTO_DISCOVER_SOURCES === "true",   // default: false — paused per Mattia 2026-05-22
};

export function validateConfig(): void {
  const required = [
    ["SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL", config.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceKey],
    ["OPEN_ROUTER_API_KEY", config.openRouterKey],
    ["BRAVE_API_KEY", config.braveKey],
    ["GOOGLE_MAPS_API_KEY", config.googleMapsKey],
  ];

  const missing = required.filter(([_, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach((name) => console.error(`  - ${name}`));
    process.exit(1);
  }
}
