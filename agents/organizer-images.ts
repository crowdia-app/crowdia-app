#!/usr/bin/env npx tsx
/**
 * Organizer Logo / Image AI Scraping Pipeline
 *
 * Design decisions (per ticket spec):
 *
 * (a) TRIGGER:
 *   - Manual: `npx tsx agents/organizer-images.ts --organizer-id=<uuid>`
 *   - Batch: `npx tsx agents/organizer-images.ts --batch` — runs over organizers
 *     with instagram_handle set but no logo_url (nightly, add to cron/scheduler).
 *   - Per-creation trigger: NOT done via a DB trigger here because we want human
 *     oversight on logo assignment. Instead, run the agent nightly and let it fill
 *     gaps. A supervisor (Matt) can kick off single-org runs manually.
 *
 * (b) FALLBACK:
 *   - Instagram scrape → Haiku picks best profile picture or post image as logo.
 *   - If Instagram scrape fails (no handle, Apify error, no usable images): try
 *     og:image from the website_url as a fallback logo.
 *   - If both fail: log and leave logo_url unchanged (null); the organizer will
 *     keep showing the generic placeholder icon in the app.
 *
 * Storage layout:
 *   organizer-images/
 *     logos/<organizer_id>.jpg      ← profile picture / picked logo
 *     heroes/<organizer_id>-1.jpg   ← hero photo candidates (2-3)
 *     heroes/<organizer_id>-2.jpg
 *     heroes/<organizer_id>-3.jpg
 *
 * Only logo_url is written to the organizers DB row for now (hero images are
 * uploaded but not persisted to a column — that column doesn't exist yet; add
 * to organizers table when the UI is ready to display them).
 */

import "dotenv/config";
import { getSupabase } from "./db";
import { scrapeInstagramProfile, type InstagramPost } from "./tools/apify";
import { config } from "./config";

const BUCKET = "organizer-images";
const MAX_CANDIDATE_POSTS = 12; // posts to fetch from Instagram
const HAIKU_MODEL = "anthropic/claude-haiku-4"; // cheapest, fast enough for image selection

// ---------------------------------------------------------------------------
// Image utilities
// ---------------------------------------------------------------------------

interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

async function downloadImageBuffer(url: string): Promise<DownloadedImage | null> {
  try {
    const domain = new URL(url).hostname;
    const isInstagram =
      domain.includes("instagram") ||
      domain.includes("cdninstagram") ||
      domain.includes("fbcdn");

    const headers: Record<string, string> = isInstagram
      ? {
          "User-Agent": "Instagram 219.0.0.12.117 Android",
          Accept: "image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.instagram.com/",
        }
      : {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/*,*/*;q=0.8",
          Referer: `https://${domain}/`,
        };

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return null; // skip tiny placeholders

    const extMatch = url.match(/\.(jpe?g|png|webp|gif)/i);
    let ext = extMatch ? extMatch[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
    if (ct.includes("png")) ext = "png";
    else if (ct.includes("webp")) ext = "webp";

    return { buffer, contentType: ct, ext };
  } catch {
    return null;
  }
}

async function uploadToStorage(
  buffer: Buffer,
  contentType: string,
  path: string
): Promise<string | null> {
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true, cacheControl: "31536000" });

  if (error) {
    console.error(`Storage upload failed for ${path}: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Haiku image selection
// ---------------------------------------------------------------------------

interface ImageCandidate {
  url: string;
  description: string; // e.g. "Instagram profile picture", "Post from 2026-05"
}

interface HaikuSelection {
  logo_index: number | null;       // index into candidates, or null if none suitable
  hero_indices: number[];           // up to 3 indices
  reasoning: string;
}

async function selectImagesWithHaiku(
  organizerName: string,
  bio: string,
  candidates: ImageCandidate[]
): Promise<HaikuSelection> {
  const prompt = `You are reviewing image candidates for an event organizer's profile.

Organizer: "${organizerName}"
Bio: "${bio || "N/A"}"

Candidates (index → description):
${candidates.map((c, i) => `${i}: ${c.description}`).join("\n")}

Task:
1. Pick the single best candidate as the LOGO (profile picture, clean brand image, or square avatar). If none is suitable as a logo, set logo_index to null.
2. Pick up to 3 candidates as HERO PHOTOS (event atmosphere, crowd, venue — not logos or ads). Return their indices as hero_indices array.

Prefer:
- Logo: profile picture > square logo > clean brand photo. Avoid busy event flyers.
- Heroes: atmosphere/crowd shots > venue shots. Avoid blurry/dark images.

Respond with ONLY valid JSON matching this schema:
{"logo_index": <number|null>, "hero_indices": [<number>, ...], "reasoning": "<brief reason>"}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://crowdia.ai",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Haiku response");

    const parsed = JSON.parse(jsonMatch[0]) as HaikuSelection;
    return parsed;
  } catch (err) {
    console.error("Haiku selection failed:", err);
    // Fallback: pick first candidate as logo
    return { logo_index: candidates.length > 0 ? 0 : null, hero_indices: [], reasoning: "fallback" };
  }
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

export interface OrganizerImageResult {
  organizerId: string;
  organizerName: string;
  logoUrl: string | null;
  heroUrls: string[];
  skipped: boolean;
  reason?: string;
}

export async function processOrganizerImages(
  organizerId: string
): Promise<OrganizerImageResult> {
  const supabase = getSupabase();

  // 1. Fetch organizer record
  const { data: org, error: fetchErr } = await supabase
    .from("organizers")
    .select("id, organization_name, instagram_handle, website_url, logo_url")
    .eq("id", organizerId)
    .single();

  if (fetchErr || !org) {
    return { organizerId, organizerName: "?", logoUrl: null, heroUrls: [], skipped: true, reason: "Organizer not found" };
  }

  const name = org.organization_name ?? "?";

  // Skip if already has a logo from our storage bucket
  if (org.logo_url?.includes("supabase.co/storage") && org.logo_url.includes(BUCKET)) {
    return { organizerId, organizerName: name, logoUrl: org.logo_url, heroUrls: [], skipped: true, reason: "Already has storage logo" };
  }

  let candidates: ImageCandidate[] = [];
  let bio = "";
  let profilePicUrl: string | null = null;
  let posts: InstagramPost[] = [];

  // 2a. Instagram scrape
  if (org.instagram_handle) {
    try {
      console.log(`  Scraping Instagram @${org.instagram_handle}...`);
      posts = await scrapeInstagramProfile(org.instagram_handle, MAX_CANDIDATE_POSTS);

      // Extract profile picture from first post metadata if available
      // Note: Apify posts may include a profile picture in the first item's ownerProfilePicUrl
      for (const post of posts) {
        const images = post.images ?? (post.displayUrl ? [post.displayUrl] : []);
        for (const imgUrl of images) {
          if (imgUrl) {
            candidates.push({
              url: imgUrl,
              description: `Instagram post (${post.timestamp?.slice(0, 7) ?? "unknown date"}) — ${(post.caption ?? "").slice(0, 80)}`,
            });
          }
        }
        if (!bio && post.caption) bio = post.caption.slice(0, 200);
      }

      // Check for profile picture in post owner metadata
      const firstPost = posts[0] as any;
      if (firstPost?.ownerProfilePicUrl) {
        profilePicUrl = String(firstPost.ownerProfilePicUrl);
        candidates.unshift({ url: profilePicUrl, description: "Instagram profile picture" });
      } else if (firstPost?.owner?.profilePicUrl) {
        profilePicUrl = String(firstPost.owner.profilePicUrl);
        candidates.unshift({ url: profilePicUrl, description: "Instagram profile picture" });
      }

      console.log(`  Found ${candidates.length} Instagram image candidates`);
    } catch (err) {
      console.warn(`  Instagram scrape failed for ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  // 2b. Website fallback for logo (og:image)
  if (org.website_url && candidates.length < 3) {
    try {
      console.log(`  Fetching og:image from ${org.website_url}...`);
      const res = await fetch(org.website_url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CrowdiaBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const html = await res.text();
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (ogMatch?.[1]) {
          candidates.push({ url: ogMatch[1], description: "Website og:image" });
        }
      }
    } catch {
      // Silently skip website fetch failures
    }
  }

  if (candidates.length === 0) {
    return { organizerId, organizerName: name, logoUrl: null, heroUrls: [], skipped: false, reason: "No image candidates found" };
  }

  // 3. Ask Haiku to pick best images
  console.log(`  Asking Claude Haiku to select from ${candidates.length} candidates...`);
  const selection = await selectImagesWithHaiku(name, bio, candidates);
  console.log(`  Haiku selection: logo=${selection.logo_index}, heroes=[${selection.hero_indices}], reason="${selection.reasoning}"`);

  // 4. Download and upload selected images
  let logoUrl: string | null = null;
  const heroUrls: string[] = [];

  if (selection.logo_index !== null && selection.logo_index < candidates.length) {
    const logoCandidate = candidates[selection.logo_index];
    console.log(`  Downloading logo from ${logoCandidate.url}`);
    const img = await downloadImageBuffer(logoCandidate.url);
    if (img) {
      const path = `logos/${organizerId}.${img.ext}`;
      const url = await uploadToStorage(img.buffer, img.contentType, path);
      if (url) logoUrl = url;
    }
  }

  for (const idx of selection.hero_indices.slice(0, 3)) {
    if (idx >= candidates.length) continue;
    const heroCandidate = candidates[idx];
    console.log(`  Downloading hero from ${heroCandidate.url}`);
    const img = await downloadImageBuffer(heroCandidate.url);
    if (img) {
      const heroNum = heroUrls.length + 1;
      const path = `heroes/${organizerId}-${heroNum}.${img.ext}`;
      const url = await uploadToStorage(img.buffer, img.contentType, path);
      if (url) heroUrls.push(url);
    }
  }

  // 5. Update organizer record with logo_url (only if we got one)
  if (logoUrl) {
    const { error: updateErr } = await supabase
      .from("organizers")
      .update({ logo_url: logoUrl })
      .eq("id", organizerId);

    if (updateErr) {
      console.error(`  Failed to update logo_url for ${organizerId}:`, updateErr.message);
    } else {
      console.log(`  Updated ${name} logo_url → ${logoUrl}`);
    }
  }

  return { organizerId, organizerName: name, logoUrl, heroUrls, skipped: false };
}

// ---------------------------------------------------------------------------
// Batch mode: process all organizers with instagram handle but no storage logo
// ---------------------------------------------------------------------------

export async function runOrganizerImagesBatch(limit = 50): Promise<void> {
  const supabase = getSupabase();

  const { data: orgs, error } = await supabase
    .from("organizers")
    .select("id, organization_name")
    .not("instagram_handle", "is", null)
    .or("logo_url.is.null,logo_url.not.ilike.%organizer-images%")
    .order("organization_name", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch organizers for batch:", error.message);
    return;
  }

  console.log(`Running organizer image pipeline on ${orgs?.length ?? 0} organizers`);

  for (const org of orgs ?? []) {
    console.log(`\nProcessing: ${org.organization_name} (${org.id})`);
    try {
      const result = await processOrganizerImages(org.id);
      if (result.skipped) {
        console.log(`  Skipped: ${result.reason}`);
      } else {
        console.log(`  Logo: ${result.logoUrl ?? "none"} | Heroes: ${result.heroUrls.length}`);
      }
    } catch (err) {
      console.error(`  Error processing ${org.id}:`, err instanceof Error ? err.message : err);
    }

    // Rate limit: 2s between orgs to avoid hammering Apify / OpenRouter
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx tsx agents/organizer-images.ts [options]

Options:
  --organizer-id=<uuid>   Process a single organizer by ID
  --batch                 Process all organizers with Instagram but no logo (default: 50)
  --limit=N               Batch size (default: 50)
  --help                  Show this help

Environment:
  APIFY_API_TOKEN         Required for Instagram scraping
  OPEN_ROUTER_API_KEY     Required for Haiku image selection
  SUPABASE_SERVICE_ROLE_KEY  Required for DB + storage access
`);
    process.exit(0);
  }

  const orgIdArg = args.find((a) => a.startsWith("--organizer-id="));
  const batchMode = args.includes("--batch");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;

  if (!config.apifyApiToken) {
    console.warn("APIFY_API_TOKEN not set — Instagram scraping will fail. Only website og:image fallback available.");
  }
  if (!config.openRouterKey) {
    console.error("OPEN_ROUTER_API_KEY not set — cannot run Haiku selection.");
    process.exit(1);
  }

  if (orgIdArg) {
    const organizerId = orgIdArg.split("=")[1];
    console.log(`Processing single organizer: ${organizerId}`);
    const result = await processOrganizerImages(organizerId);
    console.log("\nResult:", JSON.stringify(result, null, 2));
  } else if (batchMode) {
    await runOrganizerImagesBatch(limit);
  } else {
    console.error("Specify --organizer-id=<uuid> or --batch");
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
