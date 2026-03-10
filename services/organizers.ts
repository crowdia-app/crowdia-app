import { supabase } from '@/lib/supabase';
import type { Organizer, EventWithStats } from '@/types/database';

export async function fetchOrganizerById(id: string): Promise<Organizer | null> {
  const { data, error } = await supabase
    .from('organizers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching organizer:', error);
    return null;
  }
  return data;
}

export async function fetchOrganizerEvents(organizerId: string, limit = 20): Promise<EventWithStats[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events_with_stats')
    .select('*')
    .eq('organizer_id', organizerId)
    .eq('is_published', true)
    .gte('event_start_time', now)
    .order('event_start_time', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching organizer events:', error);
    return [];
  }
  return (data ?? []) as EventWithStats[];
}
