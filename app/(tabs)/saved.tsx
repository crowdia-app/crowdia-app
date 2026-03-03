import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EventCard } from '@/components/events/EventCard';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { Colors, Magenta, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { EventWithStats } from '@/types/database';
import { useInterestsStore } from '@/stores/interestsStore';
import { useAuthStore } from '@/stores/authStore';

export default function SavedScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { user } = useAuthStore();
  const { interestedEvents, isLoading, loadInterestedEvents } = useInterestsStore();

  // Load saved events on mount
  useEffect(() => {
    if (user) {
      loadInterestedEvents(user.id);
    }
  }, [user, loadInterestedEvents]);

  const handleRefresh = useCallback(() => {
    if (user) {
      loadInterestedEvents(user.id);
    }
  }, [user, loadInterestedEvents]);

  const handleEventPress = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router]
  );

  const renderEvent = useCallback(
    ({ item }: { item: EventWithStats }) => (
      <EventCard event={item} onPress={() => handleEventPress(item.id!)} />
    ),
    [handleEventPress]
  );

  const keyExtractor = useCallback((item: EventWithStats) => item.id!, []);

  // Not logged in
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <GlowingLogo size={32} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
        </View>
        <View style={styles.centered}>
          <View style={[styles.iconContainer, { backgroundColor: Magenta[500] + '20' }]}>
            <Ionicons name="heart-outline" size={48} color={Magenta[500]} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Save events you love</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Sign in to save events and access them here anytime
          </Text>
          <Pressable
            style={[styles.signInButton, { backgroundColor: Magenta[500] }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <GlowingLogo size={32} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
        {interestedEvents.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: Magenta[500] }]}>
            <Text style={styles.countBadgeText}>{interestedEvents.length}</Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Magenta[500]} />
        </View>
      ) : interestedEvents.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.iconContainer, { backgroundColor: Magenta[500] + '20' }]}>
            <Ionicons name="heart-outline" size={48} color={Magenta[500]} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved events yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Tap the heart on any event to save it here
          </Text>
          <Pressable
            style={[styles.browseButton, { borderColor: Magenta[500] }]}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.browseButtonText, { color: Magenta[500] }]}>
              Browse Events
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={interestedEvents}
          renderItem={renderEvent}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={Magenta[500]}
              colors={[Magenta[500]]}
            />
          }
          estimatedItemSize={200}
        />
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
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: Typography.xs,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.base,
    textAlign: 'center',
    lineHeight: Typography.base * 1.5,
  },
  signInButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.base,
    fontWeight: '600',
  },
  browseButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginTop: Spacing.sm,
  },
  browseButtonText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
});
