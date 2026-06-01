#!/usr/bin/env npx tsx
/**
 * compute-voice-badges.ts
 *
 * Computes the Asymmetric Impact Matrix for each approved Voice:
 *   - voice_badges:         gamified labels (public)
 *   - momentum_text:        activity indicator text (public)
 *   - urban_impact_count:   Saves + Check-ins across all attended events (private)
 *   - people_moved_count:   interested_count on upcoming events (private velocity)
 *
 * Run standalone: npx tsx agents/compute-voice-badges.ts
 * Called from:   agents/index.ts after the extraction cycle (weekly)
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

// ─── Badge derivation helpers ─────────────────────────────────────────────────

const GENRE_KEYWORDS: Array<[string, string]> = [
  ["techno", "Techno"],
  ["tech_house", "Tech House"],
  ["deep_house", "Deep House"],
  ["house", "House"],
  ["electronic", "Electronic"],
  ["elettronica", "Elettronica"],
  ["jazz", "Jazz"],
  ["disco", "Disco"],
  ["hip_hop", "Hip Hop"],
  ["hiphop", "Hip Hop"],
  ["soul", "Soul"],
  ["reggae", "Reggae"],
  ["punk", "Punk"],
  ["metal", "Metal"],
  ["indie", "Indie"],
  ["afrobeat", "Afrobeat"],
  ["psych", "Psychedelic"],
  ["drum_and_bass", "Drum & Bass"],
  ["dnb", "Drum & Bass"],
  ["ambient", "Ambient"],
];

function deriveGenreBadge(tags: string[]): string | null {
  for (const tag of tags) {
    const lower = tag.toLowerCase().replace(/[^a-z_]/g, "");
    for (const [keyword, label] of GENRE_KEYWORDS) {
      if (lower.includes(keyword)) {
        return `${label} Specialist`;
      }
    }
  }
  return null;
}

function computeBadges(
  eventCount: number,
  lateEventRatio: number,
  tags: string[]
): string[] {
  const badges: string[] = [];

  if (eventCount >= 10) {
    badges.push("Top Curator");
  }

  const genreBadge = deriveGenreBadge(tags);
  if (genreBadge) {
    badges.push(genreBadge);
  }

  if (eventCount >= 5) {
    badges.push("Palermo Trendsetter");
  }

  if (eventCount >= 3 && lateEventRatio >= 0.6) {
    badges.push("Night Owl");
  }

  return badges;
}

function computeMomentumText(
  recentCount: number,
  weekCount: number,
  upcomingCount: number
): string | null {
  if (weekCount >= 2) return "⚡ Trending questa settimana";
  if (recentCount >= 3) return "🔥 In forte crescita questo mese";
  if (upcomingCount > 0) return "🌙 In arrivo questo weekend";
  if (recentCount >= 1) return "✨ Attivo questo mese";
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function computeVoiceBadges(): Promise<{ updated: number; total: number }> {
  console.log("[voice-badges] Starting badge computation...");

  const { data: voices, error } = await supabase
    .from("voice_requests")
    .select("id, user_id, taste_tags")
    .eq("status", "approved");

  if (error || !voices?.length) {
    console.log("[voice-badges] No approved voices:", error?.message ?? "none found");
    return { updated: 0, total: 0 };
  }

  let updated = 0;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const voice of voices) {
    try {
      // Fetch event IDs this voice attended
      const { data: veRows } = await supabase
        .from("voice_events")
        .select("event_id")
        .eq("user_id", voice.user_id);

      const eventIds = (veRows ?? []).map((r: any) => r.event_id as string);

      if (eventIds.length === 0) {
        await supabase
          .from("voice_requests")
          .update({
            voice_badges: [],
            urban_impact_count: 0,
            people_moved_count: 0,
            momentum_text: null,
            badges_computed_at: now.toISOString(),
          })
          .eq("id", voice.id);
        updated++;
        continue;
      }

      // Fetch event stats in batches of 100 (Supabase IN limit)
      const batches: any[] = [];
      for (let i = 0; i < eventIds.length; i += 100) {
        const { data } = await supabase
          .from("events_with_stats")
          .select("id, event_start_time, interested_count, check_ins_count")
          .in("id", eventIds.slice(i, i + 100));
        if (data) batches.push(...data);
      }
      const events = batches;

      // Aggregate stats
      let urbanImpact = 0;
      let peopleMoved = 0;
      let recentCount = 0;
      let weekCount = 0;
      let upcomingCount = 0;
      let lateCount = 0;

      for (const ev of events) {
        const startTime = ev.event_start_time ? new Date(ev.event_start_time) : null;
        const interested = ev.interested_count ?? 0;
        const checkIns = ev.check_ins_count ?? 0;

        urbanImpact += interested + checkIns;

        if (startTime) {
          const isPast = startTime <= now;
          const isUpcoming = startTime > now && startTime <= sevenDaysLater;

          if (isPast) {
            if (startTime >= thirtyDaysAgo) recentCount++;
            if (startTime >= sevenDaysAgo) weekCount++;
            const hour = startTime.getHours();
            if (hour >= 21 || hour < 4) lateCount++;
          }

          if (isUpcoming) {
            upcomingCount++;
            peopleMoved += interested;
          }
        }
      }

      const lateRatio = events.length > 0 ? lateCount / events.length : 0;
      const tags: string[] = Array.isArray(voice.taste_tags) ? voice.taste_tags : [];

      const voiceBadges = computeBadges(events.length, lateRatio, tags);
      const momentumText = computeMomentumText(recentCount, weekCount, upcomingCount);

      const { error: updateErr } = await supabase
        .from("voice_requests")
        .update({
          voice_badges: voiceBadges,
          urban_impact_count: urbanImpact,
          people_moved_count: peopleMoved,
          momentum_text: momentumText,
          badges_computed_at: now.toISOString(),
        })
        .eq("id", voice.id);

      if (updateErr) {
        console.warn(`[voice-badges] Update failed for ${voice.user_id}:`, updateErr.message);
      } else {
        updated++;
        if (voiceBadges.length > 0) {
          console.log(`  ✓ ${voice.user_id} → [${voiceBadges.join(", ")}] | impact=${urbanImpact} moved=${peopleMoved}`);
        }
      }
    } catch (err: any) {
      console.warn(`[voice-badges] Error for ${voice.user_id}:`, err?.message ?? err);
    }
  }

  console.log(`[voice-badges] Done: ${updated}/${voices.length} updated.`);
  return { updated, total: voices.length };
}

// Standalone run guard
if (process.argv[1]?.endsWith("compute-voice-badges.ts")) {
  computeVoiceBadges()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
