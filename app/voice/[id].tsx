/**
 * Voice Profile  —  /voice/[id]
 *
 * Renders a Voice (Creator / Influencer / Tastemaker) profile per the spec
 * in ticket #9 and the "Voice Profile - Product Requirements" Google Doc.
 *
 * Foundation shipped in this PR:
 *  • Aesthetic backdrop (gradient from Voices Aura violet)
 *  • Circular avatar with electric-violet #8B00FF Voices Aura ring
 *  • [Voice] authority badge + Clout Status label
 *  • Voice bio
 *  • Audio/Social connectors (Instagram / TikTok / Spotify / SoundCloud)
 *  • AI Taste Tags grid (renders from taste_tags field; generation is manual/stubbed for now)
 *  • Past Nights carousel (horizontal scroll of event posters)
 *
 * Deferred to follow-up tickets:
 *  • Curated Lists (Collezioni Curate)
 *  • Live Vibe Check (geofenced media capture)
 *  • Vibe Notes micro-reviews
 *  • Asymmetric Impact Matrix (analytics / media kit)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  fetchVoiceProfile,
  getVoiceEvents,
  fetchCuratedListsByVoice,
  createCuratedList,
  deleteCuratedList,
  type VoiceEventEntry,
  type VoiceCuratedList,
} from '@/services/voices';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { CategoryImagePlaceholder } from '@/components/ui/CategoryImagePlaceholder';

// ─── Design tokens ────────────────────────────────────────────────────────────

/** Electric-violet Voices Aura per spec */
const VOICES_AURA = '#8B00FF';
const VOICES_AURA_DIM = '#8B00FF40';
const HERO_HEIGHT = 260;
/** Gold color for gamified badge pills */
const BADGE_GOLD = '#D4AF37';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('it-IT', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Europe/Rome',
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeaderButton({ onPress, icon }: { onPress: () => void; icon: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={24} color="#fff" />
    </Pressable>
  );
}

/** Electric-violet aura ring wrapping the avatar */
function AuraAvatar({ uri }: { uri: string | null }) {
  const [imgError, setImgError] = useState(false);
  const proxied = getProxiedImageUrl(uri);
  const hasImage = !!proxied && !imgError;

  return (
    <View style={styles.auraRingOuter}>
      <View style={styles.auraRingInner}>
        {hasImage ? (
          <Image
            source={{ uri: proxied }}
            style={styles.avatar}
            contentFit="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={44} color={VOICES_AURA} />
          </View>
        )}
      </View>
    </View>
  );
}

/** [Voice] authority badge */
function AuthorityBadge() {
  return (
    <View style={styles.authorityBadge}>
      <Ionicons name="mic" size={11} color={VOICES_AURA} />
      <Text style={styles.authorityBadgeText}>Voice</Text>
    </View>
  );
}

/** Clout status label pill */
function CloutLabel({ label }: { label: string }) {
  return (
    <View style={styles.cloutPill}>
      <Text style={styles.cloutText}>{label}</Text>
    </View>
  );
}

/** AI Taste Tags grid */
function TasteTagsSection({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="bulb-outline" size={13} color={VOICES_AURA} />
        <Text style={styles.sectionLabel}>AI TASTE TAGS</Text>
      </View>
      <View style={styles.tasteTagsGrid}>
        {tags.map((tag, idx) => (
          <View key={idx} style={styles.tasteTag}>
            <Text style={styles.tasteTagText}>
              {tag.startsWith('#') ? tag : `#${tag}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Single curated list tile */
function CuratedListTile({
  list,
  onPress,
}: {
  list: VoiceCuratedList;
  onPress: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = list.cover_image_url;
  const hasImage = !!imgUrl && !imgError;

  return (
    <Pressable
      style={({ pressed }) => [curatedStyles.tile, { opacity: pressed ? 0.8 : 1 }]}
      onPress={onPress}
    >
      <View style={curatedStyles.tileCover}>
        {hasImage ? (
          <Image
            source={{ uri: imgUrl! }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={curatedStyles.tileCoverFallback}>
            <Ionicons name="bookmark" size={28} color={VOICES_AURA} />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={curatedStyles.tileGradient}
        />
        <View style={curatedStyles.tileLabel}>
          <Text style={curatedStyles.tileName} numberOfLines={2}>
            {list.name}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Curated Lists section with optional "add" button for Voice owners */
function CuratedListsSection({
  lists,
  isOwner,
  onPressItem,
  onAddList,
}: {
  lists: VoiceCuratedList[];
  isOwner: boolean;
  onPressItem: (list: VoiceCuratedList) => void;
  onAddList: () => void;
}) {
  if (lists.length === 0 && !isOwner) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="bookmark-outline" size={13} color={VOICES_AURA} />
        <Text style={styles.sectionLabel}>COLLEZIONI CURATE</Text>
        {isOwner ? (
          <Pressable
            style={({ pressed }) => [curatedStyles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onAddList}
          >
            <Ionicons name="add" size={16} color={VOICES_AURA} />
          </Pressable>
        ) : null}
      </View>

      {lists.length === 0 ? (
        <Pressable
          style={({ pressed }) => [curatedStyles.emptyCreate, { opacity: pressed ? 0.7 : 1 }]}
          onPress={onAddList}
        >
          <Ionicons name="add-circle-outline" size={20} color={VOICES_AURA} />
          <Text style={curatedStyles.emptyCreateText}>Crea la tua prima collezione</Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={curatedStyles.tilesRow}
        >
          {lists.map((list) => (
            <CuratedListTile key={list.id} list={list} onPress={() => onPressItem(list)} />
          ))}
          {isOwner ? (
            <Pressable
              style={({ pressed }) => [curatedStyles.addTile, { opacity: pressed ? 0.7 : 1 }]}
              onPress={onAddList}
            >
              <Ionicons name="add" size={28} color={VOICES_AURA} />
              <Text style={curatedStyles.addTileText}>Nuova</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

/** Social connector pill button */
function SocialConnector({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.socialConnector, { opacity: pressed ? 0.75 : 1 }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.socialConnectorLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Single gamified badge pill */
function BadgePill({ label }: { label: string }) {
  return (
    <View style={badgeStyles.pill}>
      <Ionicons name="ribbon-outline" size={11} color={BADGE_GOLD} />
      <Text style={badgeStyles.pillText}>{label}</Text>
    </View>
  );
}

/** Momentum indicator text pill */
function MomentumPill({ text }: { text: string }) {
  return (
    <View style={badgeStyles.momentumPill}>
      <Text style={badgeStyles.momentumText}>{text}</Text>
    </View>
  );
}

/** Private Media Kit stat row */
function MediaKitStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <View style={badgeStyles.statRow}>
      <View style={badgeStyles.statIcon}>
        <Ionicons name={icon as any} size={16} color={VOICES_AURA} />
      </View>
      <Text style={badgeStyles.statLabel}>{label}</Text>
      <Text style={badgeStyles.statValue}>{value.toLocaleString('it-IT')}</Text>
    </View>
  );
}

/**
 * Asymmetric Impact Matrix section.
 * Public: badge grid + momentum pill.
 * Private (owner or verified organizer): Digital Media Kit card.
 */
function AsymmetricImpactSection({
  badges,
  momentumText,
  urbanImpact,
  peopleMoved,
  isPrivileged,
}: {
  badges: string[];
  momentumText: string | null;
  urbanImpact: number | null;
  peopleMoved: number | null;
  isPrivileged: boolean;
}) {
  const hasBadges = badges.length > 0;
  const hasPublic = hasBadges || !!momentumText;
  const hasPrivate = isPrivileged && (urbanImpact !== null || peopleMoved !== null);

  if (!hasPublic && !hasPrivate) return null;

  return (
    <View style={badgeStyles.section}>
      {hasPublic && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="ribbon-outline" size={13} color={BADGE_GOLD} />
            <Text style={styles.sectionLabel}>IMPACT</Text>
          </View>

          {hasBadges && (
            <View style={badgeStyles.badgesRow}>
              {badges.map((b, i) => (
                <BadgePill key={i} label={b} />
              ))}
            </View>
          )}

          {momentumText && <MomentumPill text={momentumText} />}
        </>
      )}

      {hasPrivate && (
        <View style={badgeStyles.mediaKitCard}>
          <View style={badgeStyles.mediaKitHeader}>
            <Ionicons name="lock-closed-outline" size={12} color={VOICES_AURA} />
            <Text style={badgeStyles.mediaKitTitle}>MEDIA KIT — PRIVATO</Text>
          </View>
          <MediaKitStat
            icon="flame-outline"
            label="Urban Impact"
            value={urbanImpact ?? 0}
          />
          <MediaKitStat
            icon="people-outline"
            label="People Moved"
            value={peopleMoved ?? 0}
          />
        </View>
      )}
    </View>
  );
}

/** Past Nights carousel item */
function PastNightItem({
  entry,
  onPress,
}: {
  entry: VoiceEventEntry;
  onPress: () => void;
}) {
  const event = entry.event;
  if (!event) return null;

  const imgUrl = getProxiedImageUrl(event.cover_image_url);
  const [imgError, setImgError] = useState(false);
  const hasImage = !!imgUrl && !imgError;

  return (
    <Pressable
      style={({ pressed }) => [styles.pastNightItem, { opacity: pressed ? 0.8 : 1 }]}
      onPress={onPress}
    >
      <View style={styles.pastNightThumb}>
        {hasImage ? (
          <Image
            source={{ uri: imgUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <CategoryImagePlaceholder categorySlug={undefined} iconSize={22} />
        )}
        {/* Gradient overlay for legibility */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.pastNightGradient}
        />
        <View style={styles.pastNightInfo}>
          <Text style={styles.pastNightTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.pastNightDate}>
            {formatEventDate(event.event_start_time)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function VoiceProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { user, userProfile } = useAuthStore();

  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['voice-profile', id],
    queryFn: () => fetchVoiceProfile(id!),
    enabled: !!id,
  });

  const { data: voiceEvents = [] } = useQuery({
    queryKey: ['voice-events', id],
    queryFn: () => getVoiceEvents(id!),
    enabled: !!id && !!profile,
  });

  const { data: curatedLists = [] } = useQuery({
    queryKey: ['curated-lists', id],
    queryFn: () => fetchCuratedListsByVoice(id!),
    enabled: !!id && !!profile,
  });

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  // ── Social connector handlers ──────────────────────────────────────────────

  const openUrl = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const handleInstagram = () => {
    if (!profile?.instagram_handle) return;
    const handle = profile.instagram_handle.startsWith('@')
      ? profile.instagram_handle.slice(1)
      : profile.instagram_handle;
    openUrl(`https://instagram.com/${handle}`);
  };

  const handleTikTok = () => {
    if (!profile?.tiktok_handle) return;
    const handle = profile.tiktok_handle.startsWith('@')
      ? profile.tiktok_handle.slice(1)
      : profile.tiktok_handle;
    openUrl(`https://tiktok.com/@${handle}`);
  };

  const handleSpotify = () => {
    if (!profile?.spotify_url) return;
    openUrl(profile.spotify_url);
  };

  const handleSoundCloud = () => {
    if (!profile?.soundcloud_url) return;
    openUrl(profile.soundcloud_url);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const typedVoiceEvents = voiceEvents as unknown as VoiceEventEntry[];

  /** Past Nights = events whose start time is in the past */
  const pastNights = typedVoiceEvents
    .filter((e) => e.event && new Date(e.event.event_start_time) < new Date())
    .slice(0, 20);

  const hasSocials =
    !!profile?.instagram_handle ||
    !!profile?.tiktok_handle ||
    !!profile?.spotify_url ||
    !!profile?.soundcloud_url;

  const tasteTags = profile?.taste_tags ?? [];
  const displayName = profile?.display_name || profile?.username || 'Voice';

  /** Profile owner or admin — can see the private Media Kit layer */
  const isPrivileged =
    (user?.id != null && user.id === profile?.user_id) ||
    !!(userProfile as any)?.is_admin ||
    !!(userProfile as any)?.is_super_admin;

  /** Profile owner — can manage curated lists */
  const isOwner = user?.id != null && user.id === profile?.user_id;

  const handleCreateList = async () => {
    if (!newListName.trim() || !user?.id) return;
    setIsCreating(true);
    try {
      await createCuratedList(user.id, newListName.trim(), newListDesc.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ['curated-lists', id] });
      setShowCreateList(false);
      setNewListName('');
      setNewListDesc('');
    } catch (e) {
      Alert.alert('Errore', 'Impossibile creare la collezione. Riprova.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Loading / not-found states ────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
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
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <HeaderButton onPress={handleBack} icon="arrow-back" />
        </View>
        <View style={styles.centered}>
          <Ionicons name="mic-off-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Profilo Voice non trovato
          </Text>
        </View>
      </View>
    );
  }

  // ── Profile render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Aesthetic backdrop: deep violet → transparent gradient ── */}
      <LinearGradient
        colors={[VOICES_AURA + 'CC', VOICES_AURA + '44', 'transparent']}
        style={[styles.heroGradient, { height: HERO_HEIGHT + insets.top }]}
      />

      {/* ── Top bar (back button) ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <HeaderButton onPress={handleBack} icon="arrow-back" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
      >
        {/* ───────────────────── HEADER ─────────────────────── */}
        <View style={styles.profileHeader}>
          {/* Avatar with Voices Aura ring */}
          <AuraAvatar uri={profile.profile_image_url} />

          {/* Name + badge row */}
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: '#FFFFFF' }]} numberOfLines={1}>
                {displayName}
              </Text>
              <AuthorityBadge />
            </View>

            {profile.username ? (
              <Text style={styles.username}>@{profile.username}</Text>
            ) : null}

            {/* Clout Status Label */}
            {profile.clout_label ? (
              <CloutLabel label={profile.clout_label} />
            ) : null}
          </View>
        </View>

        {/* ───────────────────── BIO ─────────────────────────── */}
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={[styles.bio, { color: colors.textSecondary }]}>
              {profile.bio}
            </Text>
          </View>
        ) : null}

        {/* ───────────────────── AUDIO / SOCIAL CONNECTORS ─────── */}
        {hasSocials ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="link-outline" size={13} color={colors.textMuted} />
              <Text style={styles.sectionLabel}>CONNETTITI</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.socialsRow}
            >
              {profile.instagram_handle ? (
                <SocialConnector
                  icon="logo-instagram"
                  label="Instagram"
                  onPress={handleInstagram}
                  color="#E1306C"
                />
              ) : null}
              {profile.tiktok_handle ? (
                <SocialConnector
                  icon="logo-tiktok"
                  label="TikTok"
                  onPress={handleTikTok}
                  color="#ffffff"
                />
              ) : null}
              {profile.spotify_url ? (
                <SocialConnector
                  icon="musical-notes-outline"
                  label="Spotify"
                  onPress={handleSpotify}
                  color="#1DB954"
                />
              ) : null}
              {profile.soundcloud_url ? (
                <SocialConnector
                  icon="radio-outline"
                  label="SoundCloud"
                  onPress={handleSoundCloud}
                  color="#FF5500"
                />
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {/* ───────────────────── AI TASTE TAGS ─────────────────── */}
        <TasteTagsSection tags={tasteTags} />

        {/* ───────────────────── CURATED LISTS ─────────────────── */}
        <CuratedListsSection
          lists={curatedLists as unknown as VoiceCuratedList[]}
          isOwner={isOwner}
          onPressItem={(list) => router.push(`/voice/curated-list/${list.id}`)}
          onAddList={() => setShowCreateList(true)}
        />

        {/* ───────────────────── ASYMMETRIC IMPACT MATRIX ─────── */}
        <AsymmetricImpactSection
          badges={profile?.voice_badges ?? []}
          momentumText={profile?.momentum_text ?? null}
          urbanImpact={profile?.urban_impact_count ?? null}
          peopleMoved={profile?.people_moved_count ?? null}
          isPrivileged={isPrivileged}
        />

        {/* ───────────────────── PAST NIGHTS CAROUSEL ──────────── */}
        {pastNights.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={styles.sectionLabel}>PAST NIGHTS</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselRow}
            >
              {pastNights.map((entry) => (
                <PastNightItem
                  key={entry.event_id}
                  entry={entry}
                  onPress={() => router.push(`/event/${entry.event_id}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ───────────────────── MEMBER SINCE ──────────────────── */}
        {profile.member_since ? (
          <Text style={[styles.memberSince, { color: colors.textMuted }]}>
            Voice dal{' '}
            {new Date(profile.member_since).toLocaleDateString('it-IT', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Backdrop
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  // ── Navigation
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Profile header
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // ── Voices Aura avatar ring
  auraRingOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: VOICES_AURA,
    alignItems: 'center',
    justifyContent: 'center',
    // Glowing shadow for the aura effect
    shadowColor: VOICES_AURA,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 18,
  },
  auraRingInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    backgroundColor: VOICES_AURA_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Name block
  nameBlock: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  username: {
    fontSize: Typography.base,
    color: 'rgba(255,255,255,0.65)',
  },

  // ── Authority badge
  authorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: VOICES_AURA,
    backgroundColor: VOICES_AURA_DIM,
  },
  authorityBadgeText: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: VOICES_AURA,
    letterSpacing: 0.5,
  },

  // ── Clout label
  cloutPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(139,0,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VOICES_AURA + '80',
  },
  cloutText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: VOICES_AURA,
    letterSpacing: 0.4,
  },

  // ── Section scaffold
  section: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
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

  // ── Bio
  bio: {
    fontSize: Typography.base,
    lineHeight: Typography.base * 1.65,
  },

  // ── Social connectors
  socialsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  socialConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  socialConnectorLabel: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },

  // ── AI Taste Tags
  tasteTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tasteTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: VOICES_AURA_DIM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VOICES_AURA + '60',
  },
  tasteTagText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: VOICES_AURA,
  },

  // ── Past Nights carousel
  carouselRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  pastNightItem: {
    width: 160,
  },
  pastNightThumb: {
    width: 160,
    height: 220,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
  },
  pastNightGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  pastNightInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
    gap: 2,
  },
  pastNightTitle: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: Typography.xs * 1.4,
  },
  pastNightDate: {
    fontSize: Typography.xxs,
    color: 'rgba(255,255,255,0.65)',
  },

  // ── Shared
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
  memberSince: {
    fontSize: Typography.sm,
    textAlign: 'center',
    paddingBottom: Spacing.md,
  },
});

const badgeStyles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BADGE_GOLD + '60',
  },
  pillText: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: BADGE_GOLD,
    letterSpacing: 0.3,
  },
  momentumPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  momentumText: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '500',
  },
  mediaKitCard: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(139,0,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VOICES_AURA + '40',
    gap: Spacing.sm,
  },
  mediaKitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  mediaKitTitle: {
    fontSize: Typography.xs,
    fontWeight: '700',
    color: VOICES_AURA,
    letterSpacing: 0.9,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: VOICES_AURA_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    flex: 1,
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.70)',
  },
  statValue: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const curatedStyles = StyleSheet.create({
  tile: {
    width: 140,
    marginRight: Spacing.md,
  },
  tileCover: {
    width: 140,
    height: 160,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: VOICES_AURA_DIM,
  },
  tileCoverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VOICES_AURA_DIM,
  },
  tileGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  tileLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  tileName: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: Typography.sm * 1.3,
  },
  tilesRow: {
    paddingBottom: Spacing.xs,
  },
  addTile: {
    width: 100,
    height: 160,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VOICES_AURA + '60',
    backgroundColor: VOICES_AURA_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginRight: Spacing.md,
  },
  addTileText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: VOICES_AURA,
  },
  addBtn: {
    marginLeft: 'auto' as any,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: VOICES_AURA_DIM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VOICES_AURA + '60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCreate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VOICES_AURA + '60',
    backgroundColor: VOICES_AURA_DIM,
    alignSelf: 'flex-start',
  },
  emptyCreateText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: VOICES_AURA,
  },
});
