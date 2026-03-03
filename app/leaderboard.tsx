import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Magenta, Charcoal, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { AuthService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

type LeaderboardEntry = {
  rank: number;
  display_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  points: number | null;
  check_ins_count: number | null;
};

const numberFormatter = new Intl.NumberFormat();

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuthStore();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AuthService.fetchLeaderboard(50)
      .then((data) => setEntries(data as LeaderboardEntry[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leaderboard'))
      .finally(() => setIsLoading(false));
  }, []);

  const myRank = entries.find((e) => e.username === userProfile?.username)?.rank;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* My Rank Banner */}
      {myRank ? (
        <View style={[styles.myRankBanner, { backgroundColor: Magenta[500] + '20', borderColor: Magenta[500] + '40' }]}>
          <Ionicons name="trophy-outline" size={18} color={Magenta[500]} />
          <Text style={[styles.myRankText, { color: Magenta[500] }]}>
            Your rank: #{myRank}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Magenta[500]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="trophy-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No entries yet. Start earning points!
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.xxxl }]}
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry, index) => {
            const isMe = entry.username === userProfile?.username;
            const medalColor = index < 3 ? MEDAL_COLORS[index] : null;

            return (
              <View
                key={`${entry.rank}-${entry.username}`}
                style={[
                  styles.row,
                  {
                    backgroundColor: isMe
                      ? Magenta[500] + '18'
                      : colors.card,
                    borderColor: isMe ? Magenta[500] + '50' : 'transparent',
                  },
                ]}
              >
                {/* Rank */}
                <View style={styles.rankContainer}>
                  {medalColor ? (
                    <Ionicons name="trophy" size={20} color={medalColor} />
                  ) : (
                    <Text style={[styles.rankText, { color: colors.textMuted }]}>
                      {entry.rank}
                    </Text>
                  )}
                </View>

                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: isMe ? Magenta[500] : Charcoal[500] }]}>
                  <Text style={styles.avatarText}>{getInitials(entry.display_name)}</Text>
                </View>

                {/* Name + Username */}
                <View style={styles.nameContainer}>
                  <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                    {entry.display_name || 'User'}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  {entry.username ? (
                    <Text style={[styles.username, { color: colors.textSecondary }]} numberOfLines={1}>
                      @{entry.username}
                    </Text>
                  ) : null}
                </View>

                {/* Points */}
                <Text style={[styles.pointsText, { color: medalColor ?? (isMe ? Magenta[500] : colors.text) }]}>
                  {numberFormatter.format(entry.points ?? 0)}
                </Text>
              </View>
            );
          })}
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  myRankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  myRankText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  rankText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  nameContainer: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  username: {
    fontSize: Typography.xs,
    marginTop: 2,
  },
  pointsText: {
    fontSize: Typography.base,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: Typography.base,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.base,
    textAlign: 'center',
  },
});
