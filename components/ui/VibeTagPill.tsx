import React from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

// Lumio brand accent — violet to distinguish from Magenta category badges
const LUMIO_COLOR = '#9333EA';
const LUMIO_BG_DARK = '#9333EA18';
const LUMIO_BG_LIGHT = '#9333EA12';

interface VibeTagsRowProps {
  tags: string[] | null | undefined;
  maxTags?: number;
}

export function VibeTagsRow({ tags, maxTags = 3 }: VibeTagsRowProps) {
  const colorScheme = useColorScheme() ?? 'dark';

  if (!tags || tags.length === 0) return null;

  const visible = tags.slice(0, maxTags);
  const bg = colorScheme === 'dark' ? LUMIO_BG_DARK : LUMIO_BG_LIGHT;

  return (
    <View style={styles.row}>
      <Ionicons name="bulb-outline" size={10} color={LUMIO_COLOR} style={styles.lumioIcon} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visible.map((tag, idx) => (
          <View key={idx} style={[styles.pill, { backgroundColor: bg }]}>
            <Text style={[styles.pillText, { color: LUMIO_COLOR }]}>{tag}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lumioIcon: {
    flexShrink: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: Typography.xxs,
    fontWeight: '500',
  },
});
