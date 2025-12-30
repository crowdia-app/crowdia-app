import OpenAI from "openai";
import { config } from "../config";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterKey,
  defaultHeaders: {
    "HTTP-Referer": "https://crowdia.app",
    "X-Title": "Crowdia Event Scout",
  },
});

export interface ExtractedEvent {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location_name?: string;
  location_address?: string;
  organizer_name?: string;
  ticket_url?: string;
  image_url?: string;
  detail_url: string;
  category?: string;
}

const eventSchema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          start_time: { type: "string", description: "ISO 8601 datetime" },
          end_time: { type: "string" },
          location_name: { type: "string" },
          location_address: { type: "string" },
          organizer_name: { type: "string" },
          ticket_url: { type: "string" },
          image_url: { type: "string" },
          detail_url: { type: "string" },
          category: { type: "string" },
        },
        required: ["title", "start_time", "detail_url"],
      },
    },
  },
  required: ["events"],
};

export async function extractEventsFromContent(
  content: string,
  sourceName: string,
  sourceUrl: string
): Promise<ExtractedEvent[]> {
  // Truncate if too long
  const maxLength = 100000;
  const truncatedContent =
    content.length > maxLength
      ? content.substring(0, maxLength) + "\n\n[Content truncated...]"
      : content;

  try {
    const response = await openrouter.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `You are an event extraction assistant. Extract upcoming events from the provided page content.

CRITICAL LOCATION FILTER:
- ONLY extract events physically located in Palermo, Sicily or the Palermo province (e.g., Monreale, Bagheria, Cefalù, Terrasini, Carini, etc.)
- REJECT any events in other Italian cities (Rome, Milan, Catania, etc.) or other countries
- If an event's location is unclear or outside Palermo province, DO NOT include it

EXTRACTION RULES:
- Extract as much information as possible for each event
- If a date doesn't have a year, assume it's the upcoming occurrence
- Convert dates to ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
- If no specific time is given, use 21:00 as default for evening events, 10:00 for morning events
- Only include events with clear dates (skip "coming soon" or TBA events)`,
        },
        {
          role: "user",
          content: `Extract all events from this page (source: ${sourceName}, URL: ${sourceUrl}):

${truncatedContent}

IMPORTANT: Respond ONLY with valid JSON matching this schema (no markdown, no explanation, just JSON):
${JSON.stringify(eventSchema, null, 2)}`,
        },
      ],
      max_tokens: 8192,
      temperature: 0.3,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) return [];

    // Parse JSON from response
    let jsonStr = responseContent.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    return parsed.events || [];
  } catch (error) {
    console.error("LLM extraction failed:", error);
    return [];
  }
}
