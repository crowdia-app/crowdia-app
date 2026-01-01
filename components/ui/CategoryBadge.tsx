import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

// Category to icon mapping
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'nightlife': 'moon',
  'concert': 'musical-notes',
  'party': 'sparkles',
  'theater': 'ticket',
  'comedy': 'happy',
  'art': 'color-palette',
  'food-wine': 'wine',
  'tour': 'walk',
  'festival': 'bonfire',
  'workshop': 'construct',
  'cultural': 'library',
  'sports': 'football',
  'family': 'people',
  'networking': 'chatbubbles',
  'film': 'film',
  'other': 'ellipse',
};

interface CategoryBadgeProps {
  categoryName: string | null;
  categorySlug?: string | null;
  size?: 'small' | 'medium';
}

export function CategoryBadge({ categoryName, categorySlug, size = 'small' }: CategoryBadgeProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  if (!categoryName) return null;

  // Get icon based on slug or fallback to 'other'
  const slug = categorySlug?.toLowerCase() || categoryName.toLowerCase().replace(/\s+/g, '-');
  const iconName = CATEGORY_ICONS[slug] || CATEGORY_ICONS['other'];

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        isSmall ? styles.badgeSmall : styles.badgeMedium,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <Ionicons
        name={iconName}
        size={isSmall ? 10 : 12}
        color={colors.textSecondary}
      />
      <Text
        style={[
          styles.text,
          isSmall ? styles.textSmall : styles.textMedium,
          { color: colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {categoryName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  badgeSmall: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    gap: 3,
  },
  badgeMedium: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 4,
  },
  text: {
    fontWeight: '500',
  },
  textSmall: {
    fontSize: Typography.xxs,
  },
  textMedium: {
    fontSize: Typography.xs,
  },
});
