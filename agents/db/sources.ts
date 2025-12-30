import { getSupabase } from "./client";

export interface EventSource {
  type: "aggregator" | "location" | "organizer";
  id: string;
  name: string;
  url: string;
}

export async function getEventSources(): Promise<EventSource[]> {
  const sources: EventSource[] = [];

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

  // Get locations with event_sources
  const { data: locations } = await getSupabase()
    .from("locations")
    .select("id, name, website_url, event_sources")
    .not("event_sources", "is", null);

  locations?.forEach((l) => {
    const eventSources = l.event_sources as Record<string, string> | null;
    const url = eventSources ? Object.values(eventSources)[0] : l.website_url;
    if (url) {
      sources.push({ type: "location", id: l.id, name: l.name, url });
    }
  });

  // Get organizers with event_sources
  const { data: organizers } = await getSupabase()
    .from("organizers")
    .select("id, organization_name, website_url, event_sources")
    .not("event_sources", "is", null);

  organizers?.forEach((o) => {
    const eventSources = o.event_sources as Record<string, string> | null;
    const url = eventSources ? Object.values(eventSources)[0] : o.website_url;
    if (url) {
      sources.push({ type: "organizer", id: o.id, name: o.organization_name, url });
    }
  });

  return sources;
}
