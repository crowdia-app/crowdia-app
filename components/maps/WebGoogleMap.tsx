import React, { useCallback, useState, useRef, useMemo } from 'react';
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
  const [selectedEvent, setSelectedEvent] = useState<EventWithStats | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const handleMarkerClick = useCallback((event: EventWithStats) => {
    setSelectedEvent(event);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedEvent(null);
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
  const { events } = props;

  // Memoize bounds and center calculation
  const { bounds, center } = useMemo(() => {
    const b = new google.maps.LatLngBounds();
    events.forEach((event) => {
      if (event.location_lat && event.location_lng) {
        b.extend({ lat: event.location_lat, lng: event.location_lng });
      }
    });

    const c = events.length > 0
      ? { lat: b.getCenter().lat(), lng: b.getCenter().lng() }
      : { lat: 42.3601, lng: -71.0589 }; // Default: Boston

    return { bounds: b, center: c };
  }, [events]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', ...style }}
      center={center}
      zoom={12}
      options={{
        styles: colorScheme === 'dark' ? darkMapStyles : [],
        disableDefaultUI: true,
        backgroundColor: colorScheme === 'dark' ? '#212121' : undefined,
      }}
      onLoad={(map) => {
        handleMapLoad(map);
        if (events.length > 1) {
          map.fitBounds(bounds, 50);
        }
      }}
    >
      {events.map((event) => (
        <MarkerF
          key={event.id}
          position={{ lat: event.location_lat!, lng: event.location_lng! }}
          icon={crowdiaLogoUri ? {
            url: crowdiaLogoUri,
            scaledSize: new google.maps.Size(MARKER_SIZE, MARKER_SIZE),
            anchor: new google.maps.Point(MARKER_SIZE / 2, MARKER_SIZE),
          } : undefined}
          onClick={() => handleMarkerClick(event)}
        />
      ))}

      {selectedEvent && (
        <InfoWindow
          position={{ lat: selectedEvent.location_lat!, lng: selectedEvent.location_lng! }}
          onCloseClick={handleInfoWindowClose}
        >
          <EventInfoCard event={selectedEvent} onClick={() => handleEventClick(selectedEvent.id!)} />
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

// Info window content for selected event
interface EventInfoCardProps {
  event: EventWithStats;
  onClick: () => void;
}

function EventInfoCard({ event, onClick }: EventInfoCardProps) {
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
              color: '#1a1a1a',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
            {formatDate(event.event_start_time)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#888',
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
