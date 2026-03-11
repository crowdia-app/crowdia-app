import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  GoogleMap,
  useJsApiLoader,
  OverlayView,
  MarkerF,
  InfoWindow,
} from '@react-google-maps/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Asset } from 'expo-asset';
import { EventWithStats } from '@/types/database';
import { Colors, Spacing, Typography, Magenta } from '@/constants/theme';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { Image } from 'expo-image';

// Dark mode map styles
const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
];

interface SingleMarkerProps {
  latitude: number;
  longitude: number;
  colorScheme: 'light' | 'dark';
}

interface MultiMarkerProps {
  events: EventWithStats[];
  colorScheme: 'light' | 'dark';
  userLocation?: { latitude: number; longitude: number } | null;
}

type WebGoogleMapProps = (SingleMarkerProps | MultiMarkerProps) & {
  style?: React.CSSProperties;
};

function isSingleMarker(props: WebGoogleMapProps): props is SingleMarkerProps & { style?: React.CSSProperties } {
  return 'latitude' in props && 'longitude' in props;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const MARKER_SIZE = 32;
const crowdiaLogo = require('@/assets/images/crowdia-logo-icon-transparent.png');
const crowdiaLogoUri = Asset.fromModule(crowdiaLogo).uri;

// OverlayView offset for the single-marker mode (event detail page)
const getMarkerOffset = () => ({
  x: -(MARKER_SIZE / 2),
  y: -MARKER_SIZE,
});

// Map marker for single-marker mode (OverlayView -- no flicker since the map doesn't pan)
function MapMarker() {
  return (
    <Image
      source={crowdiaLogo}
      style={{
        width: MARKER_SIZE,
        height: MARKER_SIZE,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
      } as any}
      contentFit="contain"
    />
  );
}

export function WebGoogleMap(props: WebGoogleMapProps) {
  const { colorScheme, style } = props;
  const colors = Colors[colorScheme];
  const router = useRouter();
  // selectedVenueGroup holds the event(s) whose InfoWindow is open
  const [selectedVenueGroup, setSelectedVenueGroup] = useState<EventWithStats[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const handleMarkerClick = useCallback((event: EventWithStats, group?: EventWithStats[]) => {
    setSelectedVenueGroup(group ?? [event]);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedVenueGroup([]);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    // Exit fullscreen before navigating to prevent overlay persistence
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        router.push(`/event/${eventId}`);
      }).catch(() => {
        // If exitFullscreen fails, navigate anyway
        router.push(`/event/${eventId}`);
      });
    } else {
      router.push(`/event/${eventId}`);
    }
  }, [router]);

  // Inject CSS overrides for the Google Maps InfoWindow bubble to match the current theme
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'crowdia-map-infowindow-theme';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (colorScheme === 'dark') {
      styleEl.textContent = `
        .gm-style .gm-style-iw-c {
          background-color: #141414 !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.8) !important;
        }
        .gm-style .gm-style-iw-d { overflow: hidden !important; }
        .gm-style .gm-style-iw-t::after {
          background: linear-gradient(45deg, #141414 50%, transparent 50%) !important;
        }
        .gm-style button.gm-ui-hover-effect > span {
          background-color: #ECEDEE !important;
        }
      `;
    } else {
      styleEl.textContent = '';
    }
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, [colorScheme]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleLocateMe = useCallback(() => {
    console.log('[Map] Location button clicked', { hasGeo: !!navigator.geolocation, hasMap: !!mapRef.current });
    if (!navigator.geolocation) {
      console.warn('[Map] Geolocation not supported');
      return;
    }
    if (!mapRef.current) {
      console.warn('[Map] Map ref not available');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[Map] Got position:', position.coords.latitude, position.coords.longitude);
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        mapRef.current?.panTo(pos);
        mapRef.current?.setZoom(14);
        setIsLocating(false);
      },
      (err) => {
        console.error('[Map] Geolocation error:', err.code, err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Failed to load map
        </Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading map...
        </Text>
      </View>
    );
  }

  // Single marker mode
  if (isSingleMarker(props)) {
    const { latitude, longitude } = props;
    const center = { lat: latitude, lng: longitude };

    return (
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%', ...style }}
        center={center}
        zoom={15}
        onLoad={handleMapLoad}
        options={{
          styles: colorScheme === 'dark' ? darkMapStyles : [],
          disableDefaultUI: true,
          zoomControl: true,
          backgroundColor: colorScheme === 'dark' ? '#212121' : undefined,
        }}
      >
        <OverlayView
          position={center}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
          getPixelPositionOffset={getMarkerOffset}
        >
          <MapMarker />
        </OverlayView>
      </GoogleMap>
    );
  }

  // Multi-marker mode
  const { events, userLocation } = props as MultiMarkerProps;

  // Default center: Palermo, Sicily
  const DEFAULT_CENTER = { lat: 38.1157, lng: 13.3615 };

  // Group events by venue coordinates (round to ~11m precision)
  const venueGroups = useMemo(() => {
    const groups = new Map<string, EventWithStats[]>();
    events.forEach((event) => {
      if (event.location_lat && event.location_lng) {
        const key = `${event.location_lat.toFixed(4)},${event.location_lng.toFixed(4)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(event);
      }
    });
    return Array.from(groups.values());
  }, [events]);

  // Memoize bounds calculation
  const bounds = useMemo(() => {
    const b = new google.maps.LatLngBounds();
    events.forEach((event) => {
      if (event.location_lat && event.location_lng) {
        b.extend({ lat: event.location_lat, lng: event.location_lng });
      }
    });
    return b;
  }, [events]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', ...style }}
      center={DEFAULT_CENTER}
      zoom={13}
      options={{
        styles: colorScheme === 'dark' ? darkMapStyles : [],
        disableDefaultUI: true,
        backgroundColor: colorScheme === 'dark' ? '#212121' : undefined,
      }}
      onLoad={(map) => {
        handleMapLoad(map);
        // If filter store already has user location, use it immediately (no extra API call)
        if (userLocation) {
          map.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
          map.setZoom(13);
          return;
        }
        // Otherwise try browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              map.setZoom(13);
            },
            () => {
              // Permission denied or unavailable
              // Check if events are spread nationwide (delta > 5°) — if so, stay on city default
              const lats = events.filter((e) => e.location_lat).map((e) => e.location_lat!);
              const lngs = events.filter((e) => e.location_lng).map((e) => e.location_lng!);
              const latDelta = lats.length ? Math.max(...lats) - Math.min(...lats) : 0;
              const lngDelta = lngs.length ? Math.max(...lngs) - Math.min(...lngs) : 0;
              if (latDelta > 5 || lngDelta > 5) {
                // Nationwide spread — show city center at default zoom
                map.panTo(DEFAULT_CENTER);
                map.setZoom(13);
              } else if (events.length > 1) {
                map.fitBounds(bounds, 50);
              } else if (events.length === 1 && events[0].location_lat && events[0].location_lng) {
                map.panTo({ lat: events[0].location_lat, lng: events[0].location_lng });
                map.setZoom(14);
              }
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
          );
        } else if (events.length > 1) {
          map.fitBounds(bounds, 50);
        }
      }}
    >
      {venueGroups.map((group) => {
        const first = group[0];
        const count = group.length;
        const position = { lat: first.location_lat!, lng: first.location_lng! };

        if (count === 1) {
          return (
            <MarkerF
              key={first.id}
              position={position}
              icon={crowdiaLogoUri ? {
                url: crowdiaLogoUri,
                scaledSize: new google.maps.Size(MARKER_SIZE, MARKER_SIZE),
                anchor: new google.maps.Point(MARKER_SIZE / 2, MARKER_SIZE),
              } : undefined}
              onClick={() => handleMarkerClick(first)}
            />
          );
        }

        // Multiple events at same venue — show count badge marker
        return (
          <MarkerF
            key={`venue-${first.location_lat}-${first.location_lng}`}
            position={position}
            label={{
              text: String(count),
              color: '#fff',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 18,
              fillColor: Magenta[500],
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }}
            onClick={() => handleMarkerClick(first, group)}
          />
        );
      })}

      {selectedVenueGroup.length > 0 && (
        <InfoWindow
          position={{ lat: selectedVenueGroup[0].location_lat!, lng: selectedVenueGroup[0].location_lng! }}
          onCloseClick={handleInfoWindowClose}
        >
          {selectedVenueGroup.length === 1 ? (
            <EventInfoCard
              event={selectedVenueGroup[0]}
              colorScheme={colorScheme}
              onClick={() => handleEventClick(selectedVenueGroup[0].id!)}
            />
          ) : (
            <VenueInfoCard
              events={selectedVenueGroup}
              colorScheme={colorScheme}
              onEventClick={(id) => handleEventClick(id)}
            />
          )}
        </InfoWindow>
      )}

    </GoogleMap>
      {/* My Location button */}
      <button
        onClick={handleLocateMe}
        disabled={isLocating}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          border: 'none',
          backgroundColor: colorScheme === 'dark' ? '#333' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isLocating ? 'default' : 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          zIndex: 1,
          animation: isLocating ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isLocating ? Magenta[500] : (colorScheme === 'dark' ? '#ccc' : '#333')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </button>
    </div>
  );
}

// Info window for multiple events at the same venue
interface VenueInfoCardProps {
  events: EventWithStats[];
  colorScheme: 'light' | 'dark';
  onEventClick: (id: string) => void;
}

function VenueInfoCard({ events, colorScheme, onEventClick }: VenueInfoCardProps) {
  const colors = Colors[colorScheme];
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Europe/Rome',
    });
  };

  return (
    <div style={{ width: 240, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
        {events[0].location_name || 'Venue'} · {events.length} events
      </div>
      {events.map((event, idx) => (
        <div
          key={event.id}
          onClick={() => onEventClick(event.id!)}
          style={{
            padding: '6px 0',
            borderTop: idx > 0 ? `1px solid ${colors.cardBorder}` : 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 2 }}>
            {event.title}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>
            {formatDate(event.event_start_time)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Info window content for selected event
interface EventInfoCardProps {
  event: EventWithStats;
  colorScheme: 'light' | 'dark';
  onClick: () => void;
}

function EventInfoCard({ event, colorScheme, onClick }: EventInfoCardProps) {
  const colors = Colors[colorScheme];
  const imageUrl = getProxiedImageUrl(event.cover_image_url);
  const hasValidImage = !!imageUrl;

  // Events are always in Palermo (Europe/Rome) — display in local event time
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Europe/Rome',
    });
  };

  return (
    <div
      onClick={onClick}
      style={{
        width: 250,
        cursor: 'pointer',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Thumbnail */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 8,
            overflow: 'hidden',
            flexShrink: 0,
            backgroundColor: Magenta[500],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasValidImage ? (
            <img
              src={imageUrl}
              alt={event.title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: 24 }}>📅</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.text,
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>
            {formatDate(event.event_start_time)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: colors.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.location_name}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: Magenta[500],
          fontWeight: 500,
        }}
      >
        View Details →
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: Typography.sm,
  },
  errorText: {
    fontSize: Typography.sm,
    marginTop: Spacing.sm,
  },
});
