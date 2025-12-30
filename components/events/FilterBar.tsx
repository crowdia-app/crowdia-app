import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Colors, Spacing, Typography, Magenta } from '@/constants/theme';

export type SortOption = 'date_asc' | 'date_desc' | 'popular' | 'nearby';
export type TimeFilter = 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_weekend';

interface FilterBarProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  timeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
}

const timeFilters: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_weekend', label: 'Weekend' },
];

export function FilterBar({
  sortBy,
  onSortChange,
  timeFilter,
  onTimeFilterChange,
}: FilterBarProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {timeFilters.map((filter) => {
          const isActive = timeFilter === filter.value;
          return (
            <Pressable
              key={filter.value}
              style={styles.tab}
              onPress={() => onTimeFilterChange(filter.value)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? Magenta[500] : colors.textSecondary },
                  isActive && styles.tabTextActive,
                ]}
              >
                {filter.label}
              </Text>
              {isActive && (
                <View style={[styles.activeIndicator, { backgroundColor: Magenta[500] }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  tab: {
    paddingVertical: Spacing.md,
    position: 'relative',
  },
  tabText: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
});
