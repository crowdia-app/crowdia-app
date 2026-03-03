import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { fetchEvents } from '@/services/events';

const ITEMS_PER_PAGE = 20;

/**
 * Hook for fetching filtered events with infinite scroll pagination.
 * Used by the list view.
 */
export function useFilteredEventsInfinite() {
  const {
    debouncedSearch,
    sortBy,
    timeFilter,
    categoryIds,
    since,
    userLocation,
    customDateRange,
  } = useEventsFilterStore();

  const queryKey = useMemo(
    () => [
      'events',
      debouncedSearch,
      sortBy,
      timeFilter,
      categoryIds,
      since,
      userLocation,
      customDateRange,
    ],
    [debouncedSearch, sortBy, timeFilter, categoryIds, since, userLocation, customDateRange]
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) =>
      fetchEvents({
        search: debouncedSearch,
        sortBy,
        timeFilter,
        categoryIds,
        limit: ITEMS_PER_PAGE,
        offset: pageParam,
        since,
        userLocation,
        customDateRange,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.events.length, 0);
      if (lastPage.hasMore) {
        return totalFetched;
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const events = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.events) ?? [];
  }, [query.data]);

  return {
    ...query,
    events,
  };
}

/**
 * Hook for fetching all filtered events (no pagination).
 * Used by the map view to show all markers at once.
 */
export function useFilteredEventsForMap() {
  const {
    debouncedSearch,
    sortBy,
    timeFilter,
    categoryIds,
    since,
    userLocation,
    customDateRange,
  } = useEventsFilterStore();

  const queryKey = useMemo(
    () => [
      'events-map',
      debouncedSearch,
      sortBy,
      timeFilter,
      categoryIds,
      since,
      userLocation,
      customDateRange,
    ],
    [debouncedSearch, sortBy, timeFilter, categoryIds, since, userLocation, customDateRange]
  );

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchEvents({
        search: debouncedSearch,
        sortBy,
        timeFilter,
        categoryIds,
        limit: 500, // Reasonable upper limit for map markers
        offset: 0,
        since,
        userLocation,
        customDateRange,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const events = query.data?.events ?? [];

  // Separate events with and without coordinates
  const eventsWithCoordinates = useMemo(
    () => events.filter((e) => e.location_lat != null && e.location_lng != null),
    [events]
  );

  const eventsWithoutCoordinates = useMemo(
    () => events.filter((e) => e.location_lat == null || e.location_lng == null),
    [events]
  );

  return {
    ...query,
    events,
    eventsWithCoordinates,
    eventsWithoutCoordinates,
    totalCount: events.length,
    mappableCount: eventsWithCoordinates.length,
  };
}
