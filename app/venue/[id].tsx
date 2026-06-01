import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { fetchVenueById, fetchVenueEvents, fetchVenueCollaborators } from '@/services/venues';
import { fetchOrganizerById } from '@/services/organizers';
import { fetchVibeNotesByVenue, createVibeNote } from '@/services/voices';
import { Colors, Spacing, BorderRadius, Typography, Magenta } from '@/constants/theme';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';
import { EventCard } from '@/components/events/EventCard';
import { MapSection } from '@/components/maps/MapSection';
import { VibeNoteBubble } from '@/components/ui/VibeNoteBubble';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { useAuthStore } from '@/stores/authStore';
import { showAlert } from '@/utils/alert';

const HERO_HEIGHT = 280;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

/** Pulsing Crowdia Halo ring — only animates when isActive */
function HaloRing({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (!isActive) {
      opacity.setValue(0);
      pulse.setValue(1);
      return;
    }
    opacity.setValue(1);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isActive, pulse, opacity]);

  return (
    <Animated.View
      style={[
        styles.haloRing,
        isActive && styles.haloActive,
        { transform: [{ scale: pulse }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Horizontal gallery of atmospheric venue photos */
function AmbientGallery({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={urls}
      keyExtractor={(item, i) => `${item}-${i}`}
      contentContainerStyle={styles.galleryList}
      renderItem={({ item }) => (
        <Image
          source={{ uri: item }}
          style={styles.galleryImage}
          contentFit="cover"
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function VenueProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const userLocation = useEventsFilterStore((s) => s.userLocation);
  const [avatarError, setAvatarError] = useState(false);

  const { user, userProfile } = useAuthStore();
  // Show edit button for super-admins and regular admins
  const canEdit = !!((userProfile as any)?.is_super_admin || userProfile?.is_admin);

  const [showVibeNoteModal, setShowVibeNoteModal] = useState(false);
  const [vibeNoteText, setVibeNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

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

  const { data: collaborators = [] } = useQuery({
    queryKey: ['venue-collaborators', id],
    queryFn: () => fetchVenueCollaborators(id!),
    enabled: !!id,
  });

  const { data: vibeNotes = [], refetch: refetchVibeNotes } = useQuery({
    queryKey: ['venue-vibe-notes', id],
    queryFn: () => fetchVibeNotesByVenue(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const organizerMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of collaborators) {
      map[c.organizer.id] = c.organizer.organization_name ?? '';
    }
    return map;
  }, [collaborators]);

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

  // Avatar: prefer venue's own image_url (hero image doubles as venue identity visual),
  // fall back to the managing organizer's logo if present.
  const avatarUri = (!avatarError && (venue?.image_url || organizer?.logo_url)) || null;

  const outdoor = isOutdoorType(venue?.venue_type ?? null);

  // Ambient gallery: use gallery_urls if populated (post-migration), else empty.
  const galleryUrls: string[] = useMemo(() => {
    if (!venue) return [];
    const raw = (venue as any).gallery_urls;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return [];
  }, [venue]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

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

  const handleSubmitVibeNote = async () => {
    if (!user?.id || !id) return;
    const trimmed = vibeNoteText.trim();
    if (!trimmed) return;
    setIsSubmittingNote(true);
    try {
      await createVibeNote(user.id, trimmed, { locationId: id });
      setVibeNoteText('');
      setShowVibeNoteModal(false);
      refetchVibeNotes();
    } catch (err: any) {
      showAlert('Errore', err?.message ?? 'Impossibile salvare la nota.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // -------------------------------------------------------------------------
  // Hero element (shared between loading / error / full views)
  // -------------------------------------------------------------------------

  const heroEl = (
    <View style={[styles.heroContainer, { height: HERO_HEIGHT + insets.top }]}>
      {/* Atmospheric backdrop — use first gallery image if available, else cover image */}
      {(galleryUrls[0] || venue?.image_url) ? (
        <Image
          source={{ uri: galleryUrls[0] ?? venue?.image_url ?? '' }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={Platform.OS === 'web' ? 0 : 2}
        />
      ) : null}
      {/* Fade-to-dark gradient */}
      <LinearGradient
        colors={
          (galleryUrls[0] || venue?.image_url)
            ? (['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', colors.background] as any)
            : (['#080808', '#121212', '#1c1c1c', colors.background] as any)
        }
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Header row: back + optional edit */}
      <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.sm }]}>
        <HeaderButton onPress={handleBack} icon="arrow-back" />
        {canEdit && venue && (
          <HeaderButton
            onPress={() => router.push(`/admin/spaces/${id}`)}
            icon="pencil"
          />
        )}
      </View>
      {/* Centered circular avatar with Crowdia Halo */}
      {venue && (
        <View style={styles.avatarWrapper}>
          <HaloRing isActive={isLiveNow}>
            <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  contentFit="contain"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: Magenta[500] + '1a' }]}>
                  <Ionicons name="location-sharp" size={36} color={Magenta[500]} />
                </View>
              )}
            </View>
          </HaloRing>
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

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

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
          <Text style={[styles.errorTitle, { color: colors.text }]}>Venue non trovato</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Questo profilo potrebbe essere stato rimosso.
          </Text>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Amenities — build list from available fields
  // -------------------------------------------------------------------------

  type AmenityEntry = { icon: string; label: string };
  const amenities: AmenityEntry[] = [
    {
      icon: outdoor ? 'partly-sunny-outline' : 'home-outline',
      label: outdoor ? "All'aperto" : 'Al chiuso',
    },
  ];
  // Fields from the future migration — cast through any so existing DB rows
  // (which return undefined/null) degrade gracefully.
  const vAny = venue as any;
  if (vAny.has_accessibility) amenities.push({ icon: 'accessibility-outline', label: 'Accesso Disabili' });
  if (vAny.has_parking) amenities.push({ icon: 'car-outline', label: 'Parcheggio Privato' });
  if (vAny.has_smoking_area) amenities.push({ icon: 'flame-outline', label: 'Area Fumatori' });
  if (vAny.has_wardrobe) amenities.push({ icon: 'shirt-outline', label: 'Guardaroba' });
  if (vAny.has_internal_food) amenities.push({ icon: 'restaurant-outline', label: 'Cucina/Food interna' });
  if (venue.seasonality) amenities.push({ icon: 'calendar-outline', label: venue.seasonality });

  // -------------------------------------------------------------------------
  // Full profile render
  // -------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxxl }}
      >
        {heroEl}

        {/* ── Name + Authority Badge ────────────────────────────────────── */}
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

        {/* ── B2B CTA for unverified listings ───────────────────────────── */}
        {!isVerified && (
          <View style={[styles.b2bCard, { backgroundColor: colors.card }]}>
            <Ionicons name="business-outline" size={20} color={Magenta[500]} style={{ marginTop: 1 }} />
            <Text style={[styles.b2bText, { color: colors.textSecondary }]} numberOfLines={5}>
              {'Sei il proprietario di '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>{venue.name}</Text>
              {'? Attiva la gestione di questo profilo con i suoi eventi e sblocca gli analytics.'}
            </Text>
          </View>
        )}

        {/* ── Live status + distance + address row ──────────────────────── */}
        <View style={[styles.statusRow, { backgroundColor: colors.card }]}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isLiveNow ? '#22c55e' : colors.textMuted },
              ]}
            />
            <Text
              style={[
                styles.statusLabel,
                { color: isLiveNow ? '#22c55e' : colors.textSecondary },
              ]}
            >
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
                  style={[
                    styles.statusLabel,
                    styles.statusAddressText,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {venue.address}
                </Text>
                <Ionicons name="open-outline" size={11} color={colors.textMuted} />
              </Pressable>
            </>
          ) : null}
        </View>

        {/* ── Managing organizer link (verified spaces only) ────────────── */}
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

        {/* ── Website ───────────────────────────────────────────────────── */}
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
            <Text
              style={[styles.infoText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {venue.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </Text>
            <Ionicons name="open-outline" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* ── Venue description ─────────────────────────────────────────── */}
        {vAny.description ? (
          <View style={[styles.descriptionCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {vAny.description}
            </Text>
          </View>
        ) : null}

        {/* ── Structural Amenities grid ─────────────────────────────────── */}
        <View style={[styles.amenitiesCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textMuted }]}>CARATTERISTICHE</Text>
          <View style={styles.amenitiesGrid}>
            {amenities.map((a) => (
              <AmenityChip key={a.label} icon={a.icon} label={a.label} />
            ))}
          </View>
        </View>

        {/* ── Dominant map module ───────────────────────────────────────── */}
        <View style={styles.mapWrapper}>
          <MapSection
            latitude={venue.lat}
            longitude={venue.lng}
            locationName={venue.name}
            colorScheme={colorScheme}
            onPress={handleOpenMaps}
          />
        </View>

        {/* ── Ambient Gallery (horizontal media grid) ───────────────────── */}
        {galleryUrls.length > 0 && (
          <View style={styles.gallerySection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Galleria</Text>
            <AmbientGallery urls={galleryUrls} />
          </View>
        )}

        {/* ── Frequent Collaborators carousel ──────────────────────────── */}
        {collaborators.length > 1 && (
          <View style={styles.collaboratorsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Collaboratori frequenti
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={collaborators}
              keyExtractor={(item) => item.organizer.id}
              contentContainerStyle={styles.collaboratorsList}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.collaboratorItem,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push(`/organizer/${item.organizer.id}`)}
                >
                  <View style={[styles.collaboratorAvatar, { backgroundColor: colors.card }]}>
                    {item.organizer.logo_url ? (
                      <Image
                        source={{ uri: item.organizer.logo_url }}
                        style={styles.collaboratorAvatarImage}
                        contentFit="cover"
                      />
                    ) : (
                      <Ionicons
                        name="business-outline"
                        size={22}
                        color={colors.textSecondary}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.collaboratorName, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.organizer.organization_name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* ── Vibe Notes by Voices ──────────────────────────────────────── */}
        {(vibeNotes.length > 0 || (userProfile as any)?.is_voice) ? (
          <View style={styles.section}>
            <View style={styles.vibeNotesHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Note dei Voices</Text>
              {(userProfile as any)?.is_voice ? (
                <Pressable
                  style={({ pressed }) => [styles.addNoteButton, { borderColor: Magenta[500] }, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowVibeNoteModal(true)}
                >
                  <Ionicons name="add" size={16} color={Magenta[500]} />
                  <Text style={[styles.addNoteText, { color: Magenta[500] }]}>Aggiungi</Text>
                </Pressable>
              ) : null}
            </View>
            {vibeNotes.map((note) => (
              <VibeNoteBubble key={note.id} note={note} />
            ))}
            {vibeNotes.length === 0 ? (
              <Text style={[styles.emptyNotesText, { color: colors.textSecondary }]}>
                Sii il primo a lasciare una nota su questo spazio.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Integrated Event Feed ─────────────────────────────────────── */}
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
            events.map((event) => {
              // Dual-label logic: any event at this venue gets "Ospitato da [Venue]"
              // If also produced by an external collective, add "• Organizzato da [Organizer]"
              const externalOrganizerId =
                event.organizer_id && event.organizer_id !== venue.operator_org_id
                  ? event.organizer_id
                  : null;
              const externalOrganizerName = externalOrganizerId
                ? organizerMap[externalOrganizerId]
                : null;

              return (
                <View key={event.id}>
                  {/* Dual hosting label */}
                  <View style={[styles.hostingTag, { backgroundColor: colors.card }]}>
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[styles.hostingTagText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      <Text>{'Ospitato da '}</Text>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>
                        {venue.name}
                      </Text>
                      {externalOrganizerName ? (
                        <>
                          <Text>{' • Organizzato da '}</Text>
                          <Pressable
                            onPress={() =>
                              router.push(`/organizer/${externalOrganizerId}`)
                            }
                          >
                            <Text style={{ color: Magenta[500], fontWeight: '600' }}>
                              {externalOrganizerName}
                            </Text>
                          </Pressable>
                        </>
                      ) : null}
                    </Text>
                  </View>
                  <EventCard
                    event={event}
                    onPress={() => router.push(`/event/${event.id}`)}
                  />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Vibe Note compose modal */}
      <Modal
        visible={showVibeNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVibeNoteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowVibeNoteModal(false)} />
          <View style={[styles.vibeNoteModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.vibeNoteModalTitle, { color: colors.text }]}>Aggiungi una nota</Text>
            <TextInput
              style={[styles.vibeNoteInput, { color: colors.text, borderColor: colors.divider, backgroundColor: colors.background }]}
              placeholder="Cosa rende speciale questo spazio? (max 150 caratteri)"
              placeholderTextColor={colors.textMuted}
              value={vibeNoteText}
              onChangeText={(t) => setVibeNoteText(t.slice(0, 150))}
              multiline
              maxLength={150}
              autoFocus
            />
            <Text style={[styles.vibeNoteCharCount, { color: colors.textMuted }]}>{vibeNoteText.length}/150</Text>
            <View style={styles.vibeNoteActions}>
              <Pressable
                style={({ pressed }) => [styles.vibeNoteCancelBtn, { borderColor: colors.divider }, pressed && { opacity: 0.7 }]}
                onPress={() => { setShowVibeNoteModal(false); setVibeNoteText(''); }}
              >
                <Text style={[styles.vibeNoteCancelText, { color: colors.textSecondary }]}>Annulla</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.vibeNoteSubmitBtn, { backgroundColor: Magenta[500] }, pressed && { opacity: 0.85 }, (!vibeNoteText.trim() || isSubmittingNote) && { opacity: 0.5 }]}
                onPress={handleSubmitVibeNote}
                disabled={!vibeNoteText.trim() || isSubmittingNote}
              >
                <Text style={styles.vibeNoteSubmitText}>Pubblica</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Hero
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
  // Avatar / halo
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
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 16,
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
  // Loading / error
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
  // Name / badge
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
  // B2B CTA
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
  // Status row
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
  // Info rows
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
  // Description
  descriptionCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  descriptionText: {
    fontSize: Typography.sm,
    lineHeight: 22,
  },
  // Amenities
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
  // Map
  mapWrapper: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  // Ambient Gallery
  gallerySection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  galleryList: {
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  galleryImage: {
    width: 200,
    height: 140,
    borderRadius: BorderRadius.lg,
  },
  // Collaborators
  collaboratorsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  collaboratorsList: {
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  collaboratorItem: {
    alignItems: 'center',
    width: 72,
  },
  collaboratorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  collaboratorAvatarImage: {
    width: '100%',
    height: '100%',
  },
  collaboratorName: {
    fontSize: Typography.xxs,
    textAlign: 'center',
    lineHeight: 14,
  },
  // Events
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
  // Hosting dual-label tag
  hostingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    marginBottom: 2,
  },
  hostingTagText: {
    fontSize: Typography.xs,
    flex: 1,
  },
  // Shared
  pressed: {
    opacity: 0.7,
  },
  // Vibe Notes
  section: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  vibeNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  addNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  addNoteText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  emptyNotesText: {
    fontSize: Typography.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  vibeNoteModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  vibeNoteModalTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  vibeNoteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 80,
    fontSize: Typography.base,
    textAlignVertical: 'top',
  },
  vibeNoteCharCount: {
    fontSize: Typography.xs,
    textAlign: 'right',
  },
  vibeNoteActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  vibeNoteCancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  vibeNoteCancelText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  vibeNoteSubmitBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 80,
    alignItems: 'center',
  },
  vibeNoteSubmitText: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: '#fff',
  },
});
