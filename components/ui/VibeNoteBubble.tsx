import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing, Typography, Charcoal, Magenta } from '@/constants/theme';
import type { VibeNote } from '@/services/voices';

// Magenta quote accent — matches the Voice brand colour
const ACCENT = Magenta[500];
const ACCENT_BG_DARK = Magenta[500] + '14';
const ACCENT_BG_LIGHT = Magenta[500] + '0e';

interface VibeNoteBubbleProps {
  note: VibeNote;
}

export function VibeNoteBubble({ note }: VibeNoteBubbleProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';

  const cardBg = isDark ? Charcoal[700] : '#FFFFFF';
  const accentBg = isDark ? ACCENT_BG_DARK : ACCENT_BG_LIGHT;
  const textColor = isDark ? '#F0F0F0' : '#1A1A1A';
  const mutedColor = isDark ? '#9BA1A6' : '#687076';
  const borderColor = isDark ? Charcoal[500] : '#E8E8E8';

  const author = note.author;
  const displayName = author?.display_name || author?.username || 'Voice';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      {/* Quote mark + text */}
      <View style={[styles.quoteBar, { backgroundColor: accentBg }]}>
        <Ionicons name="chatbubble-ellipses" size={14} color={ACCENT} style={styles.quoteIcon} />
        <Text style={[styles.noteText, { color: textColor }]}>{note.text}</Text>
      </View>

      {/* Attribution */}
      <View style={styles.attribution}>
        {author?.profile_image_url ? (
          <Image
            source={{ uri: author.profile_image_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: ACCENT + '30' }]}>
            <Ionicons name="mic" size={10} color={ACCENT} />
          </View>
        )}
        <Text style={[styles.attributionText, { color: mutedColor }]}>
          {'Scelto da '}
          <Text style={[styles.attributionName, { color: ACCENT }]}>{displayName}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  quoteBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  quoteIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  noteText: {
    flex: 1,
    fontSize: Typography.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  attributionText: {
    fontSize: Typography.xs,
  },
  attributionName: {
    fontWeight: '600',
  },
});
