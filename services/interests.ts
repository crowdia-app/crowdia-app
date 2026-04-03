import { supabase } from '@/lib/supabase';
import { EventWithStats } from '@/types/database';

export interface EventInterest {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string | null;
}

/** Fetch all event IDs the current user is interested in */
export async function fetchUserInterestIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_interests')
    .select('event_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching interest IDs:', error);
    throw new Error(`Failed to fetch interests: ${error.message}`);
  }

  return (data ?? []).map((row) => row.event_id);
}

/** Fetch full event details for the current user's interested events */
export async function fetchUserInterestedEvents(userId: string): Promise<EventWithStats[]> {
  // First get interest IDs
  const { data: interests, error: interestError } = await supabase
    .from('event_interests')
    .select('event_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (interestError) {
    console.error('Error fetching interests:', interestError);
    throw new Error(`Failed to fetch interests: ${interestError.message}`);
  }

  if (!interests || interests.length === 0) return [];

  const eventIds = interests.map((i) => i.event_id);

  const { data: events, error: eventsError } = await supabase
    .from('events_with_stats')
    .select('*')
    .in('id', eventIds)
    .abortSignal(AbortSignal.timeout(10000));

  if (eventsError) {
    console.error('Error fetching interested events:', eventsError);
    return [];
  }

  // Return in the same order as interests (most recently added first)
  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
  return eventIds.map((id) => eventMap.get(id)).filter(Boolean) as EventWithStats[];
}

/** Mark a user as interested in an event */
export async function addInterest(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('event_interests')
    .insert({ user_id: userId, event_id: eventId });

  // Ignore duplicate key errors (already interested)
  if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
    console.error('Error adding interest:', error);
    throw new Error(`Failed to add interest: ${error.message}`);
  }
}

/** Remove a user's interest in an event */
export async function removeInterest(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('event_interests')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error removing interest:', error);
    throw new Error(`Failed to remove interest: ${error.message}`);
  }
}
