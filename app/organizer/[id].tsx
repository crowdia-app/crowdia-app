import React, { useState } from 'react';
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

import { fetchOrganizerById, fetchOrganizerEvents } from '@/services/organizers';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { EventCard } from '@/components/events/EventCard';

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

export default function OrganizerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [logoError, setLogoError] = useState(false);

  const { data: organizer, isLoading: isLoadingOrganizer } = useQuery({
    queryKey: ['organizer', id],
    queryFn: () => fetchOrganizerById(id!),
    enabled: !!id,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['organizer-events', id],
    queryFn: () => fetchOrganizerEvents(id!),
    enabled: !!id,
  });

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleOpenWebsite = () => {
    if (!organizer?.website_url) return;
    if (Platform.OS === 'web') {
      window.open(organizer.website_url, '_blank');
    } else {
      Linking.openURL(organizer.website_url);
    }
  };

  const handleOpenInstagram = () => {
    if (!organizer?.instagram_handle) return;
    const handle = organizer.instagram_handle.replace('@', '');
    const url = `https://instagram.com/${handle}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const hasLogo = !!organizer?.logo_url && !logoError;

  if (isLoadingOrganizer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.fakeHero, { height: HERO_HEIGHT + insets.top }]}>
          <LinearGradient
            colors={[Magenta[700], Magenta[500]]}
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

  if (!organizer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.fakeHero, { height: HERO_HEIGHT + insets.top }]}>
          <LinearGradient
            colors={[Magenta[700], Magenta[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Organizer not found</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This organizer profile may have been removed.
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
        {/* Hero Banner */}
        <View style={[styles.fakeHero, { height: HERO_HEIGHT + insets.top }]}>
          <LinearGradient
            colors={[Magenta[700], Magenta[500], Magenta[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Back button */}
          <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
          </View>
        </View>

        {/* Profile Header Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          {/* Logo */}
          <View style={[styles.logoWrapper, { backgroundColor: colors.background, borderColor: colors.card }]}>
            {hasLogo ? (
              <Image
                source={{ uri: organizer.logo_url! }}
                style={styles.logo}
                contentFit="contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: Magenta[500] + '20' }]}>
                <Ionicons name="business-outline" size={32} color={Magenta[500]} />
              </View>
            )}
          </View>

          {/* Name + Verified */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {organizer.organization_name}
            </Text>
            {organizer.is_verified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Magenta[500]} />
                <Text style={[styles.verifiedText, { color: Magenta[500] }]}>Verified</Text>
              </View>
            ) : null}
          </View>

          {/* Social Links */}
          {(organizer.website_url || organizer.instagram_handle) ? (
            <View style={styles.socialRow}>
              {organizer.website_url ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.socialChip,
                    { backgroundColor: colors.background },
                    pressed && styles.pressed,
                  ]}
                  onPress={handleOpenWebsite}
                >
                  <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.socialChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {organizer.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </Text>
                  <Ionicons name="open-outline" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
              {organizer.instagram_handle ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.socialChip,
                    { backgroundColor: colors.background },
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
                  <Ionicons name="open-outline" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
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
  fakeHero: {
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
  logoWrapper: {
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
  logo: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
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
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  socialRow: {
    gap: Spacing.sm,
  },
  socialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  socialChipText: {
    fontSize: Typography.sm,
    flex: 1,
    maxWidth: 240,
  },
  pressed: {
    opacity: 0.7,
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
