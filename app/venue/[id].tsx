import React, { useMemo, useState } from 'react';
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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { fetchVenueById, fetchVenueEvents } from '@/services/venues';
import { fetchOrganizerById } from '@/services/organizers';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { EventCard } from '@/components/events/EventCard';
import { MapSection } from '@/components/maps/MapSection';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';

const HERO_HEIGHT = 280;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function isOutdoorType(venueType: string | null): boolean {
  if (!venueType) return false;
  const t = venueType.toLowerCase();
  return ['outdoor', 'rooftop', 'garden', 'beach', 'park'].some((k) => t.includes(k));
}

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

function AmenityChip({ icon, label }: { icon: string; label: string }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.amenityChip, { backgroundColor: colors.background }]}>
      <Ionicons name={icon as any} size={15} color={colors.textSecondary} />
      <Text style={[styles.amenityLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function VenueProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const userLocation = useEventsFilterStore((s) => s.userLocation);
  const [logoError, setLogoError] = useState(false);

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

  const { data: organizer } = useQuery({
    queryKey: ['organizer', venue?.operator_org_id],
    queryFn: () => fetchOrganizerById(venue!.operator_org_id!),
    enabled: !!venue?.operator_org_id,
  });

  const isVerified = !!venue?.operator_org_id;

  const isLiveNow = useMemo(() => {
    const now = Date.now();
    return events.some((e) => {
      if (!e.event_start_time || !e.event_end_time) return false;
      return (
        new Date(e.event_start_time).getTime() <= now &&
        now <= new Date(e.event_end_time).getTime()
      );
    });
  }, [events]);

  const distanceLabel = useMemo(() => {
    if (!userLocation || !venue) return null;
    const km = haversineKm(userLocation.latitude, userLocation.longitude, venue.lat, venue.lng);
    return formatDistance(km);
  }, [userLocation, venue]);

  const outdoor = isOutdoorType(venue?.venue_type ?? null);
  const hasLogo = !!organizer?.logo_url && !logoError;

  const handleBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleOpenWebsite = () => {
    if (!venue?.website_url) return;
    if (Platform.OS === 'web') window.open(venue.website_url, '_blank');
    else Linking.openURL(venue.website_url);
  };

  const handleOpenMaps = () => {
    if (!venue) return;
    const q = encodeURIComponent(venue.name);
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${q}&ll=${venue.lat},${venue.lng}`
        : `geo:${venue.lat},${venue.lng}?q=${q}`;
    Linking.openURL(url);
  };

  const handleOpenOrganizer = () => {
    if (!venue?.operator_org_id) return;
    router.push(`/organizer/${venue.operator_org_id}`);
  };

  const heroEl = (
    <View style={[styles.heroContainer, { height: HERO_HEIGHT + insets.top }]}>
      {venue?.image_url ? (
        <Image
          source={{ uri: venue.image_url }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      ) : null}
      <LinearGradient
        colors={venue?.image_url
          ? ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.6)', colors.background] as any
          : ['#080808', '#121212', '#1c1c1c', colors.background] as any}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
        <HeaderButton onPress={handleBack} icon="arrow-back" />
      </View>
      {venue && (
        <View style={styles.avatarWrapper}>
          <View style={[styles.haloRing, isLiveNow && styles.haloActive]}>
            <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
              {hasLogo ? (
                <Image
                  source={{ uri: organizer!.logo_url! }}
                  style={styles.avatarImage}
                  contentFit="contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: Magenta[500] + '1a' }]}>
                  <Ionicons name="location-sharp" size={36} color={Magenta[500]} />
                </View>
              )}
            </View>
          </View>
          {isLiveNow && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (isLoadingVenue) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {heroEl}
        <View style={styles.loadingContainer}>
          <StaticGlowLogo size={48} />
        </View>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {heroEl}
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Venue not found</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This venue profile may have been removed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
      >
        {heroEl}

        {/* Name + Authority Badge */}
        <View style={styles.nameSection}>
          <Text style={[styles.venueName, { color: colors.text }]}>{venue.name}</Text>
          <View
            style={[
              styles.authorityBadge,
              { backgroundColor: Magenta[500] + '18', borderColor: Magenta[500] + '40' },
            ]}
          >
            <Text style={[styles.authorityText, { color: Magenta[500] }]}>
              {isVerified ? 'Spazio & Organizzazione' : 'Spazio'}
            </Text>
          </View>
        </View>

        {/* B2B CTA for unverified spaces */}
        {!isVerified && (
          <View style={[styles.b2bCard, { backgroundColor: colors.card }]}>
            <Ionicons name="business-outline" size={20} color={Magenta[500]} style={{ marginTop: 1 }} />
            <Text style={[styles.b2bText, { color: colors.textSecondary }]} numberOfLines={4}>
              {'Sei il proprietario di '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>{venue.name}</Text>
              {'? Attiva la gestione di questo profilo con i suoi eventi e sblocca gli analytics.'}
            </Text>
          </View>
        )}

        {/* Status row: live status + distance + address */}
        <View style={[styles.statusRow, { backgroundColor: colors.card }]}>
          <View style={styles.statusItem}>
            <View
              style={[styles.statusDot, { backgroundColor: isLiveNow ? '#22c55e' : colors.textMuted }]}
            />
            <Text style={[styles.statusLabel, { color: isLiveNow ? '#22c55e' : colors.textSecondary }]}>
              {isLiveNow ? 'Aperto Ora' : 'Chiuso'}
            </Text>
          </View>

          {distanceLabel ? (
            <>
              <View style={[styles.statusDivider, { backgroundColor: colors.background }]} />
              <View style={styles.statusItem}>
                <Ionicons name="navigate-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                  {distanceLabel}
                </Text>
              </View>
            </>
          ) : null}

          {venue.address ? (
            <>
              <View style={[styles.statusDivider, { backgroundColor: colors.background }]} />
              <Pressable
                style={[styles.statusItem, styles.statusItemFlex]}
                onPress={handleOpenMaps}
              >
                <Ionicons name="map-outline" size={13} color={colors.textSecondary} />
                <Text
                  style={[styles.statusLabel, styles.statusAddressText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {venue.address}
                </Text>
                <Ionicons name="open-outline" size={11} color={colors.textMuted} />
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Link to managing organizer */}
        {isVerified ? (
          <Pressable
            style={({ pressed }) => [
              styles.infoRow,
              { backgroundColor: colors.card },
              pressed && styles.pressed,
            ]}
            onPress={handleOpenOrganizer}
          >
            <Ionicons name="business-outline" size={16} color={Magenta[500]} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {'Gestito da '}
              <Text style={{ color: Magenta[500], fontWeight: '600' }}>
                {organizer?.organization_name ?? 'Organizzazione'}
              </Text>
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* Website */}
        {venue.website_url ? (
          <Pressable
            style={({ pressed }) => [
              styles.infoRow,
              { backgroundColor: colors.card },
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

        {/* Amenities */}
        <View style={[styles.amenitiesCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textMuted }]}>CARATTERISTICHE</Text>
          <View style={styles.amenitiesGrid}>
            <AmenityChip
              icon={outdoor ? 'partly-sunny-outline' : 'home-outline'}
              label={outdoor ? "All'aperto" : 'Al chiuso'}
            />
            {venue.seasonality ? (
              <AmenityChip icon="calendar-outline" label={venue.seasonality} />
            ) : null}
          </View>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Prossimi eventi</Text>

          {isLoadingEvents ? (
            <View style={styles.eventsLoadingContainer}>
              <StaticGlowLogo size={36} />
            </View>
          ) : events.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Nessun evento in programma
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
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  headerRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonPressed: {
    opacity: 0.7,
  },
  avatarWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: -52,
  },
  haloRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloActive: {
    borderColor: Magenta[500],
    shadowColor: Magenta[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 14,
  },
  avatarInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  livePill: {
    position: 'absolute',
    bottom: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: Typography.xxs,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
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
  nameSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 64,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  venueName: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  authorityBadge: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  authorityText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  b2bCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  b2bText: {
    fontSize: Typography.sm,
    flex: 1,
    lineHeight: 20,
  },
  statusRow: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusItemFlex: {
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: Typography.sm,
  },
  statusAddressText: {
    flex: 1,
  },
  statusDivider: {
    width: 1,
    height: 16,
    marginHorizontal: Spacing.sm,
  },
  infoRow: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.sm,
    flex: 1,
  },
  amenitiesCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  cardSectionLabel: {
    fontSize: Typography.xxs,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
  },
  amenityLabel: {
    fontSize: Typography.sm,
  },
  mapWrapper: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  eventsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
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
  pressed: {
    opacity: 0.7,
  },
});
