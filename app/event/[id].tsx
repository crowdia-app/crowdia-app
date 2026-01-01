import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Linking,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { fetchEventById } from '@/services/events';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { MapSection } from '@/components/maps/MapSection';

const HERO_HEIGHT = 320;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id!),
    enabled: !!id,
  });

  const imageUrl = getProxiedImageUrl(event?.cover_image_url);
  const hasValidImage = !!imageUrl;

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      date: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    };
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleShare = async () => {
    if (!event) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await Share.share({
        title: event.title,
        message: `Check out ${event.title} on Crowdia!\n\n${event.event_url || ''}`,
        url: event.event_url || undefined,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleGetTickets = () => {
    if (!event?.external_ticket_url) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Linking.openURL(event.external_ticket_url);
  };

  const handleOpenMaps = () => {
    if (!event?.location_lat || !event?.location_lng) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // On web, open Google Maps
    if (Platform.OS === 'web') {
      const url = `https://www.google.com/maps/search/?api=1&query=${event.location_lat},${event.location_lng}`;
      window.open(url, '_blank');
      return;
    }

    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    const url = Platform.select({
      ios: `${scheme}?q=${event.location_name}&ll=${event.location_lat},${event.location_lng}`,
      android: `${scheme}${event.location_lat},${event.location_lng}?q=${event.location_name}`,
    });

    if (url) Linking.openURL(url);
  };

  // Header button component (simpler than BlurView for web compatibility)
  const HeaderButton = ({ onPress, icon, size = 24 }: { onPress: () => void; icon: string; size?: number }) => (
    <Pressable
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.headerButtonPressed
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={size} color="#fff" />
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <StaticGlowLogo size={60} />
        </View>
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <HeaderButton onPress={handleBack} icon="arrow-back" />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>:/</Text>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Event not found</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This event may have been removed or is no longer available.
          </Text>
        </View>
      </View>
    );
  }

  const dateInfo = formatFullDate(event.event_start_time);
  const hasLocation = event.location_lat && event.location_lng;


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Hero Image Section */}
        <View style={styles.heroContainer}>
          {hasValidImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <LinearGradient
              colors={[Magenta[700], Magenta[500], Magenta[400]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroImage}
            >
              <StaticGlowLogo size={80} />
            </LinearGradient>
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', colorScheme === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)']}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.heroGradient}
          />

          {/* Header Buttons */}
          <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
            <HeaderButton onPress={handleShare} icon="share-outline" size={22} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {/* Date Badge and Category */}
          <View style={styles.badgeRow}>
            <View style={[styles.dateBadge, { backgroundColor: Magenta[500] }]}>
              <Text style={styles.dateBadgeDay}>{dateInfo.day}</Text>
              <Text style={styles.dateBadgeMonth}>{dateInfo.month}</Text>
            </View>
            <CategoryBadge
              categoryName={event.category_name}
              categorySlug={event.category_slug}
              size="medium"
            />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {event.title}
          </Text>

          {/* Date & Time Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                <Ionicons name="calendar-outline" size={20} color={Magenta[500]} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  {dateInfo.weekday}, {dateInfo.date}
                </Text>
                <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]}>
                  {dateInfo.time}
                  {event.event_end_time && (
                    ` - ${formatFullDate(event.event_end_time).time}`
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Location Info */}
          <Pressable
            style={[styles.infoCard, { backgroundColor: colors.card }]}
            onPress={handleOpenMaps}
          >
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                <Ionicons name="location-outline" size={20} color={Magenta[500]} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  {event.location_name}
                </Text>
                {event.location_address && (
                  <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {event.location_address}
                  </Text>
                )}
              </View>
              {hasLocation && (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              )}
            </View>
          </Pressable>

          {/* Description */}
          {event.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {event.description}
              </Text>
            </View>
          )}

          {/* Map */}
          {hasLocation && (
            <MapSection
              latitude={event.location_lat!}
              longitude={event.location_lng!}
              locationName={event.location_name}
              colorScheme={colorScheme}
              onPress={handleOpenMaps}
            />
          )}

          {/* Stats */}
          {(event.interested_count > 0 || event.check_ins_count > 0) && (
            <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
              {event.interested_count > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="heart" size={18} color={Magenta[500]} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {event.interested_count}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    interested
                  </Text>
                </View>
              )}
              {event.check_ins_count > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {event.check_ins_count}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    going
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Source */}
          {event.source && (
            <View style={styles.sourceContainer}>
              <Text style={[styles.sourceText, { color: colors.textMuted }]}>
                Source: {event.source}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[
        styles.actionBar,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + Spacing.md,
          borderTopColor: colors.divider,
        }
      ]}>
        <Pressable
          style={({ pressed }) => [
            styles.interestedButton,
            { borderColor: Magenta[500] },
            pressed && styles.buttonPressed
          ]}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            // TODO: Implement interested functionality
          }}
        >
          <Ionicons name="heart-outline" size={20} color={Magenta[500]} />
          <Text style={[styles.interestedButtonText, { color: Magenta[500] }]}>
            Interested
          </Text>
        </Pressable>

        {event.external_ticket_url ? (
          <Pressable
            style={({ pressed }) => [
              styles.ticketButton,
              { backgroundColor: Magenta[500] },
              pressed && styles.buttonPressed
            ]}
            onPress={handleGetTickets}
          >
            <Ionicons name="ticket-outline" size={20} color="#fff" />
            <Text style={styles.ticketButtonText}>Get Tickets</Text>
          </Pressable>
        ) : event.event_url ? (
          <Pressable
            style={({ pressed }) => [
              styles.ticketButton,
              { backgroundColor: Magenta[500] },
              pressed && styles.buttonPressed
            ]}
            onPress={() => Linking.openURL(event.event_url!)}
          >
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={styles.ticketButtonText}>View Event</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
    color: Magenta[500],
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: Typography.xl,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: Typography.base,
    textAlign: 'center',
    lineHeight: Typography.base * 1.5,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonPressed: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xxxl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Magenta[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dateBadgeDay: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 24,
  },
  dateBadgeMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    lineHeight: Typography.xxl * 1.2,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: Typography.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoSubLabel: {
    fontSize: Typography.sm,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.base,
    lineHeight: Typography.base * 1.6,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    justifyContent: 'space-around',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statNumber: {
    fontSize: Typography.base,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: Typography.sm,
  },
  sourceContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sourceText: {
    fontSize: Typography.xs,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
  },
  interestedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  interestedButtonText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  ticketButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  ticketButtonText: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: '#fff',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
