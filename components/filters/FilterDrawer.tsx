import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Magenta,
  Charcoal,
} from '@/constants/theme';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import type { TimeFilter, SortOption } from '@/stores/eventsFilterStore';
import { useCategories } from '@/hooks/useCategories';
import { useUserLocation } from '@/hooks/useUserLocation';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'nightlife': 'moon',
  'concert': 'musical-notes',
  'party': 'sparkles',
  'theater': 'ticket',
  'comedy': 'happy',
  'art': 'color-palette',
  'food-wine': 'wine',
  'food-drink': 'restaurant',
  'tour': 'walk',
  'festival': 'bonfire',
  'workshop': 'construct',
  'cultural': 'library',
  'sports': 'football',
  'sports-fitness': 'fitness',
  'family': 'people',
  'networking': 'chatbubbles',
  'film': 'film',
  'music': 'musical-notes',
  'art-culture': 'color-palette',
  'education': 'school',
  'community': 'heart',
  'other': 'ellipse',
};

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_weekend', label: 'Weekend' },
  { value: 'custom', label: 'Custom Range' },
];

const SORT_OPTIONS: { value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'date_asc', label: 'Soonest First', icon: 'arrow-up' },
  { value: 'date_desc', label: 'Latest First', icon: 'arrow-down' },
  { value: 'popular', label: 'Most Popular', icon: 'flame' },
  { value: 'nearby', label: 'Nearest First', icon: 'location' },
];

/** Simple date input for web, numeric text for native */
function DateInput({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  minDate?: string;
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  // Format display string: "MMM D, YYYY"
  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Select date';

  if (Platform.OS === 'web') {
    return (
      <View style={dateInputStyles.container}>
        <Text style={[dateInputStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[dateInputStyles.field, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <input
            type="date"
            value={value}
            min={minDate}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: value ? colors.text : colors.textMuted,
              fontSize: Typography.sm,
              fontFamily: 'inherit',
              marginLeft: Spacing.sm,
            }}
          />
        </View>
      </View>
    );
  }

  // Native: show a pressable that cycles through dates (simplified)
  // In a production app you'd use @react-native-community/datetimepicker here.
  // For now we render a read-only display with increment/decrement buttons.
  return (
    <View style={dateInputStyles.container}>
      <Text style={[dateInputStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[dateInputStyles.field, { backgroundColor: colors.inputBackground }]}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
        <Pressable
          onPress={() => {
            const current = value ? new Date(value + 'T00:00:00') : new Date();
            current.setDate(current.getDate() - 1);
            if (!minDate || current.toISOString().slice(0, 10) >= minDate) {
              onChange(current.toISOString().slice(0, 10));
            }
          }}
          hitSlop={8}
          style={dateInputStyles.arrowBtn}
        >
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
        </Pressable>
        <Text style={[dateInputStyles.valueText, { color: value ? colors.text : colors.textMuted }]}>
          {displayValue}
        </Text>
        <Pressable
          onPress={() => {
            const current = value ? new Date(value + 'T00:00:00') : new Date();
            current.setDate(current.getDate() + 1);
            onChange(current.toISOString().slice(0, 10));
          }}
          hitSlop={8}
          style={dateInputStyles.arrowBtn}
        >
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const dateInputStyles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: '500',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  arrowBtn: {
    padding: Spacing.xs,
  },
  valueText: {
    flex: 1,
    fontSize: Typography.sm,
    textAlign: 'center',
  },
});

interface FilterDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function FilterDrawer({ visible, onClose }: FilterDrawerProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const panelHeight = screenHeight * 0.75;
  const translateY = useSharedValue(panelHeight);
  const backdropOpacity = useSharedValue(0);

  const {
    timeFilter,
    setTimeFilter,
    sortBy,
    setSortBy,
    categoryIds,
    toggleCategory,
    resetFilters,
    hasActiveFilters,
    customDateRange,
    setCustomDateRange,
  } = useEventsFilterStore();

  const { data: categories } = useCategories();
  const { status: locationStatus, requestLocation, clearLocation, hasLocation } = useUserLocation();

  // Local state for the custom date range while editing
  const today = new Date().toISOString().slice(0, 10);
  const [localStart, setLocalStart] = useState(customDateRange?.startDate ?? today);
  const [localEnd, setLocalEnd] = useState(customDateRange?.endDate ?? today);

  // Sync local state from store when drawer opens
  useEffect(() => {
    if (visible && customDateRange) {
      setLocalStart(customDateRange.startDate);
      setLocalEnd(customDateRange.endDate);
    } else if (visible) {
      setLocalStart(today);
      setLocalEnd(today);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    // Commit custom date range when closing if time filter is 'custom'
    if (timeFilter === 'custom') {
      const start = localStart || today;
      const end = localEnd && localEnd >= start ? localEnd : start;
      setCustomDateRange({ startDate: start, endDate: end });
    }

    translateY.value = withTiming(panelHeight, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
    backdropOpacity.value = withTiming(0, { duration: 250 });
  }, [timeFilter, localStart, localEnd, panelHeight, onClose, setCustomDateRange, today]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleSortPress = useCallback(async (value: SortOption) => {
    if (value === 'nearby' && !hasLocation) {
      await requestLocation();
    }
    if (value !== 'nearby' && hasLocation) {
      clearLocation();
    }
    setSortBy(value);
  }, [hasLocation, requestLocation, clearLocation, setSortBy]);

  const handleTimeFilterPress = useCallback((value: TimeFilter) => {
    setTimeFilter(value);
    if (value !== 'custom') {
      setCustomDateRange(null);
    }
  }, [setTimeFilter, setCustomDateRange]);

  const handleStartChange = useCallback((val: string) => {
    setLocalStart(val);
    // If end is before new start, reset end
    if (localEnd && val > localEnd) {
      setLocalEnd(val);
    }
  }, [localEnd]);

  const handleEndChange = useCallback((val: string) => {
    setLocalEnd(val);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            {
              height: panelHeight,
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + Spacing.md,
            },
            panelStyle,
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Filters</Text>
            {hasActiveFilters() && (
              <Pressable
                onPress={resetFilters}
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.resetText, { color: Magenta[500] }]}>Reset</Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* When section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                When
              </Text>
              <View style={styles.chipRow}>
                {TIME_FILTERS.map((filter) => {
                  const isActive = timeFilter === filter.value;
                  return (
                    <Pressable
                      key={filter.value}
                      onPress={() => handleTimeFilterPress(filter.value)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: isActive
                            ? Magenta[500]
                            : colors.inputBackground,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      {filter.value === 'custom' && (
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color={isActive ? '#fff' : colors.textSecondary}
                        />
                      )}
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isActive ? '#fff' : colors.textSecondary,
                          },
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom date range pickers */}
              {timeFilter === 'custom' && (
                <View style={[styles.dateRangeContainer, { backgroundColor: colors.inputBackground + '60' }]}>
                  <DateInput
                    label="From"
                    value={localStart}
                    onChange={handleStartChange}
                    minDate={today}
                  />
                  <View style={[styles.dateDivider, { backgroundColor: colors.divider }]} />
                  <DateInput
                    label="To"
                    value={localEnd}
                    onChange={handleEndChange}
                    minDate={localStart || today}
                  />
                </View>
              )}
            </View>

            {/* Sort By section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Sort By
              </Text>
              <View style={styles.radioList}>
                {SORT_OPTIONS.map((option) => {
                  const isActive = sortBy === option.value;
                  const isNearby = option.value === 'nearby';
                  const showLocationBadge = isNearby && hasLocation;
                  const showRequestingBadge = isNearby && locationStatus === 'requesting';
                  const showDeniedBadge = isNearby && locationStatus === 'denied';
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => handleSortPress(option.value)}
                      style={({ pressed }) => [
                        styles.radioRow,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          {
                            borderColor: isActive
                              ? Magenta[500]
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {isActive && <View style={styles.radioInner} />}
                      </View>
                      <Ionicons
                        name={option.icon}
                        size={14}
                        color={isActive ? Magenta[500] : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.radioLabel,
                          { color: isActive ? colors.text : colors.textSecondary },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {showLocationBadge && (
                        <View style={[styles.locationBadge, { backgroundColor: Magenta[500] + '20' }]}>
                          <Ionicons name="checkmark-circle" size={12} color={Magenta[500]} />
                          <Text style={[styles.locationBadgeText, { color: Magenta[500] }]}>
                            Location on
                          </Text>
                        </View>
                      )}
                      {showRequestingBadge && (
                        <Text style={[styles.locationHint, { color: colors.textMuted }]}>
                          Requesting...
                        </Text>
                      )}
                      {showDeniedBadge && (
                        <Text style={[styles.locationHint, { color: colors.error }]}>
                          Permission denied
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Category section */}
            {categories && categories.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Category
                </Text>
                <View style={styles.chipGrid}>
                  {categories.map((cat) => {
                    const isActive = categoryIds.includes(cat.id);
                    const slug = cat.slug?.toLowerCase() ?? 'other';
                    const iconName =
                      CATEGORY_ICONS[slug] || CATEGORY_ICONS['other'];
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => toggleCategory(cat.id)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: isActive
                              ? Magenta[500]
                              : colors.inputBackground,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Ionicons
                          name={iconName}
                          size={14}
                          color={isActive ? '#fff' : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isActive ? '#fff' : colors.textSecondary,
                            },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  resetText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  dateRangeContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  dateDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
  radioList: {
    gap: Spacing.md,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Magenta[500],
  },
  radioLabel: {
    fontSize: Typography.sm,
    fontWeight: '500',
    flex: 1,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  locationBadgeText: {
    fontSize: Typography.xs,
    fontWeight: '500',
  },
  locationHint: {
    fontSize: Typography.xs,
  },
});
