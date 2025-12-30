import "dotenv/config";

export const config = {
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // OpenRouter (LLM)
  openRouterKey: process.env.OPEN_ROUTER_API_KEY!,
  model: "xiaomi/mimo-v2-flash:free",

  // Brave Search
  braveKey: process.env.BRAVE_API_KEY!,

  // Google Maps
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY!,

  // Slack
  slackWebhook: process.env.SLACK_WEBHOOK_URL,

  // Agent settings
  maxEventsPerRun: 100,
  timeWindowDays: 14,
  rateLimitMs: 2000,
  targetMetro: "Palermo",
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
