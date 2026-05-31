/**
 * Generate AI Taste Tags for Voice profiles that don't have them yet.
 * Uses OpenRouter (claude-haiku-4-5) to produce 4-6 Italian snake_case tags
 * per voice — music genres, vibes, scenes, cultural references.
 *
 * Run standalone: npx tsx agents/generate-voice-taste-tags.ts
 * Or import generateVoiceTasteTags() to call from other agents (weekly cron).
 *
 * Safe to re-run: only processes voices where taste_tags IS NULL or = '{}'.
 *
 * Requires migration 20260531000000_voice_profile_fields.sql to be applied.
 */

import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { config, validateConfig } from "./config";

const TASTE_MODEL = "anthropic/claude-haiku-4-5";
const DELAY_MS = 1500;
const MAX_TAGS = 6;
const MIN_TAGS = 4;
const MAX_PAST_EVENTS = 5;

const BANNED_TAGS = new Set([
  "musica", "music", "evento", "event", "serata", "notte", "night",
  "palermo", "sicilia", "sicily", "italia", "italy", "festa", "party",
  "club", "bar", "live",
]);

interface VoiceRow {
  user_id: string;
  voice_request_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  spotify_url: string | null;
  soundcloud_url: string | null;
  taste_tags: string[] | null;
}

function buildTastePrompt(voice: VoiceRow, eventTitles: string[]): string {
  const lines: string[] = [];

  const name = voice.display_name || voice.username || "Voice";
  lines.push(`Profilo Voice: ${name}`);

  if (voice.bio) {
    lines.push(`Bio: ${voice.bio.slice(0, 400)}`);
  }

  const socials: string[] = [];
  if (voice.instagram_handle) socials.push(`Instagram: @${voice.instagram_handle}`);
  if (voice.tiktok_handle) socials.push(`TikTok: @${voice.tiktok_handle}`);
  if (voice.spotify_url) socials.push(`Spotify: ${voice.spotify_url.slice(0, 80)}`);
  if (voice.soundcloud_url) socials.push(`SoundCloud: ${voice.soundcloud_url.slice(0, 80)}`);
  if (socials.length > 0) {
    lines.push(`Social: ${socials.join(" | ")}`);
  }

  if (eventTitles.length > 0) {
    lines.push(`Ultimi eventi frequentati: ${eventTitles.join(", ")}`);
  }

  const profile = lines.join("\n");

  return `Sei un esperto di cultura notturna e lifestyle urbano a Palermo.

Dato il profilo di un "Voice" (tastemaker/influencer culturale), genera esattamente ${MIN_TAGS}-${MAX_TAGS} taste tag semantici in italiano che catturano la sua estetica e il suo universo culturale.

Regole:
- Tag in snake_case (es. deep_house, aperitivo_chic, palermitano_doc, vinile_only, indie_sleaze, tramonto_sul_mare)
- ${MIN_TAGS}-${MAX_TAGS} tag, niente di più
- Specifici ed evocativi: generi musicali, scene sociali, riferimenti culturali, vibes estetiche
- EVITA termini generici come: musica, evento, serata, notte, palermo, sicilia, festa, club, bar, live
- I tag devono distinguere questo Voice dagli altri — cattura il suo gusto specifico

${profile}

Rispondi SOLO con un array JSON di stringhe. Esempio:
["deep_house", "aperitivo_chic", "palermitano_doc", "vinile_only"]`;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) =>
      t
        .toLowerCase()
        .trim()
        .replace(/[#"' ]/g, "_")
        .replace(/__+/g, "_")
        .replace(/^_|_$/g, "")
    )
    .filter((t) => t.length >= 3 && t.length <= 50)
    .filter((t) => !BANNED_TAGS.has(t));

  return [...new Set(tags)].slice(0, MAX_TAGS);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate AI Taste Tags for all Voice profiles that don't have them yet.
 * Returns counts of processed and failed voices.
 */
export async function generateVoiceTasteTags(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.openRouterKey,
    defaultHeaders: {
      "HTTP-Referer": "https://crowdia.app",
      "X-Title": "Crowdia Voice Taste Tag Generator",
    },
  });

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  console.log("🎤 Fetching Voice profiles without taste tags...");

  // Query the voices view for profiles where taste_tags is null or empty
  const { data: voices, error } = await supabase
    .from("voices" as any)
    .select(
      "user_id, voice_request_id, username, display_name, bio, instagram_handle, tiktok_handle, spotify_url, soundcloud_url, taste_tags"
    )
    .or("taste_tags.is.null,taste_tags.eq.{}");

  if (error) {
    console.error("Failed to fetch voices:", error);
    throw error;
  }

  if (!voices || voices.length === 0) {
    console.log("✅ All Voice profiles already have taste tags!");
    return { processed: 0, failed: 0, skipped: 0 };
  }

  console.log(`📊 Voices to tag: ${voices.length}`);

  let processed = 0;
  let failed = 0;

  for (const voiceRaw of voices as VoiceRow[]) {
    const name = voiceRaw.display_name || voiceRaw.username || voiceRaw.user_id;

    // Fetch top 5 past events this voice attended
    let eventTitles: string[] = [];
    try {
      const { data: voiceEvents } = await supabase
        .from("voice_events")
        .select("event:event_id(title, event_start_time)")
        .eq("user_id", voiceRaw.user_id)
        .order("created_at", { ascending: false })
        .limit(MAX_PAST_EVENTS);

      if (voiceEvents && voiceEvents.length > 0) {
        eventTitles = (voiceEvents as any[])
          .map((ve: any) => ve.event?.title)
          .filter(Boolean);
      }
    } catch {
      // Non-fatal: continue without event context
    }

    const prompt = buildTastePrompt(voiceRaw, eventTitles);

    let tags: string[] = [];
    try {
      const completion = await openrouter.chat.completions.create({
        model: TASTE_MODEL,
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error(`No JSON array in response: ${raw.slice(0, 200)}`);
      }
      const parsed = JSON.parse(jsonMatch[0]);
      tags = sanitizeTags(parsed);
    } catch (err) {
      console.error(
        `  ❌ LLM error for "${name}":`,
        err instanceof Error ? err.message : err
      );
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    if (tags.length < MIN_TAGS) {
      console.warn(
        `  ⚠️  Too few tags for "${name}" (got ${tags.length}), skipping`
      );
      failed++;
      continue;
    }

    // Write tags back to voice_requests (the view is read-only)
    const { error: updateError } = await supabase
      .from("voice_requests")
      .update({ taste_tags: tags })
      .eq("id", voiceRaw.voice_request_id);

    if (updateError) {
      console.warn(`  ❌ Failed to update "${name}": ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✓ "${name}" → [${tags.join(", ")}]`);
      processed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done! Processed: ${processed}, Failed: ${failed}`);
  return { processed, failed, skipped: 0 };
}

// Standalone entrypoint
const isMain = process.argv[1]?.endsWith("generate-voice-taste-tags.ts");
if (isMain) {
  validateConfig();
  generateVoiceTasteTags().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
