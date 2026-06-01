import React, { useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  fetchCuratedListsByVoice,
  fetchCuratedListItems,
  type VoiceCuratedList,
  type VoiceListItem,
} from '@/services/voices';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { CategoryImagePlaceholder } from '@/components/ui/CategoryImagePlaceholder';

const VOICES_AURA = '#8B00FF';

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Europe/Rome',
  });
}

function EventItemCard({
  item,
  onPress,
  colors,
}: {
  item: VoiceListItem;
  onPress: () => void;
  colors: (typeof Colors)['dark'];
}) {
  const [imgError, setImgError] = useState(false);
  const event = item.event;
  if (!event) return null;

  const imgUrl = getProxiedImageUrl(event.cover_image_url);
  const hasImage = !!imgUrl && !imgError;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.itemCard,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.itemThumb}>
        {hasImage ? (
          <Image
            source={{ uri: imgUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <CategoryImagePlaceholder
            categorySlug={event.category_slug ?? undefined}
            iconSize={20}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.itemThumbGradient}
        />
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.itemMeta}>
          {event.location_name ? (
            <Text style={[styles.itemMetaText, { color: colors.textMuted }]} numberOfLines={1}>
              {event.location_name}
            </Text>
          ) : null}
          <Text style={[styles.itemMetaDate, { color: colors.textMuted }]}>
            {formatEventDate(event.event_start_time)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function VenueItemCard({
  item,
  onPress,
  colors,
}: {
  item: VoiceListItem;
  onPress: () => void;
  colors: (typeof Colors)['dark'];
}) {
  const [imgError, setImgError] = useState(false);
  const location = item.location;
  if (!location) return null;

  const imgUrl = getProxiedImageUrl(location.image_url);
  const hasImage = !!imgUrl && !imgError;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.itemCard,
        { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.itemThumb}>
        {hasImage ? (
          <Image
            source={{ uri: imgUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.itemThumbFallback, { backgroundColor: VOICES_AURA + '22' }]}>
            <Ionicons name="location-outline" size={22} color={VOICES_AURA} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.itemThumbGradient}
        />
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
          {location.name}
        </Text>
        <View style={styles.itemMeta}>
          {location.address ? (
            <Text style={[styles.itemMetaText, { color: colors.textMuted }]} numberOfLines={1}>
              {location.address}
            </Text>
          ) : null}
          {location.venue_type ? (
            <Text style={[styles.itemMetaDate, { color: colors.textMuted }]}>
              {location.venue_type}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function CuratedListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['curated-list-items', id],
    queryFn: () => fetchCuratedListItems(id!),
    enabled: !!id,
  });

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const navigateToItem = (item: VoiceListItem) => {
    if (item.event_id) {
      router.push(`/event/${item.event_id}`);
    } else if (item.location_id) {
      router.push(`/venue/${item.location_id}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Violet backdrop gradient */}
      <LinearGradient
        colors={[VOICES_AURA + '99', VOICES_AURA + '22', 'transparent']}
        style={[styles.heroGradient, { height: 160 + insets.top }]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <Ionicons name="list-outline" size={40} color={colors.textMuted} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="bookmark-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Questa collezione è ancora vuota
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xxxl },
          ]}
        >
          <View style={styles.itemsSection}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="bookmark-outline" size={13} color={VOICES_AURA} />
              <Text style={styles.sectionLabel}>
                {items.length} {items.length === 1 ? 'POSTO' : 'POSTI'}
              </Text>
            </View>

            {items.map((item) =>
              item.event_id ? (
                <EventItemCard
                  key={item.id}
                  item={item}
                  onPress={() => navigateToItem(item)}
                  colors={colors}
                />
              ) : (
                <VenueItemCard
                  key={item.id}
                  item={item}
                  onPress={() => navigateToItem(item)}
                  colors={colors}
                />
              )
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: Spacing.xl,
  },

  listContent: {
    paddingTop: Spacing.md,
  },

  itemsSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: '#686868',
  },

  itemCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  itemThumb: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  itemThumbFallback: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumbGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  itemInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center',
    gap: 4,
  },
  itemTitle: {
    fontSize: Typography.sm,
    fontWeight: '600',
    lineHeight: Typography.sm * 1.4,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  itemMetaText: {
    fontSize: Typography.xs,
    flex: 1,
  },
  itemMetaDate: {
    fontSize: Typography.xs,
  },
});
