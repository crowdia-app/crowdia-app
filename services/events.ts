import { supabase } from '@/lib/supabase';
import { EventWithStats } from '@/types/database';
import type { SortOption, TimeFilter } from '@/components/events/FilterBar';

export interface FetchEventsParams {
  search?: string;
  sortBy?: SortOption;
  timeFilter?: TimeFilter;
  limit?: number;
  offset?: number;
}

export interface FetchEventsResult {
  events: EventWithStats[];
  total: number;
  hasMore: boolean;
}

function getDateRange(timeFilter: TimeFilter): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (timeFilter) {
    case 'today': {
      const endOfDay = new Date(today);
      endOfDay.setDate(endOfDay.getDate() + 1);
      return { start: now, end: endOfDay };
    }
    case 'tomorrow': {
      const startOfTomorrow = new Date(today);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const endOfTomorrow = new Date(startOfTomorrow);
      endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
      return { start: startOfTomorrow, end: endOfTomorrow };
    }
    case 'this_week': {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      return { start: now, end: endOfWeek };
    }
    case 'this_weekend': {
      const dayOfWeek = today.getDay();
      const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek;
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + daysUntilSaturday);
      const monday = new Date(saturday);
      monday.setDate(monday.getDate() + 2);
      return { start: saturday, end: monday };
    }
    case 'all':
    default:
      return null;
  }
}

export async function fetchEvents({
  search = '',
  sortBy = 'date_asc',
  timeFilter = 'all',
  limit = 20,
  offset = 0,
}: FetchEventsParams): Promise<FetchEventsResult> {
  let query = supabase
    .from('events_with_stats')
    .select('*', { count: 'exact' })
    .eq('is_published', true);

  // Apply time filter
  const dateRange = getDateRange(timeFilter);
  if (dateRange) {
    query = query
      .gte('event_start_time', dateRange.start.toISOString())
      .lt('event_start_time', dateRange.end.toISOString());
  } else {
    // For 'all', only show upcoming events (from now onwards)
    query = query.gte('event_start_time', new Date().toISOString());
  }

  // Apply search filter (contrived local search for now)
  if (search.trim()) {
    // Using ilike for case-insensitive search on title and location
    query = query.or(
      `title.ilike.%${search}%,location_name.ilike.%${search}%,location_address.ilike.%${search}%`
    );
  }

  // Apply sorting
  switch (sortBy) {
    case 'date_asc':
      query = query.order('event_start_time', { ascending: true });
      break;
    case 'date_desc':
      query = query.order('event_start_time', { ascending: false });
      break;
    case 'popular':
      query = query
        .order('interested_count', { ascending: false })
        .order('event_start_time', { ascending: true });
      break;
    case 'nearby':
      // For now, just sort by date. Location-based sorting can be added later
      query = query.order('event_start_time', { ascending: true });
      break;
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching events:', error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const total = count ?? 0;
  const events = (data as EventWithStats[]) ?? [];

  return {
    events,
    total,
    hasMore: offset + events.length < total,
  };
}

export async function fetchEventById(eventId: string): Promise<EventWithStats | null> {
  const { data, error } = await supabase
    .from('events_with_stats')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return null;
  }

  return data as EventWithStats;
}
