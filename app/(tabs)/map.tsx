import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '@/components/events';
import { FilterDrawer } from '@/components/filters';
import { EventsMap } from '@/components/maps';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { Colors, Spacing, Typography, Magenta } from '@/constants/theme';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { useFilteredEventsForMap } from '@/hooks/useFilteredEvents';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

export default function MapScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { debouncedSearch, hasActiveFilters } = useEventsFilterStore();
  const [filterVisible, setFilterVisible] = useState(false);

  const { searchQuery, handleSearchChange } = useDebouncedSearch();

  const {
    eventsWithCoordinates,
    isLoading,
    isError,
    error,
    totalCount,
    mappableCount,
  } = useFilteredEventsForMap();

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

  const unmappableCount = totalCount - mappableCount;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          <GlowingLogo size={32} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Crowdia</Text>
        </View>
      </View>

      {/* Search + Filter Button */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchChange}
        placeholder="AI Search..."
        onFilterPress={() => setFilterVisible(true)}
        hasActiveFilters={hasActiveFilters()}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
      />

      {/* Map Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Magenta[500]} />
        </View>
      ) : eventsWithCoordinates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>
            {debouncedSearch ? '🔍' : '📍'}
          </Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {debouncedSearch ? 'No events found' : 'No events with location'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {debouncedSearch
              ? 'Try a different search term'
              : 'Check back later for new events'}
          </Text>
        </View>
      ) : (
        <EventsMap events={eventsWithCoordinates} />
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
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  statsText: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  statsTextMuted: {
    fontSize: Typography.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
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
