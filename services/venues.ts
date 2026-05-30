import { supabase } from '@/lib/supabase';
import type { Location, EventWithStats, Organizer } from '@/types/database';

export async function fetchVenueById(id: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching venue:', error);
    return null;
  }
  return data;
}

export type VenueCollaborator = { organizer: Organizer; eventCount: number };

export async function fetchVenueCollaborators(locationId: string, limit = 8): Promise<VenueCollaborator[]> {
  const { data: events } = await supabase
    .from('events_with_stats')
    .select('organizer_id')
    .eq('location_id', locationId)
    .eq('is_published', true)
    .not('organizer_id', 'is', null);

  if (!events?.length) return [];

  const counts: Record<string, number> = {};
  for (const e of events) {
    if (e.organizer_id) counts[e.organizer_id] = (counts[e.organizer_id] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const ids = sorted.map(([id]) => id);

  const { data: organizers } = await supabase
    .from('organizers')
    .select('*')
    .in('id', ids);

  if (!organizers) return [];

  return sorted
    .map(([id, count]) => {
      const org = organizers.find((o) => o.id === id);
      return org ? { organizer: org as Organizer, eventCount: count } : null;
    })
    .filter(Boolean) as VenueCollaborator[];
}

export async function fetchVenueEvents(locationId: string, limit = 20): Promise<EventWithStats[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events_with_stats')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_published', true)
    .gte('event_start_time', now)
    .order('event_start_time', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching venue events:', error);
    return [];
  }
  return (data ?? []) as EventWithStats[];
}

/**
 * Search venues/spaces by name or address.
 */
export async function searchVenues(query: string, limit = 8): Promise<Location[]> {
  if (!query.trim()) return [];
  const q = `%${query.trim()}%`;
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .or(`name.ilike.${q},address.ilike.${q}`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error searching venues:', error);
    return [];
  }
  return (data ?? []) as Location[];
}

/**
 * Fetch spaces (locations) owned/operated by an organizer (operator_org_id = organizerId).
 */
export async function fetchOrganizerSpaces(organizerId: string, limit = 10): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('operator_org_id', organizerId)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching organizer spaces:', error);
    return [];
  }
  return (data ?? []) as Location[];
}
