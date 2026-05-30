import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { EventCard, SearchBar } from '@/components/events';
import { FilterDrawer, ActiveFiltersRow } from '@/components/filters';
import { EventsMap } from '@/components/maps';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { LoginPromptModal } from '@/components/ui/LoginPromptModal';
import { AskLumioFab } from '@/components/ui/AskLumioFab';
import { AskLumioModal } from '@/components/ui/AskLumioModal';
import { Colors, Spacing, Typography, Magenta, BorderRadius } from '@/constants/theme';
import { EventWithStats } from '@/types/database';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { useFilteredEventsInfinite, useFilteredEventsForMap } from '@/hooks/useFilteredEvents';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useInterestsStore } from '@/stores/interestsStore';
import { useAuthStore } from '@/stores/authStore';
import { useLoginPrompt } from '@/hooks/useLoginPrompt';
import { searchOrganizers } from '@/services/organizers';
import { searchVenues } from '@/services/venues';

type ViewMode = 'list' | 'map';

/** Horizontal row of organizer/venue profile chips shown when search is active */
function ProfileResultsRow({ query, onPressOrganizer, onPressVenue }: {
  query: string;
  onPressOrganizer: (id: string) => void;
  onPressVenue: (id: string) => void;
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const { data: organizers = [] } = useQuery({
    queryKey: ['search-organizers', query],
    queryFn: () => searchOrganizers(query, 6),
    enabled: query.trim().length >= 2,
    staleTime: 30000,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['search-venues', query],
    queryFn: () => searchVenues(query, 6),
    enabled: query.trim().length >= 2,
    staleTime: 30000,
  });

  if (query.trim().length < 2 || (organizers.length === 0 && venues.length === 0)) {
    return null;
  }

  return (
    <View style={profileStyles.container}>
      {organizers.length > 0 && (
        <View style={profileStyles.section}>
          <Text style={[profileStyles.sectionLabel, { color: colors.textMuted }]}>ORGANIZERS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={profileStyles.row}>
            {organizers.map((org) => (
              <Pressable
                key={org.id}
                style={({ pressed }) => [profileStyles.chip, { backgroundColor: colors.card }, pressed && { opacity: 0.7 }]}
                onPress={() => onPressOrganizer(org.id)}
              >
                {org.logo_url ? (
                  <Image source={{ uri: org.logo_url }} style={profileStyles.chipAvatar} />
                ) : (
                  <View style={[profileStyles.chipAvatar, { backgroundColor: Magenta[500] + '22', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="business-outline" size={14} color={Magenta[500]} />
                  </View>
                )}
                <Text style={[profileStyles.chipLabel, { color: colors.text }]} numberOfLines={1}>
                  {org.organization_name}
                </Text>
                {org.is_verified && (
                  <Ionicons name="checkmark-circle" size={12} color={Magenta[500]} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {venues.length > 0 && (
        <View style={profileStyles.section}>
          <Text style={[profileStyles.sectionLabel, { color: colors.textMuted }]}>SPACES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={profileStyles.row}>
            {venues.map((v) => (
              <Pressable
                key={v.id}
                style={({ pressed }) => [profileStyles.chip, { backgroundColor: colors.card }, pressed && { opacity: 0.7 }]}
                onPress={() => onPressVenue(v.id)}
              >
                <View style={[profileStyles.chipAvatar, { backgroundColor: Magenta[500] + '22', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="location-sharp" size={14} color={Magenta[500]} />
                </View>
                <Text style={[profileStyles.chipLabel, { color: colors.text }]} numberOfLines={1}>
                  {v.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const profileStyles = StyleSheet.create({
  container: { paddingBottom: Spacing.sm },
  section: { marginBottom: Spacing.xs },
  sectionLabel: {
    fontSize: Typography.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  row: { gap: Spacing.sm, paddingHorizontal: Spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    maxWidth: 180,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  chipLabel: {
    fontSize: Typography.sm,
    fontWeight: '500',
    maxWidth: 110,
  },
});

export default function EventsFeedScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { debouncedSearch, hasActiveFilters } = useEventsFilterStore();
  const { user } = useAuthStore();
  const { interestedEvents } = useInterestsStore();
  const savedCount = user ? interestedEvents.length : 0;
  const [filterVisible, setFilterVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const { visible: loginPromptVisible, dismiss: dismissLoginPrompt, show: showLoginPrompt } = useLoginPrompt();
  const [lumioVisible, setLumioVisible] = useState(false);

  const { searchQuery, handleSearchChange } = useDebouncedSearch();

  // List view data
  const {
    events,
    isLoading: isListLoading,
    isError: isListError,
    error: listError,
    refetch: refetchList,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRAGSearch,
  } = useFilteredEventsInfinite();

  // Map view data
  const {
    eventsWithCoordinates,
    isLoading: isMapLoading,
    isError: isMapError,
    error: mapError,
    refetch: refetchMap,
  } = useFilteredEventsForMap();

  const isLoading = viewMode === 'list' ? isListLoading : isMapLoading;
  const isError = viewMode === 'list' ? isListError : isMapError;
  const error = viewMode === 'list' ? listError : mapError;

  const handleEventPress = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router]
  );

  const renderEvent = useCallback(
    ({ item }: { item: EventWithStats }) => (
      <EventCard event={item} onPress={() => handleEventPress(item.id!)} onRequireLogin={showLoginPrompt} />
    ),
    [handleEventPress, showLoginPrompt]
  );

  const keyExtractor = useCallback((item: EventWithStats) => item.id!, []);

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
        <Text style={styles.emptyEmoji}>{debouncedSearch ? '🔍' : '📅'}</Text>
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

  const MapEmptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>{debouncedSearch ? '🔍' : '📍'}</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {debouncedSearch ? 'No events found' : 'No events with location'}
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Crowdia</Text>
          {/* Saved events button */}
          <Pressable
            style={styles.savedButton}
            onPress={() => router.push('/(tabs)/saved')}
            accessibilityLabel="Saved events"
            accessibilityRole="button"
          >
            <Ionicons name="heart" size={24} color={Magenta[500]} />
            {savedCount > 0 && (
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>
                  {savedCount > 99 ? '99+' : savedCount}
                </Text>
              </View>
            )}
          </Pressable>
          {/* View toggle */}
          <View style={[styles.viewToggle, { backgroundColor: colors.inputBackground }]}>
            <Pressable
              style={[
                styles.toggleButton,
                viewMode === 'list' && { backgroundColor: Magenta[500] },
              ]}
              onPress={() => setViewMode('list')}
              accessibilityLabel="List view"
              accessibilityRole="button"
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? '#FFFFFF' : colors.textMuted}
              />
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                viewMode === 'map' && { backgroundColor: Magenta[500] },
              ]}
              onPress={() => setViewMode('map')}
              accessibilityLabel="Map view"
              accessibilityRole="button"
            >
              <Ionicons
                name="map"
                size={18}
                color={viewMode === 'map' ? '#FFFFFF' : colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Search + Filter Button */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchChange}
        placeholder="AI Search..."
        onFilterPress={() => setFilterVisible(true)}
        hasActiveFilters={hasActiveFilters()}
        isRAGSearch={isRAGSearch}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
      />

      {/* Active filter chips */}
      <ActiveFiltersRow />

      {/* Profile search results (organizers + venues) — shown when search is active */}
      {searchQuery.trim().length >= 2 && (
        <ProfileResultsRow
          query={searchQuery}
          onPressOrganizer={(id) => router.push(`/organizer/${id}`)}
          onPressVenue={(id) => router.push(`/venue/${id}`)}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Magenta[500]} />
        </View>
      ) : viewMode === 'list' ? (
        <FlashList
          data={events}
          renderItem={renderEvent}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetchList}
              tintColor={Magenta[500]}
              colors={[Magenta[500]]}
            />
          }
          ListEmptyComponent={EmptyState}
          ListFooterComponent={ListFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
        />
      ) : eventsWithCoordinates.length === 0 ? (
        MapEmptyState
      ) : (
        <EventsMap events={eventsWithCoordinates} />
      )}

      {/* Login prompt for unauthenticated users */}
      <LoginPromptModal visible={loginPromptVisible} onDismiss={dismissLoginPrompt} />

      {/* Lumio AI assistant */}
      <AskLumioFab onPress={() => setLumioVisible(true)} />
      <AskLumioModal visible={lumioVisible} onClose={() => setLumioVisible(false)} />
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
    flex: 1,
  },
  savedButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Magenta[500],
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  savedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 2,
  },
  toggleButton: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
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
