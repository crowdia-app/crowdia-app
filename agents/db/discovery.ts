import { getSupabase } from "./client";

/**
 * Extract @mentions from caption text
 */
export function extractMentions(caption: string): string[] {
  if (!caption) return [];
  const regex = /@([\w.]+)/g;
  const matches = [...caption.matchAll(regex)];
  // Return unique handles without the @
  const handles = matches.map(m => m[1].toLowerCase());
  return [...new Set(handles)];
}

/**
 * Extract #hashtags from caption text
 */
export function extractHashtags(caption: string): string[] {
  if (!caption) return [];
  const regex = /#([\w]+)/g;
  const matches = [...caption.matchAll(regex)];
  // Return unique hashtags without the #, lowercased
  const tags = matches.map(m => m[1].toLowerCase());
  return [...new Set(tags)];
}

/**
 * Update hashtag statistics
 */
export async function updateHashtagStats(
  hashtags: string[],
  sourceId: string
): Promise<void> {
  if (hashtags.length === 0) return;

  for (const tag of hashtags) {
    // Try to update existing hashtag
    const { data: existing } = await getSupabase()
      .from("hashtag_stats")
      .select("id, sources_using, occurrence_count")
      .eq("tag", tag)
      .single();

    if (existing) {
      // Update existing
      const sourcesUsing = existing.sources_using as string[] || [];
      if (!sourcesUsing.includes(sourceId)) {
        sourcesUsing.push(sourceId);
      }
      
      await getSupabase()
        .from("hashtag_stats")
        .update({
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
          sources_using: sourcesUsing,
        })
        .eq("id", existing.id);
    } else {
      // Insert new
      await getSupabase()
        .from("hashtag_stats")
        .insert({
          tag,
          occurrence_count: 1,
          sources_using: [sourceId],
        });
    }
  }
}

/**
 * Queue potential sources for discovery agent to process
 * Supports both Instagram handles and website URLs
 */
export async function queuePotentialSources(
  handles: string[],
  discoveredVia: {
    sourceId: string;
    method: "mention" | "collab_post" | "tagged_user" | "hashtag" | "website_crawl";
  }
): Promise<{ queued: number; updated: number }> {
  if (handles.length === 0) return { queued: 0, updated: 0 };

  let queued = 0;
  let updated = 0;

  for (const handle of handles) {
    // Normalize handle
    const normalizedHandle = handle.toLowerCase().replace(/^@/, "");
    
    // Skip very short handles (likely invalid)
    if (normalizedHandle.length < 2) continue;
    
    // Check if already exists
    const { data: existing } = await getSupabase()
      .from("potential_sources")
      .select("id, occurrence_count")
      .eq("handle", normalizedHandle)
      .eq("platform", "instagram")
      .single();

    if (existing) {
      // Update occurrence count
      await getSupabase()
        .from("potential_sources")
        .update({
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      updated++;
    } else {
      // Check if already an event source
      const { data: existingSource } = await getSupabase()
        .from("event_sources")
        .select("id")
        .eq("instagram_handle", normalizedHandle)
        .single();
      
      if (existingSource) {
        // Already tracked as a source, skip
        continue;
      }
      
      // Also check URL-based lookup
      const instagramUrl = `https://www.instagram.com/${normalizedHandle}/`;
      const { data: existingByUrl } = await getSupabase()
        .from("event_sources")
        .select("id")
        .eq("url", instagramUrl)
        .single();
      
      if (existingByUrl) {
        continue;
      }

      // Insert new potential source
      const { error } = await getSupabase()
        .from("potential_sources")
        .insert({
          handle: normalizedHandle,
          platform: "instagram",
          discovered_via_source_id: discoveredVia.sourceId,
          discovered_via_method: discoveredVia.method,
        });
      
      if (!error) {
        queued++;
      }
    }
  }

  return { queued, updated };
}

/**
 * Get top hashtags for discovery
 */
export async function getTopHashtags(limit: number = 20): Promise<{
  tag: string;
  occurrence_count: number;
  sources_using: string[];
}[]> {
  const { data, error } = await getSupabase()
    .from("hashtag_stats")
    .select("tag, occurrence_count, sources_using")
    .order("occurrence_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching top hashtags:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Get pending potential sources for validation
 */
export async function getPendingPotentialSources(limit: number = 10): Promise<{
  id: string;
  handle: string;
  platform: string;
  discovered_via_source_id: string | null;
  discovered_via_method: string;
  occurrence_count: number;
}[]> {
  const { data, error } = await getSupabase()
    .from("potential_sources")
    .select("id, handle, platform, discovered_via_source_id, discovered_via_method, occurrence_count")
    .eq("validation_status", "pending")
    .order("occurrence_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching pending sources:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Update potential source validation status
 */
export async function updatePotentialSourceStatus(
  id: string,
  status: "validated" | "rejected" | "skipped",
  score?: number,
  notes?: string
): Promise<void> {
  await getSupabase()
    .from("potential_sources")
    .update({
      validation_status: status,
      validation_score: score,
      validation_notes: notes,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

/**
 * Create a new event source with provenance
 */
export async function createEventSourceWithProvenance(
  data: {
    url: string;
    type: "instagram" | "website" | "facebook" | "ra" | "other";
    instagramHandle?: string;
    organizerId?: string;
    locationId?: string;
    discoveredViaSourceId?: string;
    discoveredViaMethod?: string;
    reliabilityScore?: number;
    enabled?: boolean;
  }
): Promise<string | null> {
  const { data: result, error } = await getSupabase()
    .from("event_sources")
    .insert({
      url: data.url,
      type: data.type,
      instagram_handle: data.instagramHandle,
      organizer_id: data.organizerId || null,
      location_id: data.locationId || null,
      is_aggregator: false,
      discovered_via_source_id: data.discoveredViaSourceId || null,
      discovered_via_method: data.discoveredViaMethod || null,
      discovered_at: new Date().toISOString(),
      auto_discovered: true,
      reliability_score: data.reliabilityScore || 50,
      enabled: data.enabled ?? false, // Default to disabled for manual review
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Duplicate URL, that's fine
      console.log(`Source already exists: ${data.url}`);
      return null;
    }
    console.error("Error creating event source:", error.message);
    return null;
  }

  return result?.id || null;
}

/**
 * Check if an Instagram handle is already tracked
 */
export async function isHandleTracked(handle: string): Promise<boolean> {
  const normalizedHandle = handle.toLowerCase().replace(/^@/, "");
  const instagramUrl = `https://www.instagram.com/${normalizedHandle}/`;
  
  // Check by instagram_handle column
  const { data: byHandle } = await getSupabase()
    .from("event_sources")
    .select("id")
    .eq("instagram_handle", normalizedHandle)
    .single();
  
  if (byHandle) return true;
  
  // Check by URL
  const { data: byUrl } = await getSupabase()
    .from("event_sources")
    .select("id")
    .eq("url", instagramUrl)
    .single();
  
  return !!byUrl;
}

/**
 * Queue website sources for discovery validation
 */
export async function queueWebsiteSources(
  sources: Array<{ url: string; name?: string; platform?: string }>,
  discoveredVia: {
    sourceId: string;
    method: "website_crawl" | "event_page";
  }
): Promise<{ queued: number; updated: number }> {
  if (sources.length === 0) return { queued: 0, updated: 0 };

  let queued = 0;
  let updated = 0;

  for (const source of sources) {
    try {
      const urlObj = new URL(source.url);
      const normalizedUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, "");
      const hostname = urlObj.hostname.replace("www.", "");

      // Check if already exists in potential_sources
      const { data: existing } = await getSupabase()
        .from("potential_sources")
        .select("id, occurrence_count")
        .eq("handle", normalizedUrl)
        .eq("platform", "website")
        .single();

      if (existing) {
        await getSupabase()
          .from("potential_sources")
          .update({
            occurrence_count: existing.occurrence_count + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        updated++;
        continue;
      }

      // Check if already an event source
      const { data: existingSource } = await getSupabase()
        .from("event_sources")
        .select("id")
        .eq("url", normalizedUrl)
        .single();

      if (existingSource) continue;

      // Also check base URL
      const { data: existingByBase } = await getSupabase()
        .from("event_sources")
        .select("id")
        .eq("url", urlObj.origin)
        .single();

      if (existingByBase) continue;

      // Insert new potential source
      const { error } = await getSupabase()
        .from("potential_sources")
        .insert({
          handle: normalizedUrl,
          platform: source.platform || "website",
          discovered_via_source_id: discoveredVia.sourceId,
          discovered_via_method: discoveredVia.method,
          metadata: { name: source.name, hostname },
        });

      if (!error) {
        queued++;
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  return { queued, updated };
}

/**
 * Get pending website sources for validation
 */
export async function getPendingWebsiteSources(limit: number = 10): Promise<{
  id: string;
  handle: string; // URL for websites
  platform: string;
  discovered_via_source_id: string | null;
  discovered_via_method: string;
  occurrence_count: number;
  metadata?: { name?: string; hostname?: string };
}[]> {
  const { data, error } = await getSupabase()
    .from("potential_sources")
    .select("id, handle, platform, discovered_via_source_id, discovered_via_method, occurrence_count, metadata")
    .eq("validation_status", "pending")
    .neq("platform", "instagram")
    .order("occurrence_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching pending website sources:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Queue organizer names for Instagram search
 */
export async function queueOrganizerNames(
  names: string[],
  discoveredVia: {
    sourceId: string;
    method: "website_crawl";
  }
): Promise<{ queued: number }> {
  if (names.length === 0) return { queued: 0 };

  let queued = 0;

  for (const name of names) {
    const normalizedName = name.toLowerCase().trim();
    if (normalizedName.length < 3) continue;

    // Check if already exists
    const { data: existing } = await getSupabase()
      .from("potential_sources")
      .select("id")
      .eq("handle", normalizedName)
      .eq("platform", "org_name")
      .single();

    if (existing) continue;

    const { error } = await getSupabase()
      .from("potential_sources")
      .insert({
        handle: normalizedName,
        platform: "org_name",
        discovered_via_source_id: discoveredVia.sourceId,
        discovered_via_method: discoveredVia.method,
        metadata: { original_name: name },
      });

    if (!error) {
      queued++;
    }
  }

  return { queued };
}
