import { supabase } from '@/lib/supabase';
import { EventWithStats } from '@/types/database';
import type { SortOption, TimeFilter, UserLocation, CustomDateRange } from '@/stores/eventsFilterStore';

export interface FetchEventsParams {
  search?: string;
  sortBy?: SortOption;
  timeFilter?: TimeFilter;
  categoryIds?: string[];
  limit?: number;
  offset?: number;
  /** Stable timestamp for "now" to prevent pagination drift */
  since?: string;
  userLocation?: UserLocation | null;
  customDateRange?: CustomDateRange | null;
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
    case 'custom':
    default:
      return null;
  }
}

/** Haversine formula -- returns distance in km between two lat/lng points */
function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchEvents({
  search = '',
  sortBy = 'date_asc',
  timeFilter = 'all',
  categoryIds = [],
  limit = 20,
  offset = 0,
  since,
  userLocation,
  customDateRange,
}: FetchEventsParams): Promise<FetchEventsResult> {
  // Use stable timestamp to prevent pagination drift
  const now = since ? new Date(since) : new Date();

  let query = supabase
    .from('events_with_stats')
    .select('*', { count: 'exact' })
    .eq('is_published', true);

  // Apply time filter
  if (timeFilter === 'custom' && customDateRange) {
    // Custom date range: user-selected start/end dates
    const startOfDay = new Date(customDateRange.startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(customDateRange.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    query = query
      .gte('event_start_time', startOfDay.toISOString())
      .lte('event_start_time', endOfDay.toISOString());
  } else {
    const dateRange = getDateRange(timeFilter);
    if (dateRange) {
      query = query
        .gte('event_start_time', dateRange.start.toISOString())
        .lt('event_start_time', dateRange.end.toISOString());
    } else {
      // For 'all', only show upcoming events (from now onwards)
      query = query.gte('event_start_time', now.toISOString());
    }
  }

  // Apply category filter
  if (categoryIds.length > 0) {
    query = query.in('category_id', categoryIds);
  }

  // Apply search filter (searches title, location, and category)
  if (search.trim()) {
    query = query.or(
      `title.ilike.%${search}%,location_name.ilike.%${search}%,location_address.ilike.%${search}%,category_name.ilike.%${search}%`
    );
  }

  // For nearby sort, fetch more rows then sort client-side by distance.
  // We can't do server-side distance ordering without a custom RPC, so we
  // fetch up to 500 candidate rows and reorder them here.
  const isNearbySortWithLocation = sortBy === 'nearby' && userLocation != null;

  if (isNearbySortWithLocation) {
    // Fetch all events that have coordinates so we can sort by distance
    query = query.not('location_lat', 'is', null).not('location_lng', 'is', null);
    query = query
      .order('event_start_time', { ascending: true })
      .order('id', { ascending: true });
    // Remove range for now -- we'll re-slice after client-side sort
  } else {
    // Apply server-side sorting
    switch (sortBy) {
      case 'date_asc':
        query = query
          .order('event_start_time', { ascending: true })
          .order('id', { ascending: true });
        break;
      case 'date_desc':
        query = query
          .order('event_start_time', { ascending: false })
          .order('id', { ascending: true });
        break;
      case 'popular':
        query = query
          .order('popularity_score', { ascending: false })
          .order('event_start_time', { ascending: true })
          .order('id', { ascending: true });
        break;
      case 'nearby':
        // No user location available -- fall back to date_asc
        query = query
          .order('event_start_time', { ascending: true })
          .order('id', { ascending: true });
        break;
    }
    // Apply pagination server-side
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching events:', error);
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  let events = (data as EventWithStats[]) ?? [];

  if (isNearbySortWithLocation && userLocation) {
    // Sort client-side by distance
    const { latitude: userLat, longitude: userLng } = userLocation;
    events = events.slice().sort((a, b) => {
      const distA =
        a.location_lat != null && a.location_lng != null
          ? haversineDistanceKm(userLat, userLng, a.location_lat, a.location_lng)
          : Infinity;
      const distB =
        b.location_lat != null && b.location_lng != null
          ? haversineDistanceKm(userLat, userLng, b.location_lat, b.location_lng)
          : Infinity;
      return distA - distB;
    });
    // Apply pagination after sort
    const total = events.length;
    events = events.slice(offset, offset + limit);
    return {
      events,
      total,
      hasMore: offset + events.length < total,
    };
  }

  const total = count ?? 0;

  return {
    events,
    total,
    hasMore: offset + events.length < total,
  };
}

export interface FetchEventsRAGParams {
  search: string;
  since?: string;
  limit?: number;
  threshold?: number;
}

/**
 * Semantic RAG search using the search-events edge function.
 * Generates an embedding for the query server-side and returns semantically
 * matching events sorted by similarity.
 */
export async function fetchEventsRAG({
  search,
  since,
  limit = 20,
  threshold = 0.4,
}: FetchEventsRAGParams): Promise<FetchEventsResult> {
  const { data, error } = await supabase.functions.invoke('search-events', {
    body: {
      query: search,
      since: since || new Date().toISOString(),
      limit,
      threshold,
    },
  });

  if (error) {
    console.error('RAG search error:', error);
    throw new Error(`RAG search failed: ${error.message}`);
  }

  const events = (data?.events ?? []) as EventWithStats[];
  return {
    events,
    total: events.length,
    hasMore: false, // RAG results are ranked by similarity, no pagination
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

/**
 * Fetches other dates for the same event series.
 * Matches by exact title + same organizer (if set) or same venue (fallback).
 * Only returns upcoming events, sorted by date ascending.
 */
export async function fetchRelatedEvents(
  title: string,
  organizerId: string | null,
  locationId: string | null,
  excludeId: string,
): Promise<EventWithStats[]> {
  const now = new Date().toISOString();

  let query = supabase
    .from('events_with_stats')
    .select('*')
    .eq('is_published', true)
    .ilike('title', title)
    .neq('id', excludeId)
    .gte('event_start_time', now)
    .order('event_start_time', { ascending: true })
    .limit(10);

  if (organizerId) {
    query = query.eq('organizer_id', organizerId);
  } else if (locationId) {
    query = query.eq('location_id', locationId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching related events:', error);
    return [];
  }

  return (data as EventWithStats[]) ?? [];
}
