import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EventWithStats } from '@/types/database';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { CategoryImagePlaceholder } from '@/components/ui/CategoryImagePlaceholder';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { useInterestsStore } from '@/stores/interestsStore';
import { useAuthStore } from '@/stores/authStore';

interface EventCardProps {
  event: EventWithStats;
  onPress?: () => void;
  onRequireLogin?: () => void;
}

// Events are always in Palermo (Europe/Rome) — display in local event time
// so the date/time shown matches what attendees see on posters and tickets.
const EVENT_TIMEZONE = 'Europe/Rome';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    day: parseInt(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: EVENT_TIMEZONE }), 10),
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: EVENT_TIMEZONE }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: EVENT_TIMEZONE }),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: EVENT_TIMEZONE }),
  };
};

export const EventCard = memo(function EventCard({ event, onPress, onRequireLogin }: EventCardProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const { user } = useAuthStore();
  const { isInterested, toggleInterest } = useInterestsStore();
  const interested = isInterested(event.id!);

  const dateInfo = formatDate(event.event_start_time ?? new Date().toISOString());
  const imageUrl = getProxiedImageUrl(event.cover_image_url);
  const [imageError, setImageError] = useState(false);
  const hasValidImage = !!imageUrl && !imageError;

  const handleHeartPress = useCallback(() => {
    if (!user) {
      onRequireLogin?.();
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleInterest(user.id, event.id!, event);
  }, [user, event.id, toggleInterest, onRequireLogin]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Left: Image or Gradient Placeholder */}
      <View style={styles.imageContainer}>
        {hasValidImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />
        ) : (
          <CategoryImagePlaceholder
            categorySlug={event.category_slug}
            style={styles.imagePlaceholder}
            iconSize={36}
          />
        )}
      </View>

      {/* Right: Content */}
      <View style={styles.content}>
        {/* Date Badge */}
        <View style={styles.dateRow}>
          <View style={[styles.dateBadge, { backgroundColor: Magenta[500] + '20' }]}>
            <Text style={[styles.dateDay, { color: Magenta[500] }]}>{dateInfo.day}</Text>
            <Text style={[styles.dateMonth, { color: Magenta[500] }]}>{dateInfo.month}</Text>
          </View>
          <View style={styles.timeInfo}>
            <Text style={[styles.weekday, { color: colors.textSecondary }]}>
              {dateInfo.weekday}
            </Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {dateInfo.time}
            </Text>
          </View>
          {/* Heart button -- always visible; prompts login when tapped unauthenticated */}
          <Pressable
            style={({ pressed }) => [
              styles.heartButton,
              pressed && styles.heartButtonPressed,
            ]}
            onPress={handleHeartPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={interested ? 'heart' : 'heart-outline'}
              size={20}
              color={interested ? Magenta[500] : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {event.title}
        </Text>

        {/* Location and Category Row */}
        <View style={styles.metaRow}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.location, { color: colors.textMuted }]} numberOfLines={1}>
              {event.location_name}
            </Text>
          </View>
          <CategoryBadge
            categoryName={event.category_name}
            categorySlug={event.category_slug}
            size="small"
          />
        </View>
      </View>
    </Pressable>
  );
});

const IMAGE_SIZE = 100;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.8,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    minHeight: IMAGE_SIZE,
    alignSelf: 'stretch',
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
    padding: Spacing.md,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timeInfo: {
    flex: 1,
  },
  weekday: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  time: {
    fontSize: Typography.xs,
  },
  heartButton: {
    padding: Spacing.xs,
  },
  heartButtonPressed: {
    opacity: 0.6,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: '600',
    lineHeight: Typography.base * 1.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  location: {
    fontSize: Typography.xs,
    flex: 1,
  },
});
