import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { fetchVenueById, fetchVenueEvents } from '@/services/venues';
import { Colors, Spacing, BorderRadius, Typography, Blue } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { EventCard } from '@/components/events/EventCard';
import { MapSection } from '@/components/maps/MapSection';

const HERO_HEIGHT = 200;

function HeaderButton({ onPress, icon }: { onPress: () => void; icon: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={24} color="#fff" />
    </Pressable>
  );
}

function formatVenueType(venueType: string | null): string | null {
  if (!venueType) return null;
  return venueType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function VenueProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: venue, isLoading: isLoadingVenue } = useQuery({
    queryKey: ['venue', id],
    queryFn: () => fetchVenueById(id!),
    enabled: !!id,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['venue-events', id],
    queryFn: () => fetchVenueEvents(id!),
    enabled: !!id,
  });

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleOpenWebsite = () => {
    if (!venue?.website_url) return;
    if (Platform.OS === 'web') {
      window.open(venue.website_url, '_blank');
    } else {
      Linking.openURL(venue.website_url);
    }
  };

  const handleOpenMaps = () => {
    if (!venue) return;
    const query = encodeURIComponent(venue.name);
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${query}&ll=${venue.lat},${venue.lng}`
        : `geo:${venue.lat},${venue.lng}?q=${query}`;
    Linking.openURL(url);
  };

  if (isLoadingVenue) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.heroContainer, { height: HERO_HEIGHT + insets.top }]}>
          <LinearGradient
            colors={[Blue[700], Blue[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <StaticGlowLogo size={48} />
        </View>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.heroContainer, { height: HERO_HEIGHT + insets.top }]}>
          <LinearGradient
            colors={[Blue[700], Blue[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Venue not found</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This venue profile may have been removed.
          </Text>
        </View>
      </View>
    );
  }

  const venueTypeLabel = formatVenueType(venue.venue_type);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
      >
        {/* Hero Banner */}
        <View style={[styles.heroContainer, { height: HERO_HEIGHT + insets.top }]}>
          <LinearGradient
            colors={[Blue[700], Blue[500], Blue[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
          </View>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          {/* Icon */}
          <View style={[styles.iconWrapper, { backgroundColor: colors.background, borderColor: colors.card }]}>
            <View style={[styles.iconPlaceholder, { backgroundColor: Blue[500] + '20' }]}>
              <Ionicons name="location-sharp" size={32} color={Blue[500]} />
            </View>
          </View>

          {/* Name + Type */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {venue.name}
            </Text>
            {venueTypeLabel ? (
              <View style={[styles.typeBadge, { backgroundColor: Blue[500] + '20' }]}>
                <Text style={[styles.typeBadgeText, { color: Blue[500] }]}>{venueTypeLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Address */}
          {venue.address ? (
            <Pressable
              style={({ pressed }) => [
                styles.infoRow,
                { backgroundColor: colors.background },
                pressed && styles.pressed,
              ]}
              onPress={handleOpenMaps}
            >
              <Ionicons name="map-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={2}>
                {venue.address}
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* Website */}
          {venue.website_url ? (
            <Pressable
              style={({ pressed }) => [
                styles.infoRow,
                { backgroundColor: colors.background },
                pressed && styles.pressed,
              ]}
              onPress={handleOpenWebsite}
            >
              <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {venue.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Map */}
        <View style={styles.mapWrapper}>
          <MapSection
            latitude={venue.lat}
            longitude={venue.lng}
            locationName={venue.name}
            colorScheme={colorScheme}
            onPress={handleOpenMaps}
          />
        </View>

        {/* Upcoming Events */}
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Events</Text>

          {isLoadingEvents ? (
            <View style={styles.eventsLoadingContainer}>
              <StaticGlowLogo size={36} />
            </View>
          ) : events.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No upcoming events
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-start',
  },
  headerRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonPressed: {
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
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
  },
  profileCard: {
    marginHorizontal: Spacing.lg,
    marginTop: -48,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingTop: 56,
  },
  iconWrapper: {
    position: 'absolute',
    top: -44,
    left: Spacing.lg,
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    borderWidth: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  name: {
    fontSize: Typography.xl,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    borderRadius: BorderRadius.md,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  typeBadgeText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.sm,
    flex: 1,
    maxWidth: 260,
  },
  pressed: {
    opacity: 0.7,
  },
  mapWrapper: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  eventsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  eventsLoadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyState: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.base,
  },
});
