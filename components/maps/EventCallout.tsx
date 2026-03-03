import React from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { EventWithStats } from '@/types/database';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface EventCalloutProps {
  event: EventWithStats;
  onPress: () => void;
}

export function EventCallout({ event, onPress }: EventCalloutProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  // Events are always in Palermo (Europe/Rome) — display in local event time
  const EVENT_TIMEZONE = 'Europe/Rome';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return { day: '--', month: '---', time: '--:--' };
    const date = new Date(dateString);
    return {
      day: date.toLocaleDateString('en-US', { day: 'numeric', timeZone: EVENT_TIMEZONE }),
      month: date.toLocaleDateString('en-US', { month: 'short', timeZone: EVENT_TIMEZONE }).toUpperCase(),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: EVENT_TIMEZONE }),
    };
  };

  const dateInfo = formatDate(event.event_start_time);
  const imageUrl = getProxiedImageUrl(event.cover_image_url);
  const hasValidImage = !!imageUrl;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.card },
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={styles.imageContainer}>
        {hasValidImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={[Magenta[700], Magenta[500], Magenta[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.imagePlaceholder}
          >
            <StaticGlowLogo size={24} />
          </LinearGradient>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Date and time */}
        <View style={styles.dateRow}>
          <View style={[styles.dateBadge, { backgroundColor: Magenta[500] + '20' }]}>
            <Text style={[styles.dateText, { color: Magenta[500] }]}>
              {dateInfo.month} {dateInfo.day}
            </Text>
          </View>
          <Text style={[styles.time, { color: colors.textMuted }]}>{dateInfo.time}</Text>
        </View>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.location, { color: colors.textMuted }]} numberOfLines={1}>
            {event.location_name}
          </Text>
        </View>
      </View>

      {/* Arrow indicator */}
      <View style={styles.arrowContainer}>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const IMAGE_SIZE = 60;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: 280,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 5 },
      default: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)' },
    }),
  },
  containerPressed: {
    opacity: 0.9,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: Typography.sm,
    fontWeight: '600',
    lineHeight: Typography.sm * 1.2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  dateText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  time: {
    fontSize: Typography.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    fontSize: Typography.xs,
    flex: 1,
  },
  arrowContainer: {
    justifyContent: 'center',
    paddingRight: Spacing.xs,
  },
});
