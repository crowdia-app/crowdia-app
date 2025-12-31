import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  EventCard,
  SearchBar,
  FilterBar,
  type SortOption,
  type TimeFilter,
} from '@/components/events';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { fetchEvents } from '@/services/events';
import { Colors, Spacing, Typography, Magenta } from '@/constants/theme';
import { EventWithStats } from '@/types/database';

const ITEMS_PER_PAGE = 20;

export default function EventsFeedScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_asc');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Stable timestamp for pagination - prevents duplicate fetches
  const [since, setSince] = useState(() => new Date().toISOString());

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  // Reset stable timestamp when filters change
  useEffect(() => {
    setSince(new Date().toISOString());
  }, [debouncedSearch, sortBy, timeFilter]);

  const queryKey = useMemo(
    () => ['events', debouncedSearch, sortBy, timeFilter, since],
    [debouncedSearch, sortBy, timeFilter, since]
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) =>
      fetchEvents({
        search: debouncedSearch,
        sortBy,
        timeFilter,
        limit: ITEMS_PER_PAGE,
        offset: pageParam,
        since,
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
    return data?.pages.flatMap((page) => page.events) ?? [];
  }, [data]);

  const handleEventPress = useCallback(
    (event: EventWithStats) => {
      router.push(`/event/${event.id}`);
    },
    [router]
  );

  const renderEvent = useCallback(
    ({ item }: { item: EventWithStats }) => (
      <EventCard event={item} onPress={() => handleEventPress(item)} />
    ),
    [handleEventPress]
  );

  const keyExtractor = useCallback((item: EventWithStats) => item.id, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ListFooter = useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Magenta[500]} />
      </View>
    );
  }, [isFetchingNextPage]);

  const EmptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>
          {debouncedSearch ? '🔍' : '📅'}
        </Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {debouncedSearch ? 'No events found' : 'No upcoming events'}
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {debouncedSearch
            ? 'Try a different search term'
            : 'Check back later for new events'}
        </Text>
      </View>
    ),
    [debouncedSearch, colors]
  );

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Text style={styles.emptyEmoji}>😕</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Something went wrong
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {error instanceof Error ? error.message : 'Failed to load events'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          <GlowingLogo size={32} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Crowdia
          </Text>
        </View>
      </View>

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchChange}
        placeholder="Search events..."
      />

      {/* Filter Tabs */}
      <FilterBar
        sortBy={sortBy}
        onSortChange={setSortBy}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
      />

      {/* Events List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Magenta[500]} />
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            events.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor={Magenta[500]}
              colors={[Magenta[500]]}
            />
          }
          ListEmptyComponent={EmptyState}
          ListFooterComponent={ListFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.sm,
    textAlign: 'center',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
});
