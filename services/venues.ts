import { supabase } from '@/lib/supabase';
import type { Location, EventWithStats } from '@/types/database';

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

export async function fetchVenueEvents(venueId: string, limit = 20): Promise<EventWithStats[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events_with_stats')
    .select('*')
    .eq('location_id', venueId)
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
