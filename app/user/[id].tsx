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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  fetchPublicUserProfile,
  getVoiceEvents,
  fetchVoiceInstagram,
  type VoiceEventEntry,
} from '@/services/voices';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { getProxiedImageUrl } from '@/utils/imageProxy';

const EVENT_TIMEZONE = 'Europe/Rome';

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: EVENT_TIMEZONE,
  });
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

function VoiceEventItem({
  entry,
  onPress,
}: {
  entry: VoiceEventEntry;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const event = entry.event;
  if (!event) return null;

  const imageUrl = getProxiedImageUrl(event.cover_image_url);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.eventItem,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.eventThumb}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.eventThumb, { backgroundColor: Magenta[500] + '20' }]}>
          <Ionicons name="musical-notes-outline" size={20} color={Magenta[500]} />
        </View>
      )}
      <View style={styles.eventItemInfo}>
        <Text style={[styles.eventItemTitle, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={[styles.eventItemDate, { color: colors.textSecondary }]}>
          {formatEventDate(event.event_start_time)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => fetchPublicUserProfile(id!),
    enabled: !!id,
  });

  const { data: voiceEvents = [] } = useQuery({
    queryKey: ['voice-events', id],
    queryFn: () => getVoiceEvents(id!),
    enabled: !!id && !!profile?.is_voice,
  });

  const { data: instagram } = useQuery({
    queryKey: ['voice-instagram', id],
    queryFn: () => fetchVoiceInstagram(id!),
    enabled: !!id && !!profile?.is_voice,
  });

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleInstagram = () => {
    if (!instagram) return;
    const handle = instagram.startsWith('@') ? instagram.slice(1) : instagram;
    const url = `https://instagram.com/${handle}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const displayName = profile?.display_name || profile?.username || 'User';
  const avatarUrl = getProxiedImageUrl(profile?.profile_image_url);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
          <HeaderButton onPress={handleBack} icon="arrow-back" />
        </View>
        <View style={styles.centered}>
          <StaticGlowLogo size={48} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
          <HeaderButton onPress={handleBack} icon="arrow-back" />
        </View>
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Profile not found</Text>
        </View>
      </View>
    );
  }

  const typedVoiceEvents = voiceEvents as unknown as VoiceEventEntry[];
  const upcomingVoiceEvents = typedVoiceEvents.filter(
    (e) => e.event && new Date(e.event.event_start_time) >= new Date()
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header background gradient */}
      <LinearGradient
        colors={[Magenta[500] + '40', 'transparent']}
        style={[styles.headerGradient, { height: 200 + insets.top }]}
      />

      {/* Back button */}
      <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
        <HeaderButton onPress={handleBack} icon="arrow-back" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
      >
        {/* Avatar + Name */}
        <View style={styles.profileHeader}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: Magenta[500] + '30' }]}>
              <Ionicons name="person" size={40} color={Magenta[500]} />
            </View>
          )}

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
              {profile.is_voice ? (
                <View style={[styles.voiceBadge, { borderColor: Magenta[500] }]}>
                  <Ionicons name="mic" size={12} color={Magenta[500]} />
                  <Text style={[styles.voiceBadgeText, { color: Magenta[500] }]}>Voice</Text>
                </View>
              ) : null}
            </View>
            {profile.username ? (
              <Text style={[styles.username, { color: colors.textSecondary }]}>
                @{profile.username}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Bio */}
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Social links (voice only) */}
        {profile.is_voice && instagram ? (
          <View style={styles.section}>
            <Pressable
              style={({ pressed }) => [
                styles.socialRow,
                { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleInstagram}
            >
              <Ionicons name="logo-instagram" size={22} color="#E1306C" />
              <Text style={[styles.socialHandle, { color: colors.text }]}>
                {instagram.startsWith('@') ? instagram : `@${instagram}`}
              </Text>
              <Ionicons name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* Voice attending events */}
        {profile.is_voice ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ATTENDING</Text>
            {upcomingVoiceEvents.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No upcoming events
                </Text>
              </View>
            ) : (
              <View style={styles.eventList}>
                {upcomingVoiceEvents.map((entry) => (
                  <VoiceEventItem
                    key={entry.event_id}
                    entry={entry}
                    onPress={() => router.push(`/event/${entry.event_id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Member since */}
        {profile.created_at ? (
          <Text style={[styles.memberSince, { color: colors.textMuted }]}>
            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  displayName: {
    fontSize: Typography.xl,
    fontWeight: '700',
  },
  username: {
    fontSize: Typography.base,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  voiceBadgeText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  bio: {
    fontSize: Typography.base,
    lineHeight: Typography.base * 1.6,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  socialHandle: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: '500',
  },
  eventList: {
    gap: Spacing.sm,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  eventThumb: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventItemInfo: {
    flex: 1,
    gap: 2,
  },
  eventItemTitle: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  eventItemDate: {
    fontSize: Typography.xs,
  },
  emptyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.base,
    textAlign: 'center',
  },
  memberSince: {
    fontSize: Typography.sm,
    textAlign: 'center',
    paddingBottom: Spacing.md,
  },
});
