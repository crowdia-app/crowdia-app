import React, { useCallback, useState } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { fetchEventById } from '@/services/events';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, Typography, Magenta, Green } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { MapSection } from '@/components/maps/MapSection';
import { formatLocationAddress, hasPreciseLocation } from '@/utils/locationDisplay';
import { useInterestsStore } from '@/stores/interestsStore';
import { useAuthStore } from '@/stores/authStore';

const HERO_HEIGHT = 320;

// Events are always in Palermo (Europe/Rome) — display in local event time
// so the date/time shown matches what attendees see on posters and tickets.
const EVENT_TIMEZONE = 'Europe/Rome';

const formatFullDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'long', timeZone: EVENT_TIMEZONE }),
    date: date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: EVENT_TIMEZONE,
    }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: EVENT_TIMEZONE }),
    day: parseInt(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: EVENT_TIMEZONE }), 10),
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: EVENT_TIMEZONE }).toUpperCase(),
  };
};

const numberFormatter = new Intl.NumberFormat();

const CHECK_IN_POINTS = 25;

/** Returns true if the event is happening today or is currently ongoing */
function isEventTodayOrOngoing(startTime: string, endTime?: string | null): boolean {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Currently ongoing: started and hasn't ended yet
  if (end && now >= start && now <= end) return true;

  // Event starts today
  if (start >= todayStart && start < todayEnd) return true;

  return false;
}

/** Truncate URL for display (strip protocol, trim long paths) */
function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    return display.length > 40 ? display.substring(0, 37) + '...' : display;
  } catch {
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
  }
}

// Header button component extracted outside render to avoid remount cycles
function HeaderButton({ onPress, icon, size = 24 }: { onPress: () => void; icon: string; size?: number }) {
  return (
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
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { user, refreshProfile } = useAuthStore();
  const { isInterested, toggleInterest } = useInterestsStore();
  const interested = isInterested(id!);
  const queryClient = useQueryClient();

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id!),
    enabled: !!id,
  });

  // Check if the current user has already checked in to this event
  const { data: existingCheckIn, refetch: refetchCheckIn } = useQuery({
    queryKey: ['check-in', id, user?.id],
    queryFn: async () => {
      if (!user?.id || !id) return null;
      const { data } = await supabase
        .from('event_check_ins')
        .select('id, checked_in_at')
        .eq('event_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!id,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !id) throw new Error('Must be signed in to check in');
      const { error } = await supabase
        .from('event_check_ins')
        .insert({
          user_id: user.id,
          event_id: id,
          checked_in_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refetchCheckIn();
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      await refreshProfile();
    },
  });

  const imageUrl = getProxiedImageUrl(event?.cover_image_url);
  const [imageError, setImageError] = useState(false);
  const hasValidImage = !!imageUrl && !imageError;

  const handleInterested = useCallback(() => {
    if (!user || !id) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleInterest(user.id, id);
  }, [user, id, toggleInterest]);

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
        title: event.title ?? undefined,
        message: `Check out ${event.title ?? 'this event'} on Crowdia!\n\n${event.event_url || ''}`,
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

  const handleOpenEventLink = useCallback((url: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, []);

  const handleCheckIn = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'You need to be signed in to check in to events.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await checkInMutation.mutateAsync();
      Alert.alert(
        'Checked in!',
        `You earned ${CHECK_IN_POINTS} points for checking in to this event.`,
        [{ text: 'Nice!', style: 'default' }]
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        Alert.alert('Already checked in', 'You have already checked in to this event.');
      } else {
        Alert.alert('Check-in failed', err?.message ?? 'Something went wrong. Please try again.');
      }
    }
  };

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

  const dateInfo = formatFullDate(event.event_start_time ?? new Date().toISOString());
  // Only show map/pin for precise locations; city-center fallback coords are misleading
  const hasLocation = hasPreciseLocation(event.location_lat, event.location_lng, event.location_address);
  const displayAddress = formatLocationAddress(event.location_address, event.location_lat, event.location_lng);

  // Primary external link: prefer ticket URL, fall back to event_url
  const externalUrl = event.external_ticket_url || event.event_url || null;

  const canCheckIn = isEventTodayOrOngoing(
    event.event_start_time ?? new Date().toISOString(),
    event.event_end_time
  );
  const hasCheckedIn = !!existingCheckIn;
  const isCheckingIn = checkInMutation.isPending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Hero Image Section */}
        <View style={styles.heroContainer}>
          {hasValidImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
              onError={() => setImageError(true)}
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
                  {event.event_end_time
                    ? ` - ${formatFullDate(event.event_end_time).time}`
                    : null}
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
                {displayAddress ? (
                  <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {displayAddress}
                  </Text>
                ) : null}
              </View>
              {hasLocation ? (
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              ) : null}
            </View>
          </Pressable>

          {/* Event Link */}
          {externalUrl ? (
            <Pressable
              style={({ pressed }) => [
                styles.infoCard,
                { backgroundColor: colors.card },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => handleOpenEventLink(externalUrl)}
            >
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                  <Ionicons name="link-outline" size={20} color={Magenta[500]} />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>
                    {event.external_ticket_url ? 'Tickets' : 'Event page'}
                  </Text>
                  <Text
                    style={[styles.infoSubLabel, { color: Magenta[500], textDecorationLine: 'underline' }]}
                    numberOfLines={1}
                  >
                    {displayUrl(externalUrl)}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}

          {/* Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {event.description}
              </Text>
            </View>
          ) : null}

          {/* Map */}
          {hasLocation ? (
            <MapSection
              latitude={event.location_lat!}
              longitude={event.location_lng!}
              locationName={event.location_name ?? ''}
              colorScheme={colorScheme}
              onPress={handleOpenMaps}
            />
          ) : null}

          {/* Stats */}
          {((event.interested_count ?? 0) > 0 || (event.check_ins_count ?? 0) > 0) ? (
            <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
              {(event.interested_count ?? 0) > 0 ? (
                <View style={styles.statItem}>
                  <Ionicons name="heart" size={18} color={Magenta[500]} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {numberFormatter.format(event.interested_count ?? 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    interested
                  </Text>
                </View>
              ) : null}
              {(event.check_ins_count ?? 0) > 0 ? (
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {numberFormatter.format(event.check_ins_count ?? 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    going
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Source */}
          {event.source ? (
            <View style={styles.sourceContainer}>
              <Text style={[styles.sourceText, { color: colors.textMuted }]}>
                Source: {event.source}
              </Text>
            </View>
          ) : null}
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
        {/* Check In button -- only visible when event is today or currently ongoing */}
        {canCheckIn ? (
          <Pressable
            style={({ pressed }) => [
              styles.checkInButton,
              hasCheckedIn
                ? [styles.checkInButtonDone, { borderColor: colors.success }]
                : { backgroundColor: Green[500] },
              pressed && !hasCheckedIn && styles.buttonPressed,
              (isCheckingIn || hasCheckedIn) && styles.buttonDisabled,
            ]}
            onPress={handleCheckIn}
            disabled={isCheckingIn || hasCheckedIn}
          >
            {isCheckingIn ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={hasCheckedIn ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={20}
                  color={hasCheckedIn ? colors.success : '#fff'}
                />
                <Text style={[
                  styles.checkInButtonText,
                  hasCheckedIn && { color: colors.success },
                ]}>
                  {hasCheckedIn ? 'Checked In' : 'Check In'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {user ? (
          <Pressable
            style={({ pressed }) => [
              styles.interestedButton,
              {
                borderColor: Magenta[500],
                backgroundColor: interested ? Magenta[500] + '15' : 'transparent',
              },
              pressed && styles.buttonPressed,
            ]}
            onPress={handleInterested}
          >
            <Ionicons
              name={interested ? 'heart' : 'heart-outline'}
              size={20}
              color={Magenta[500]}
            />
            <Text style={[styles.interestedButtonText, { color: Magenta[500] }]}>
              {interested ? 'Saved' : 'Interested'}
            </Text>
          </Pressable>
        ) : null}

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
    ...Platform.select({
      ios: {
        shadowColor: Magenta[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
      default: { boxShadow: `0px 4px 8px ${Magenta[500]}4D` },
    }),
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
    fontVariant: ['tabular-nums'],
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
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  checkInButtonDone: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  checkInButtonText: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
