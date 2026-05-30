import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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

import {
  fetchOrganizerById,
  fetchOrganizerEvents,
  fetchOrganizerPastEvents,
  fetchOrganizerEventCount,
} from '@/services/organizers';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { EventCard } from '@/components/events/EventCard';
import { VibeTagsRow } from '@/components/ui/VibeTagPill';
import { trackEvent } from '@/utils/analytics';
import { useAuthStore } from '@/stores/authStore';

const HERO_HEIGHT = 280;
type Tab = 'upcoming' | 'archive';

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

export default function OrganizerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [logoError, setLogoError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  const { userProfile, organizerProfile } = useAuthStore();
  // Show edit button for: super-admins, admins, or the organizer owner (user whose organizerProfile.id matches this page)
  const canEdit = !!(
    (userProfile as any)?.is_super_admin ||
    userProfile?.is_admin ||
    (organizerProfile?.id === id)
  );

  const { data: organizer, isLoading: isLoadingOrganizer } = useQuery({
    queryKey: ['organizer', id],
    queryFn: () => fetchOrganizerById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (organizer?.id) trackEvent('organizer_profile_view', { organizer_id: organizer.id });
  }, [organizer?.id]);

  const { data: upcomingEvents = [], isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ['organizer-events', id],
    queryFn: () => fetchOrganizerEvents(id!),
    enabled: !!id,
  });

  const { data: pastEvents = [], isLoading: isLoadingPast } = useQuery({
    queryKey: ['organizer-past-events', id],
    queryFn: () => fetchOrganizerPastEvents(id!),
    enabled: !!id,
  });

  const { data: totalEventCount = 0 } = useQuery({
    queryKey: ['organizer-event-count', id],
    queryFn: () => fetchOrganizerEventCount(id!),
    enabled: !!id,
  });

  const isLiveNow = useMemo(() => {
    const now = Date.now();
    return upcomingEvents.some((e) => {
      if (!e.event_start_time || !e.event_end_time) return false;
      return (
        new Date(e.event_start_time).getTime() <= now &&
        now <= new Date(e.event_end_time).getTime()
      );
    });
  }, [upcomingEvents]);

  const communityInterest = useMemo(() => {
    return [...upcomingEvents, ...pastEvents].reduce(
      (sum, e) => sum + (e.interested_count ?? 0) + (e.check_ins_count ?? 0),
      0,
    );
  }, [upcomingEvents, pastEvents]);

  const frequentVenues = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    for (const e of [...upcomingEvents, ...pastEvents]) {
      if (!e.location_id || !e.location_name) continue;
      const existing = seen.get(e.location_id);
      if (existing) existing.count += 1;
      else seen.set(e.location_id, { id: e.location_id, name: e.location_name, count: 1 });
    }
    return Array.from(seen.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [upcomingEvents, pastEvents]);

  const vibeTagsAggregated = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of [...upcomingEvents, ...pastEvents]) {
      if (!e.vibe_tags) continue;
      for (const tag of e.vibe_tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }, [upcomingEvents, pastEvents]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isLiveNow) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.14, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLiveNow, pulseAnim]);

  const hasLogo = !!organizer?.logo_url && !logoError;
  const isVerified = !!organizer?.is_verified;

  const handleBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleOpenWebsite = () => {
    if (!organizer?.website_url) return;
    if (Platform.OS === 'web') window.open(organizer.website_url, '_blank');
    else Linking.openURL(organizer.website_url);
  };

  const handleOpenInstagram = () => {
    if (!organizer?.instagram_handle) return;
    const handle = organizer.instagram_handle.replace('@', '');
    const url = `https://instagram.com/${handle}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  };

  const heroEl = (
    <View style={[styles.heroContainer, { height: HERO_HEIGHT + insets.top }]}>
      <LinearGradient
        colors={['#080808', '#121212', '#1c1c1c', colors.background] as any}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
        <HeaderButton onPress={handleBack} icon="arrow-back" />
        {canEdit && organizer && (
          <HeaderButton
            onPress={() => router.push(`/admin/organizers/${id}`)}
            icon="pencil"
          />
        )}
      </View>
      {organizer && (
        <View style={styles.avatarWrapper}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.haloRing, isLiveNow && styles.haloActive]}>
              <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
                {hasLogo ? (
                  <Image
                    source={{ uri: organizer.logo_url! }}
                    style={styles.avatarImage}
                    contentFit="contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: Magenta[500] + '1a' }]}>
                    <Ionicons name="business-outline" size={36} color={Magenta[500]} />
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
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

  if (isLoadingOrganizer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {heroEl}
        <View style={styles.loadingContainer}>
          <StaticGlowLogo size={48} />
        </View>
      </View>
    );
  }

  if (!organizer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {heroEl}
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Organizer not found</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This organizer profile may have been removed.
          </Text>
        </View>
      </View>
    );
  }

  const activeEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;
  const isLoadingEvents = activeTab === 'upcoming' ? isLoadingUpcoming : isLoadingPast;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
      >
        {heroEl}

        {/* Name + Authority Badge */}
        <View style={styles.nameSection}>
          <Text style={[styles.orgName, { color: colors.text }]}>{organizer.organization_name}</Text>
          <View
            style={[
              styles.authorityBadge,
              { backgroundColor: Magenta[500] + '18', borderColor: Magenta[500] + '40' },
            ]}
          >
            {isVerified && <Ionicons name="checkmark-circle" size={13} color={Magenta[500]} />}
            <Text style={[styles.authorityText, { color: Magenta[500] }]}>Organizzazione</Text>
          </View>
        </View>

        {/* B2B CTA for unverified organizers */}
        {!isVerified && (
          <View style={[styles.b2bCard, { backgroundColor: colors.card }]}>
            <Ionicons name="business-outline" size={20} color={Magenta[500]} style={{ marginTop: 1 }} />
            <Text style={[styles.b2bText, { color: colors.textSecondary }]} numberOfLines={4}>
              {'Sei il proprietario di '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>{organizer.organization_name}</Text>
              {'? Attiva la gestione di questo profilo con i suoi eventi e sblocca gli analytics.'}
            </Text>
          </View>
        )}

        {/* Vibe Tags */}
        {vibeTagsAggregated.length > 0 && (
          <View style={styles.vibeTagsSection}>
            <VibeTagsRow tags={vibeTagsAggregated} maxTags={5} />
          </View>
        )}

        {/* Social connectors */}
        {(organizer.instagram_handle || organizer.website_url) ? (
          <View style={styles.socialRow}>
            {organizer.instagram_handle ? (
              <Pressable
                style={({ pressed }) => [
                  styles.socialChip,
                  { backgroundColor: colors.card },
                  pressed && styles.pressed,
                ]}
                onPress={handleOpenInstagram}
              >
                <Ionicons name="logo-instagram" size={16} color={colors.textSecondary} />
                <Text style={[styles.socialChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {organizer.instagram_handle.startsWith('@')
                    ? organizer.instagram_handle
                    : `@${organizer.instagram_handle}`}
                </Text>
              </Pressable>
            ) : null}
            {organizer.website_url ? (
              <Pressable
                style={({ pressed }) => [
                  styles.socialChip,
                  { backgroundColor: colors.card },
                  pressed && styles.pressed,
                ]}
                onPress={handleOpenWebsite}
              >
                <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.socialChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {organizer.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </Text>
                <Ionicons name="open-outline" size={13} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Performance stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{totalEventCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>URBAN FOOTPRINT</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.background }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{communityInterest}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>COMMUNITY INTEREST</Text>
          </View>
        </View>

        {/* Frequently Seen At */}
        {frequentVenues.length > 0 ? (
          <View style={styles.venueCarouselSection}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FREQUENTLY SEEN AT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.venueCarouselContent}
            >
              {frequentVenues.map((v) => (
                <Pressable
                  key={v.id}
                  style={({ pressed }) => [
                    styles.venueChip,
                    { backgroundColor: colors.card },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push(`/venue/${v.id}`)}
                >
                  <Ionicons name="location-outline" size={13} color={Magenta[500]} />
                  <Text style={[styles.venueChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {v.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Tab navigation */}
        <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
          <Pressable
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'upcoming' ? Magenta[500] : colors.textMuted },
              ]}
            >
              Prossimi eventi
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'archive' && styles.tabActive]}
            onPress={() => setActiveTab('archive')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'archive' ? Magenta[500] : colors.textMuted },
              ]}
            >
              The Vault
            </Text>
          </Pressable>
        </View>

        {/* Event list */}
        <View style={styles.eventsSection}>
          {isLoadingEvents ? (
            <View style={styles.eventsLoadingContainer}>
              <StaticGlowLogo size={36} />
            </View>
          ) : activeEvents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeTab === 'upcoming' ? 'Nessun evento in programma' : 'Nessun evento passato'}
              </Text>
            </View>
          ) : (
            activeEvents.map((event) => (
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  orgName: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  authorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  vibeTagsSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  socialRow: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  socialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  socialChipText: {
    fontSize: Typography.sm,
    maxWidth: 200,
  },
  statsRow: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: Typography.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: Typography.xxs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: Spacing.md,
  },
  venueCarouselSection: {
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.xxs,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  venueCarouselContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  venueChipText: {
    fontSize: Typography.sm,
    maxWidth: 140,
  },
  tabBar: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Magenta[500],
  },
  tabText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  eventsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
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
