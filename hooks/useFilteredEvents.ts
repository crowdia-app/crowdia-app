import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { fetchEvents, fetchEventsRAG } from '@/services/events';

const ITEMS_PER_PAGE = 20;

// Minimum query length to trigger semantic RAG search
const RAG_MIN_QUERY_LENGTH = 3;

/**
 * Hook for fetching filtered events with infinite scroll pagination.
 * Uses semantic RAG search when a query is provided (length >= 3),
 * falling back to keyword search for shorter queries or no query.
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

  const isRAGSearch = debouncedSearch.trim().length >= RAG_MIN_QUERY_LENGTH;

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
    queryFn: ({ pageParam = 0 }) => {
      if (isRAGSearch && pageParam === 0) {
        // Use semantic RAG search for first page when query is long enough
        return fetchEventsRAG({
          search: debouncedSearch,
          since,
          limit: ITEMS_PER_PAGE,
        }).catch(() =>
          // Fallback to keyword search if RAG fails (e.g. edge function not deployed yet)
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
          })
        );
      }
      return fetchEvents({
        search: debouncedSearch,
        sortBy,
        timeFilter,
        categoryIds,
        limit: ITEMS_PER_PAGE,
        offset: pageParam,
        since,
        userLocation,
        customDateRange,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // RAG results are a single ranked page with no further pagination
      if (isRAGSearch) return undefined;
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
    isRAGSearch,
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
