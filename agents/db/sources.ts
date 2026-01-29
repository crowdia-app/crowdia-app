import { getSupabase } from "./client";

export interface EventSource {
  type: "aggregator" | "location" | "organizer" | "instagram";
  id: string;
  name: string;
  url: string;
  instagramHandle?: string; // Only for instagram type
}

export async function getEventSources(): Promise<EventSource[]> {
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
      });
    }
  });

  // Get aggregators
  const { data: aggregators } = await getSupabase()
    .from("event_aggregators")
    .select("id, name, events_url, base_url")
    .eq("is_active", true)
    .order("scrape_priority", { ascending: false });

  aggregators?.forEach((a) => {
    const url = a.events_url || a.base_url;
    if (url) {
      sources.push({ type: "aggregator", id: a.id, name: a.name, url });
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
      sources.push({ type: "location", id: l.id, name: l.name, url });
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
      sources.push({ type: "organizer", id: o.id, name: o.organization_name, url });
    }
  });

  return sources;
}
