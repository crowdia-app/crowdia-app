import { getSupabase } from "./client";

export interface EventSource {
  type: "aggregator" | "location" | "organizer" | "instagram" | "website" | "facebook" | "ra" | "other";
  id: string;
  name: string;
  url: string;
  instagramHandle?: string; // Only for instagram type
  organizerId?: string;
  locationId?: string;
  reliabilityScore?: number;
}

/**
 * Check if the new event_sources table exists
 */
async function useNewSchema(): Promise<boolean> {
  const { error } = await getSupabase()
    .from("event_sources")
    .select("id")
    .limit(1);
  return !error;
}

/**
 * Get event sources - supports both new normalized table and legacy schema
 */
export async function getEventSources(): Promise<EventSource[]> {
  // Try new schema first
  if (await useNewSchema()) {
    return getEventSourcesNewSchema();
  }
  
  // Fall back to legacy schema
  return getEventSourcesLegacy();
}

/**
 * New schema: Get sources from event_sources table
 */
async function getEventSourcesNewSchema(): Promise<EventSource[]> {
  const sources: EventSource[] = [];
  
  // Get all enabled sources from the normalized table
  const { data: eventSources, error } = await getSupabase()
    .from("event_sources")
    .select(`
      id,
      url,
      type,
      organizer_id,
      location_id,
      is_aggregator,
      reliability_score,
      instagram_handle,
      organizers:organizer_id (id, organization_name, instagram_handle),
      locations:location_id (id, name)
    `)
    .eq("enabled", true)
    .order("reliability_score", { ascending: false });
  
  if (error) {
    console.error("Error fetching event_sources:", error.message);
    return getEventSourcesLegacy();
  }
  
  eventSources?.forEach((s: any) => {
    const orgName = s.organizers?.organization_name;
    const locName = s.locations?.name;
    // Use instagram_handle from event_sources first, fall back to organizer's handle
    const instagramHandle = s.type === 'instagram' && (s.instagram_handle || s.organizers?.instagram_handle);
    
    // Determine the source type for extraction
    let sourceType: EventSource['type'];
    if (s.is_aggregator) {
      sourceType = 'aggregator';
    } else if (s.location_id && !s.organizer_id) {
      sourceType = 'location';
    } else if (s.organizer_id) {
      sourceType = s.type === 'instagram' ? 'instagram' : 'organizer';
    } else {
      sourceType = s.type as EventSource['type'];
    }
    
    sources.push({
      type: sourceType,
      id: s.id,
      name: orgName || locName || extractNameFromUrl(s.url),
      url: s.url,
      instagramHandle: instagramHandle || undefined,
      organizerId: s.organizer_id,
      locationId: s.location_id,
      reliabilityScore: s.reliability_score,
    });
  });
  
  // Sort: Instagram first, then by reliability score
  return sources.sort((a, b) => {
    if (a.type === 'instagram' && b.type !== 'instagram') return -1;
    if (a.type !== 'instagram' && b.type === 'instagram') return 1;
    return (b.reliabilityScore || 50) - (a.reliabilityScore || 50);
  });
}

/**
 * Legacy schema: Get sources from multiple tables
 */
async function getEventSourcesLegacy(): Promise<EventSource[]> {
  const sources: EventSource[] = [];

  // INSTAGRAM SOURCES FIRST - these are often the primary source for promoters
  // and were getting skipped when processed last due to 300-event limit
  const { data: instagramOrganizers } = await getSupabase()
    .from("organizers")
    .select("id, organization_name, instagram_handle")
    .not("instagram_handle", "is", null)
    .neq("instagram_handle", "");

  instagramOrganizers?.forEach((o) => {
    if (o.instagram_handle) {
      const handle = o.instagram_handle.replace(/^@/, "");
      sources.push({
        type: "instagram",
        id: o.id,
        name: o.organization_name,
        url: `https://www.instagram.com/${handle}/`,
        instagramHandle: o.instagram_handle,
        organizerId: o.id,
      });
    }
  });

  // Get aggregators
  const { data: aggregators } = await getSupabase()
    .from("event_aggregators")
    .select("id, name, events_url, base_url, scrape_priority")
    .eq("is_active", true)
    .order("scrape_priority", { ascending: false });

  aggregators?.forEach((a) => {
    const url = a.events_url || a.base_url;
    if (url) {
      sources.push({ 
        type: "aggregator", 
        id: a.id, 
        name: a.name, 
        url,
        reliabilityScore: a.scrape_priority,
      });
    }
  });

  // Get locations with event_sources (non-empty objects only)
  const { data: locations } = await getSupabase()
    .from("locations")
    .select("id, name, website_url, event_sources")
    .not("event_sources", "is", null)
    .neq("event_sources", "{}");

  locations?.forEach((l) => {
    const eventSources = l.event_sources as Record<string, string> | null;
    const url = eventSources && Object.keys(eventSources).length > 0
      ? Object.values(eventSources)[0]
      : null;
    if (url) {
      sources.push({ 
        type: "location", 
        id: l.id, 
        name: l.name, 
        url,
        locationId: l.id,
      });
    }
  });

  // Get organizers with event_sources (non-empty objects only)
  const { data: organizers } = await getSupabase()
    .from("organizers")
    .select("id, organization_name, website_url, event_sources")
    .not("event_sources", "is", null)
    .neq("event_sources", "{}");

  organizers?.forEach((o) => {
    const eventSources = o.event_sources as Record<string, string> | null;
    const url = eventSources && Object.keys(eventSources).length > 0
      ? Object.values(eventSources)[0]
      : null;
    if (url) {
      sources.push({ 
        type: "organizer", 
        id: o.id, 
        name: o.organization_name, 
        url,
        organizerId: o.id,
      });
    }
  });

  return sources;
}

/**
 * Extract a readable name from a URL
 */
function extractNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0]
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "Unknown Source";
  }
}

/**
 * Create an event mention (provenance tracking)
 * Only works with new schema
 */
export async function createEventMention(
  eventId: string,
  sourceId: string,
  rawData?: any,
  confidenceScore?: number
): Promise<boolean> {
  // Check if event_mentions table exists
  const { error: checkError } = await getSupabase()
    .from("event_mentions")
    .select("id")
    .limit(1);
  
  if (checkError) {
    // Table doesn't exist, skip silently
    return false;
  }
  
  const { error } = await getSupabase()
    .from("event_mentions")
    .upsert({
      event_id: eventId,
      source_id: sourceId,
      raw_data: rawData,
      confidence_score: confidenceScore,
      found_at: new Date().toISOString(),
    }, { onConflict: 'event_id,source_id' });
  
  if (error && !error.message.includes('duplicate')) {
    console.error("Error creating event mention:", error.message);
    return false;
  }
  
  return true;
}

/**
 * Update last_scraped_at for a source
 * Only works with new schema
 */
export async function updateSourceLastScraped(sourceId: string): Promise<void> {
  const { error: checkError } = await getSupabase()
    .from("event_sources")
    .select("id")
    .limit(1);
  
  if (checkError) return; // Table doesn't exist
  
  await getSupabase()
    .from("event_sources")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", sourceId);
}
