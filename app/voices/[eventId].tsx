import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { getVoicesByEventId, type VoiceAttendee } from '@/services/voices';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';

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

function VoiceRow({ attendee, onPress }: { attendee: VoiceAttendee; onPress: () => void }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const displayName = attendee.user?.display_name || attendee.user?.username || 'Voice';
  const username = attendee.user?.username;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.voiceRow,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      {attendee.user?.profile_image_url ? (
        <Image
          source={{ uri: attendee.user.profile_image_url }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: Magenta[500] + '30' }]}>
          <Ionicons name="person" size={22} color={Magenta[500]} />
        </View>
      )}
      <View style={styles.voiceInfo}>
        <View style={styles.voiceNameRow}>
          <Text style={[styles.voiceName, { color: colors.text }]}>{displayName}</Text>
          <View style={styles.voiceBadge}>
            <Ionicons name="mic" size={10} color={Magenta[500]} />
            <Text style={[styles.voiceBadgeText, { color: Magenta[500] }]}>Voice</Text>
          </View>
        </View>
        {username ? (
          <Text style={[styles.voiceUsername, { color: colors.textSecondary }]}>@{username}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function VoicesAttendingScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: voices = [], isLoading } = useQuery({
    queryKey: ['event-voices', eventId],
    queryFn: () => getVoicesByEventId(eventId!),
    enabled: !!eventId,
  });

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.background, borderBottomColor: colors.divider }]}>
        <HeaderButton onPress={handleBack} icon="arrow-back" />
        <View style={styles.headerTitleContainer}>
          <Ionicons name="mic" size={18} color={Magenta[500]} style={{ marginRight: 6 }} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Voices Attending</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <StaticGlowLogo size={48} />
        </View>
      ) : voices.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="mic-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No voices attending yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            {voices.length} {voices.length === 1 ? 'voice' : 'voices'} attending this event
          </Text>
          <View style={styles.list}>
            {voices.map((attendee) => (
              <VoiceRow
                key={attendee.id}
                attendee={attendee}
                onPress={() => router.push(`/user/${attendee.user_id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyText: {
    fontSize: Typography.base,
    textAlign: 'center',
  },
  countLabel: {
    fontSize: Typography.sm,
    marginBottom: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceInfo: {
    flex: 1,
    gap: 2,
  },
  voiceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  voiceName: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Magenta[500],
  },
  voiceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  voiceUsername: {
    fontSize: Typography.sm,
  },
});
