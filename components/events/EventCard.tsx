import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { EventWithStats } from '@/types/database';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface EventCardProps {
  event: EventWithStats;
  onPress?: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  };

  const dateInfo = formatDate(event.event_start_time);
  const imageUrl = getProxiedImageUrl(event.cover_image_url);
  const hasValidImage = !!imageUrl;

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
          />
        ) : (
          <LinearGradient
            colors={[Magenta[700], Magenta[500], Magenta[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.imagePlaceholder}
          >
            <StaticGlowLogo size={40} />
          </LinearGradient>
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
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
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
}

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
    width: 100,
    height: 100,
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
