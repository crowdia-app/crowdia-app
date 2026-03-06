import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { useCategories } from '@/hooks/useCategories';

const TIME_FILTER_LABELS: Record<string, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'This Week',
  this_weekend: 'Weekend',
  custom: 'Custom Range',
};

const SORT_LABELS: Record<string, string> = {
  date_desc: 'Latest First',
  popular: 'Most Popular',
  nearby: 'Nearest First',
};

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Horizontal strip of dismissible chips summarising active filters.
 * Only renders when at least one non-default filter is applied.
 */
export function ActiveFiltersRow() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const {
    timeFilter,
    setTimeFilter,
    sortBy,
    setSortBy,
    categoryIds,
    toggleCategory,
    customDateRange,
    setCustomDateRange,
    resetFilters,
    hasActiveFilters,
  } = useEventsFilterStore();

  const { data: categories } = useCategories();

  if (!hasActiveFilters()) return null;

  const chips: Chip[] = [];

  // Time filter chip
  if (timeFilter !== 'all') {
    let label = TIME_FILTER_LABELS[timeFilter] ?? timeFilter;
    if (timeFilter === 'custom' && customDateRange) {
      const fmt = (d: string) =>
        new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      const start = fmt(customDateRange.startDate);
      const end = fmt(customDateRange.endDate);
      label = start === end ? start : `${start} – ${end}`;
    }
    chips.push({
      key: 'time',
      label,
      onRemove: () => {
        setTimeFilter('all');
        setCustomDateRange(null);
      },
    });
  }

  // Sort chip (only non-default sorts)
  if (sortBy !== 'date_asc') {
    chips.push({
      key: 'sort',
      label: SORT_LABELS[sortBy] ?? sortBy,
      onRemove: () => setSortBy('date_asc'),
    });
  }

  // Category chips
  if (categories) {
    for (const id of categoryIds) {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        chips.push({
          key: `cat-${id}`,
          label: cat.name,
          onRemove: () => toggleCategory(id),
        });
      }
    }
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: Magenta[500] + '20' },
              pressed && { opacity: 0.75 },
            ]}
            onPress={chip.onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${chip.label} filter`}
          >
            <Text style={[styles.chipText, { color: Magenta[500] }]}>{chip.label}</Text>
            <Ionicons name="close" size={12} color={Magenta[500]} />
          </Pressable>
        ))}

        {chips.length > 1 && (
          <Pressable
            style={({ pressed }) => [
              styles.clearChip,
              { borderColor: colors.divider },
              pressed && { opacity: 0.75 },
            ]}
            onPress={resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear all</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  clearChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  clearText: {
    fontSize: Typography.xs,
    fontWeight: '500',
  },
});
