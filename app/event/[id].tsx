import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  useColorScheme,
  Linking,
  Share,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { showAlert } from '@/utils/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { fetchEventById, fetchRelatedEvents, getSimilarEvents } from '@/services/events';
import { fetchOrganizerById } from '@/services/organizers';
import { getVoicesByEventId, fetchVibeNotesByEvent, createVibeNote } from '@/services/voices';
import { VibeNoteBubble } from '@/components/ui/VibeNoteBubble';
import { trackAffiliateClick } from '@/services/affiliate';
import { trackEvent } from '@/utils/analytics';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, Typography, Magenta, Green, Blue } from '@/constants/theme';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { CategoryImagePlaceholder } from '@/components/ui/CategoryImagePlaceholder';
import { VibeTagsRow } from '@/components/ui/VibeTagPill';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { MapSection } from '@/components/maps/MapSection';
import { formatLocationAddress, hasPreciseLocation } from '@/utils/locationDisplay';
import { useInterestsStore } from '@/stores/interestsStore';
import { useAuthStore } from '@/stores/authStore';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';
import { StaticGlowLogo } from '@/components/ui/glowing-logo';

const SPOTLIGHT_HEIGHT = 480;

const EVENT_TIMEZONE = 'Europe/Rome';

// Palermo coordinates for weather API
const PALERMO_LAT = 38.1157;
const PALERMO_LNG = 13.3615;

const formatFullDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    weekday: date.toLocaleDateString('it-IT', { weekday: 'long', timeZone: EVENT_TIMEZONE }),
    date: date.toLocaleDateString('it-IT', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: EVENT_TIMEZONE,
    }),
    time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: EVENT_TIMEZONE }),
    day: parseInt(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: EVENT_TIMEZONE }), 10),
    month: date.toLocaleDateString('it-IT', { month: 'short', timeZone: EVENT_TIMEZONE }).toUpperCase(),
    isoDate: date.toLocaleDateString('en-CA', { timeZone: EVENT_TIMEZONE }),
  };
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function wmoToLabel(code: number): string {
  if (code === 0) return '☀️ Sereno';
  if (code <= 2) return '🌤️ Poco nuvoloso';
  if (code === 3) return '☁️ Nuvoloso';
  if (code <= 48) return '🌫️ Nebbia';
  if (code <= 67) return '🌧️ Pioggia';
  if (code <= 77) return '🌨️ Neve';
  if (code <= 82) return '🌦️ Rovesci';
  if (code <= 99) return '⛈️ Temporale';
  return '🌡️';
}

function getVelocityLabel(interested: number, checkIns: number): string | null {
  const total = (interested ?? 0) + (checkIns ?? 0);
  if (total >= 100) return '🔥 In Tendenza a Palermo';
  if (total >= 50) return '🔥 Alta Richiesta';
  if (total >= 20) return '⚡ Evento Popolare';
  if (total >= 5) return `${total} persone interessate`;
  return null;
}

const numberFormatter = new Intl.NumberFormat();

const CHECK_IN_POINTS = 25;

function isEventTodayOrOngoing(startTime: string, endTime?: string | null): boolean {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;
  if (end && now >= start && now <= end) return true;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(start) === fmt.format(now);
}

function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    return display.length > 40 ? display.substring(0, 37) + '...' : display;
  } catch {
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
  }
}

function SimilarEventCard({ event, onPress }: { event: { id: string | null; title: string | null; cover_image_url: string | null; category_slug: string | null; event_start_time: string | null; location_name: string | null }; onPress: () => void }) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const [imageError, setImageError] = useState(false);
  const imageUrl = getProxiedImageUrl(event.cover_image_url);
  const hasValidImage = !!imageUrl && !imageError;
  const simDate = event.event_start_time ? formatFullDate(event.event_start_time) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.similarCard, { backgroundColor: colors.card }, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      {hasValidImage ? (
        <Image source={{ uri: imageUrl }} style={styles.similarCardImage} contentFit="cover" transition={200} onError={() => setImageError(true)} />
      ) : (
        <CategoryImagePlaceholder categorySlug={event.category_slug} style={styles.similarCardImage} iconSize={28} />
      )}
      <View style={styles.similarCardContent}>
        <Text style={[styles.similarCardTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
        {simDate ? (
          <Text style={[styles.similarCardMeta, { color: colors.textSecondary }]}>
            {simDate.weekday.slice(0, 3)} {simDate.day} {simDate.month}
          </Text>
        ) : null}
        {event.location_name ? (
          <Text style={[styles.similarCardMeta, { color: colors.textMuted }]} numberOfLines={1}>{event.location_name}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function HeaderButton({ onPress, icon, size = 24 }: { onPress: () => void; icon: string; size?: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={size} color="#fff" />
    </Pressable>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { user, userProfile, refreshProfile } = useAuthStore();
  const { isInterested, toggleInterest } = useInterestsStore();
  const interested = isInterested(id!);
  const queryClient = useQueryClient();
  const userLocation = useEventsFilterStore((s) => s.userLocation);

  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showVibeNoteModal, setShowVibeNoteModal] = useState(false);
  const [vibeNoteText, setVibeNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEventById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (event?.id) trackEvent('event_view', { event_id: event.id });
  }, [event?.id]);

  const { data: voices } = useQuery({
    queryKey: ['event-voices', id],
    queryFn: () => getVoicesByEventId(id!),
    enabled: !!id && (event?.voice_count ?? 0) > 0,
    staleTime: 60_000,
  });

  const { data: relatedEvents } = useQuery({
    queryKey: ['event-related', id, event?.title, event?.organizer_id, event?.location_id],
    queryFn: () => fetchRelatedEvents(event!.title!, event!.organizer_id ?? null, event!.location_id ?? null, id!),
    enabled: !!event?.title && (event?.series_count ?? 0) > 0,
    staleTime: 5 * 60_000,
  });

  const { data: similarEvents, isLoading: isSimilarLoading } = useQuery({
    queryKey: ['event-similar', id],
    queryFn: () => getSimilarEvents(id!, 3),
    enabled: !!event?.id,
    staleTime: 10 * 60_000,
  });

  const { data: organizer } = useQuery({
    queryKey: ['organizer', event?.organizer_id],
    queryFn: () => fetchOrganizerById(event!.organizer_id!),
    enabled: !!event?.organizer_id,
  });

  const { data: vibeNotes = [], refetch: refetchVibeNotes } = useQuery({
    queryKey: ['event-vibe-notes', id],
    queryFn: () => fetchVibeNotesByEvent(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  // Weather chip: fetch for events within next 7 days
  const shouldFetchWeather = useMemo(() => {
    if (!event?.event_start_time) return false;
    const eventDate = new Date(event.event_start_time);
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return eventDate >= now && eventDate <= sevenDaysOut;
  }, [event?.event_start_time]);

  const { data: weatherData } = useQuery({
    queryKey: ['weather-palermo', event?.event_start_time],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${PALERMO_LAT}&longitude=${PALERMO_LNG}&daily=weathercode,temperature_2m_max&timezone=Europe%2FRome&forecast_days=7`
      );
      const data = await res.json();
      const eventIsoDate = new Date(event!.event_start_time!).toLocaleDateString('en-CA', { timeZone: EVENT_TIMEZONE });
      const idx = (data.daily?.time ?? []).indexOf(eventIsoDate);
      if (idx === -1) return null;
      return {
        temp: Math.round(data.daily.temperature_2m_max[idx]),
        code: data.daily.weathercode[idx] as number,
      };
    },
    enabled: shouldFetchWeather && !!event?.id,
    staleTime: 60 * 60_000,
  });

  const { data: existingCheckIn, refetch: refetchCheckIn } = useQuery({
    queryKey: ['check-in', id, user?.id],
    queryFn: async () => {
      if (!user?.id || !id) return null;
      const { data } = await supabase
        .from('event_check_ins')
        .select('id, checked_in_at')
        .eq('event_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!id,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !id) throw new Error('Must be signed in to check in');
      const { error } = await supabase
        .from('event_check_ins')
        .insert({
          user_id: user.id,
          event_id: id,
          checked_in_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refetchCheckIn();
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      await refreshProfile();
    },
  });

  const imageUrl = getProxiedImageUrl(event?.cover_image_url);
  const [imageError, setImageError] = useState(false);
  const hasValidImage = !!imageUrl && !imageError;

  const handleInterested = useCallback(() => {
    if (!user || !id) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleInterest(user.id, id, event ?? undefined);
  }, [user, id, toggleInterest, event]);

  const handleBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleShare = async () => {
    if (!event) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: event.title ?? undefined,
        message: `Check out ${event.title ?? 'this event'} on Crowdia!\n\n${event.event_url || ''}`,
        url: event.event_url || undefined,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleGetTickets = () => {
    if (!event?.external_ticket_url) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackAffiliateClick({
      userId: user?.id ?? null,
      eventId: event.id!,
      url: event.external_ticket_url,
      clickType: 'ticket',
    });
    Linking.openURL(event.external_ticket_url);
  };

  const handleOpenMaps = () => {
    if (!event?.location_lat || !event?.location_lng) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'web') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${event.location_lat},${event.location_lng}`, '_blank');
      return;
    }
    const url = Platform.select({
      ios: `maps:?q=${event.location_name}&ll=${event.location_lat},${event.location_lng}`,
      android: `geo:${event.location_lat},${event.location_lng}?q=${event.location_name}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleOpenEventLink = useCallback((url: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (event?.id) {
      trackAffiliateClick({ userId: user?.id ?? null, eventId: event.id, url, clickType: 'event_url' });
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, [event?.id, user?.id]);

  const handleAddToCalendar = useCallback(() => {
    if (!event?.event_start_time) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toGcalDate = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
    const start = toGcalDate(event.event_start_time);
    const end = event.event_end_time ? toGcalDate(event.event_end_time) : start;
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title ?? '')}&dates=${start}/${end}&location=${encodeURIComponent(event.location_name ?? '')}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, [event]);

  const handleCheckIn = async () => {
    if (!user) {
      showAlert('Accesso richiesto', 'Devi essere registrato per fare il check-in agli eventi.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await checkInMutation.mutateAsync();
      showAlert('Check-in effettuato!', `Hai guadagnato ${CHECK_IN_POINTS} punti.`, [{ text: 'Ottimo!', style: 'default' }]);
    } catch (err: any) {
      if (err?.code === '23505') {
        showAlert('Già effettuato', 'Hai già fatto il check-in per questo evento.');
      } else {
        showAlert('Check-in fallito', err?.message ?? 'Qualcosa è andato storto. Riprova.');
      }
    }
  };

  const handleSubmitVibeNote = async () => {
    if (!user?.id || !id) return;
    const trimmed = vibeNoteText.trim();
    if (!trimmed) return;
    setIsSubmittingNote(true);
    try {
      await createVibeNote(user.id, trimmed, { eventId: id });
      setVibeNoteText('');
      setShowVibeNoteModal(false);
      refetchVibeNotes();
    } catch (err: any) {
      showAlert('Errore', err?.message ?? 'Impossibile salvare la nota.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <StaticGlowLogo size={60} />
        </View>
      </View>
    );
  }

  if (isError || !event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <HeaderButton onPress={handleBack} icon="arrow-back" />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>:/</Text>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Evento non trovato</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            L'evento potrebbe essere stato rimosso o non è più disponibile.
          </Text>
        </View>
      </View>
    );
  }

  const dateInfo = formatFullDate(event.event_start_time ?? new Date().toISOString());
  const hasLocation = hasPreciseLocation(event.location_lat, event.location_lng, event.location_address);
  const displayAddress = formatLocationAddress(event.location_address, event.location_lat, event.location_lng);
  const externalUrl = event.external_ticket_url || event.event_url || null;

  const canCheckIn = isEventTodayOrOngoing(event.event_start_time ?? new Date().toISOString(), event.event_end_time);
  const hasCheckedIn = !!existingCheckIn;
  const isCheckingIn = checkInMutation.isPending;

  const velocityLabel = getVelocityLabel(event.interested_count ?? 0, event.check_ins_count ?? 0);

  const venueDistanceLabel = useMemo(() => {
    if (!userLocation || !event?.location_lat || !event?.location_lng) return null;
    const km = haversineKm(userLocation.latitude, userLocation.longitude, event.location_lat, event.location_lng);
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }, [userLocation, event?.location_lat, event?.location_lng]);

  const hasLongDescription = (event.description?.length ?? 0) > 200;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Glassmorphism Vibe Spotlight Hero */}
        <View style={styles.vibeSpotlight}>
          {/* Blurred backdrop */}
          {hasValidImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={[StyleSheet.absoluteFill, styles.spotlightBackdrop]}
              contentFit="cover"
              blurRadius={Platform.OS !== 'web' ? 35 : 0}
            />
          ) : (
            <CategoryImagePlaceholder categorySlug={event?.category_slug} style={StyleSheet.absoluteFillObject} iconSize={100} />
          )}
          {/* Web fallback: duplicate image with CSS blur */}
          {Platform.OS === 'web' && hasValidImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={[StyleSheet.absoluteFill, styles.webBlurBackdrop] as any}
              contentFit="cover"
            />
          ) : null}
          {/* Dark overlay */}
          <View style={[StyleSheet.absoluteFill, styles.spotlightOverlay]} />
          {/* Floating poster */}
          <View style={[styles.posterWrapper, { paddingTop: insets.top + 56 }]}>
            {hasValidImage ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.floatingPoster}
                contentFit="contain"
                transition={300}
                onError={() => setImageError(true)}
              />
            ) : (
              <CategoryImagePlaceholder categorySlug={event?.category_slug} style={styles.floatingPoster} iconSize={80} />
            )}
          </View>
          {/* Header buttons overlay */}
          <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
            <HeaderButton onPress={handleBack} icon="arrow-back" />
            <HeaderButton onPress={handleShare} icon="share-outline" size={22} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {/* Date Badge and Category */}
          <View style={styles.badgeRow}>
            <View style={[styles.dateBadge, { backgroundColor: Magenta[500] }]}>
              <Text style={styles.dateBadgeDay}>{dateInfo.day}</Text>
              <Text style={styles.dateBadgeMonth}>{dateInfo.month}</Text>
            </View>
            <CategoryBadge categoryName={event.category_name} categorySlug={event.category_slug} size="medium" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>

          {/* Vibe Tags */}
          {event.vibe_tags && event.vibe_tags.length > 0 ? (
            <View style={styles.vibeTagsRow}>
              <VibeTagsRow tags={event.vibe_tags} maxTags={5} />
            </View>
          ) : null}

          {/* Velocity Social Proof */}
          {velocityLabel ? (
            <View style={styles.velocityChip}>
              <Text style={[styles.velocityText, { color: Magenta[500] }]}>{velocityLabel}</Text>
            </View>
          ) : null}

          {/* Date & Time with weather chip */}
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                <Ionicons name="calendar-outline" size={20} color={Magenta[500]} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  {dateInfo.weekday.charAt(0).toUpperCase() + dateInfo.weekday.slice(1)}, {dateInfo.date}
                </Text>
                <View style={styles.timeRow}>
                  <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]}>
                    {dateInfo.time}
                    {event.event_end_time ? ` – ${formatFullDate(event.event_end_time).time}` : null}
                  </Text>
                  {weatherData ? (
                    <View style={[styles.weatherChip, { backgroundColor: colors.background }]}>
                      <Text style={[styles.weatherText, { color: colors.textSecondary }]}>
                        {weatherData.temp}°C · {wmoToLabel(weatherData.code)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* Other dates in series */}
          {relatedEvents && relatedEvents.length > 0 ? (
            <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                  <Ionicons name="calendar" size={20} color={Magenta[500]} />
                </View>
                <Text style={[styles.infoLabel, { color: colors.text }]}>Altre date</Text>
              </View>
              <View style={styles.otherDatesRow}>
                {relatedEvents.map((rel) => {
                  const d = formatFullDate(rel.event_start_time ?? new Date().toISOString());
                  return (
                    <Pressable
                      key={rel.id}
                      style={({ pressed }) => [
                        styles.datePill,
                        { backgroundColor: Magenta[500] + '15', borderColor: Magenta[500] + '40' },
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => router.push(`/event/${rel.id}`)}
                    >
                      <Text style={[styles.datePillText, { color: Magenta[500] }]}>
                        {d.weekday.slice(0, 3)} · {d.date.split(' ').slice(0, 2).join(' ')}
                      </Text>
                      <Text style={[styles.datePillTime, { color: colors.textSecondary }]}>{d.time}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Location */}
          <Pressable
            style={[styles.infoCard, { backgroundColor: colors.card }]}
            onPress={handleOpenMaps}
          >
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                <Ionicons name="location-outline" size={20} color={Magenta[500]} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>{event.location_name}</Text>
                {displayAddress ? (
                  <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {displayAddress}
                  </Text>
                ) : null}
              </View>
              {hasLocation ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null}
            </View>
          </Pressable>

          {/* Space Connector Card */}
          {event.location_id ? (
            <Pressable
              style={({ pressed }) => [styles.connectorCard, { backgroundColor: colors.card }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/venue/${event.location_id}`)}
            >
              <View style={[styles.connectorIconBox, { backgroundColor: Blue[500] + '20' }]}>
                <Ionicons name="business" size={20} color={Blue[500]} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.connectorLabel, { color: colors.textSecondary }]}>SPAZIO</Text>
                <Text style={[styles.infoLabel, { color: colors.text }]} numberOfLines={1}>
                  {event.location_name ?? 'Venue'}
                </Text>
                {venueDistanceLabel ? (
                  <Text style={[styles.infoSubLabel, { color: Blue[500] }]}>{venueDistanceLabel} da te</Text>
                ) : (
                  <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]}>Vedi profilo spazio</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* Organizer Connector Card */}
          {organizer ? (
            <Pressable
              style={({ pressed }) => [styles.connectorCard, { backgroundColor: colors.card }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/organizer/${organizer.id}`)}
            >
              <View style={[styles.connectorIconBox, { backgroundColor: Magenta[500] + '20', overflow: 'hidden' }]}>
                {organizer.logo_url ? (
                  <Image source={{ uri: organizer.logo_url }} style={{ width: 40, height: 40 }} contentFit="contain" />
                ) : (
                  <Ionicons name="mic" size={20} color={Magenta[500]} />
                )}
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.connectorLabel, { color: colors.textSecondary }]}>
                  {organizer.is_verified ? 'ORGANIZZATORE VERIFICATO' : 'ORGANIZZATORE'}
                </Text>
                <Text style={[styles.infoLabel, { color: colors.text }]} numberOfLines={1}>
                  {organizer.organization_name}
                </Text>
                <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]}>Vedi profilo organizzatore</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {/* Event Link */}
          {externalUrl ? (
            <Pressable
              style={({ pressed }) => [styles.infoCard, { backgroundColor: colors.card }, pressed && { opacity: 0.85 }]}
              onPress={() => handleOpenEventLink(externalUrl)}
            >
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                  <Ionicons name="link-outline" size={20} color={Magenta[500]} />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>
                    {event.external_ticket_url ? 'Biglietti' : 'Pagina evento'}
                  </Text>
                  <Text style={[styles.infoSubLabel, { color: Magenta[500], textDecorationLine: 'underline' }]} numberOfLines={1}>
                    {displayUrl(externalUrl)}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}

          {/* Expandable Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Info</Text>
              <Text
                style={[styles.description, { color: colors.textSecondary }]}
                numberOfLines={showFullDesc || !hasLongDescription ? undefined : 3}
              >
                {event.description}
              </Text>
              {hasLongDescription ? (
                <Pressable onPress={() => setShowFullDesc(!showFullDesc)} style={styles.readMoreButton}>
                  <Text style={[styles.readMoreText, { color: Magenta[500] }]}>
                    {showFullDesc ? 'Mostra meno' : 'Leggi di più'}
                  </Text>
                  <Ionicons name={showFullDesc ? 'chevron-up' : 'chevron-down'} size={14} color={Magenta[500]} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Map */}
          {hasLocation ? (
            <MapSection
              latitude={event.location_lat!}
              longitude={event.location_lng!}
              locationName={event.location_name ?? ''}
              colorScheme={colorScheme}
              onPress={handleOpenMaps}
            />
          ) : null}

          {/* Voices attending */}
          {(event.voice_count ?? 0) > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.infoCard, { backgroundColor: colors.card }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/voices/${id}`)}
            >
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: Magenta[500] + '20' }]}>
                  <Ionicons name="mic" size={20} color={Magenta[500]} />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>
                    {event.voice_count} {(event.voice_count ?? 0) === 1 ? 'Voice' : 'Voices'} attending
                  </Text>
                  {voices && voices.length > 0 ? (
                    <View style={styles.voiceAvatarRow}>
                      {voices.slice(0, 4).map((v) => (
                        v.user?.profile_image_url ? (
                          <Image key={v.id} source={{ uri: v.user.profile_image_url }} style={styles.voiceAvatar} contentFit="cover" />
                        ) : (
                          <View key={v.id} style={[styles.voiceAvatar, styles.voiceAvatarPlaceholder]}>
                            <Ionicons name="person" size={10} color={Magenta[500]} />
                          </View>
                        )
                      ))}
                      {(event.voice_count ?? 0) > 4 ? (
                        <Text style={[styles.voiceAvatarMore, { color: colors.textSecondary }]}>
                          +{(event.voice_count ?? 0) - 4}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]}>Vedi chi partecipa</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}

          {/* Vibe Notes by Voices */}
          {(vibeNotes.length > 0 || (userProfile as any)?.is_voice) ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
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
                  Sii il primo a lasciare una nota su questo evento.
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Ti piace questo Vibe? — similar events carousel */}
          {isSimilarLoading ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ti piace questo Vibe? 💡</Text>
              <View style={styles.similarSkeletonRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.similarCardSkeleton, { backgroundColor: colors.card }]} />
                ))}
              </View>
            </View>
          ) : similarEvents && similarEvents.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ti piace questo Vibe? 💡</Text>
              <FlatList
                horizontal
                data={similarEvents}
                keyExtractor={(item) => item.id!}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.md }}
                scrollEnabled={similarEvents.length > 1}
                renderItem={({ item: similar }) => (
                  <SimilarEventCard event={similar} onPress={() => router.push(`/event/${similar.id}`)} />
                )}
              />
            </View>
          ) : null}

          {event.source ? (
            <View style={styles.sourceContainer}>
              <Text style={[styles.sourceText, { color: colors.textMuted }]}>Fonte: {event.source}</Text>
            </View>
          ) : null}
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
              placeholder="Cosa rende speciale questo evento? (max 150 caratteri)"
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
                style={({ pressed }) => [
                  styles.vibeNoteSubmitBtn,
                  { backgroundColor: Magenta[500] },
                  pressed && { opacity: 0.8 },
                  (!vibeNoteText.trim() || isSubmittingNote) && { opacity: 0.5 },
                ]}
                onPress={handleSubmitVibeNote}
                disabled={!vibeNoteText.trim() || isSubmittingNote}
              >
                {isSubmittingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.vibeNoteSubmitText}>Pubblica</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sticky Action Dock */}
      <View style={[styles.actionBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + Spacing.md, borderTopColor: colors.divider }]}>
        {canCheckIn ? (
          <Pressable
            style={({ pressed }) => [
              styles.checkInButton,
              hasCheckedIn ? [styles.checkInButtonDone, { borderColor: colors.success }] : { backgroundColor: Green[500] },
              pressed && !hasCheckedIn && styles.buttonPressed,
              (isCheckingIn || hasCheckedIn) && styles.buttonDisabled,
            ]}
            onPress={handleCheckIn}
            disabled={isCheckingIn || hasCheckedIn}
          >
            {isCheckingIn ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name={hasCheckedIn ? 'checkmark-circle' : 'checkmark-circle-outline'} size={20} color={hasCheckedIn ? colors.success : '#fff'} />
                <Text style={[styles.checkInButtonText, hasCheckedIn && { color: colors.success }]}>
                  {hasCheckedIn ? 'Sei qui' : 'Check In'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {user ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              { borderColor: Magenta[500], backgroundColor: interested ? Magenta[500] + '15' : 'transparent' },
              pressed && styles.buttonPressed,
            ]}
            onPress={handleInterested}
          >
            <Ionicons name={interested ? 'heart' : 'heart-outline'} size={22} color={Magenta[500]} />
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.iconButton, { borderColor: colors.divider }, pressed && styles.buttonPressed]}
          onPress={handleAddToCalendar}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
        </Pressable>

        {event.external_ticket_url ? (
          <Pressable
            style={({ pressed }) => [styles.ticketButton, { backgroundColor: Magenta[500] }, pressed && styles.buttonPressed]}
            onPress={handleGetTickets}
          >
            <Ionicons name="ticket-outline" size={20} color="#fff" />
            <Text style={styles.ticketButtonText}>Biglietti</Text>
          </Pressable>
        ) : event.event_url ? (
          <Pressable
            style={({ pressed }) => [styles.ticketButton, { backgroundColor: Magenta[500] }, pressed && styles.buttonPressed]}
            onPress={() => {
              trackAffiliateClick({ userId: user?.id ?? null, eventId: event.id!, url: event.event_url!, clickType: 'event_url' });
              Linking.openURL(event.event_url!);
            }}
          >
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={styles.ticketButtonText}>Vedi evento</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
    color: Magenta[500],
    fontWeight: '700',
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
    lineHeight: Typography.base * 1.5,
  },
  // Vibe Spotlight Hero
  vibeSpotlight: {
    height: SPOTLIGHT_HEIGHT,
    width: '100%',
    backgroundColor: '#111',
    overflow: 'hidden',
    position: 'relative',
  },
  spotlightBackdrop: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.1 }],
  },
  webBlurBackdrop: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.15 }],
    filter: 'blur(30px)',
  },
  spotlightOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  posterWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  floatingPoster: {
    width: '100%',
    maxWidth: 260,
    height: '80%',
    borderRadius: BorderRadius.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.85,
        shadowRadius: 24,
      },
      android: { elevation: 24 },
      default: { boxShadow: '0px 16px 48px rgba(0,0,0,0.8)' } as any,
    }),
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonPressed: {
    opacity: 0.7,
  },
  // Content
  content: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xxxl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: Magenta[500], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 8 },
      default: { boxShadow: `0px 4px 8px ${Magenta[500]}4D` } as any,
    }),
  },
  dateBadgeDay: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 24,
  },
  dateBadgeMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    lineHeight: Typography.xxl * 1.2,
    marginBottom: Spacing.sm,
  },
  vibeTagsRow: {
    marginBottom: Spacing.sm,
  },
  velocityChip: {
    marginBottom: Spacing.md,
  },
  velocityText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  weatherChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  weatherText: {
    fontSize: Typography.xs,
    fontWeight: '500',
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: Typography.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoSubLabel: {
    fontSize: Typography.sm,
  },
  // Connector cards (Space + Organizer)
  connectorCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  connectorIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  connectorLabel: {
    fontSize: Typography.xxs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  otherDatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingLeft: 40 + Spacing.md,
  },
  datePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  datePillText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  datePillTime: {
    fontSize: Typography.xs,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.base,
    lineHeight: Typography.base * 1.6,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  readMoreText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  voiceAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  voiceAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  voiceAvatarPlaceholder: {
    backgroundColor: Magenta[500] + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceAvatarMore: {
    fontSize: Typography.xs,
    marginLeft: 2,
  },
  sourceContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sourceText: {
    fontSize: Typography.xs,
  },
  // Sticky Action Dock
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  ticketButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  ticketButtonText: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: '#fff',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    flexShrink: 0,
  },
  checkInButtonDone: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  checkInButtonText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  similarCard: {
    width: 160,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  similarCardImage: {
    width: '100%',
    height: 100,
  },
  similarCardContent: {
    padding: Spacing.sm,
    gap: 2,
  },
  similarCardTitle: {
    fontSize: Typography.sm,
    fontWeight: '600',
    lineHeight: Typography.sm * 1.3,
    marginBottom: 2,
  },
  similarCardMeta: {
    fontSize: Typography.xs,
  },
  similarSkeletonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  similarCardSkeleton: {
    width: 160,
    height: 150,
    borderRadius: BorderRadius.lg,
    opacity: 0.5,
  },
  sectionHeaderRow: {
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
