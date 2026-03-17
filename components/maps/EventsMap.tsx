import React, { useMemo, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, useColorScheme, TouchableOpacity, Image } from 'react-native';

const crowdiaLogo = require('@/assets/images/crowdia-logo-icon-transparent.png');
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EventWithStats } from '@/types/database';
import { Colors, Spacing, Typography, Magenta } from '@/constants/theme';
import { EventCallout } from './EventCallout';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';

// Web Google Maps component - only imported on web
let WebGoogleMap: React.ComponentType<any> | null = null;
if (Platform.OS === 'web') {
  WebGoogleMap = require('./WebGoogleMap').WebGoogleMap;
}

// Native MapView imports - only loaded on native platforms
let NativeMapView: React.ComponentType<any> | null = null;
let NativeMarker: React.ComponentType<any> | null = null;
let NativeCallout: React.ComponentType<any> | null = null;
let ClusteredMapView: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    NativeMapView = Maps.default;
    NativeMarker = Maps.Marker;
    NativeCallout = Maps.Callout;

    // Try to load clustering library
    try {
      const ClusteredMaps = require('react-native-map-clustering');
      ClusteredMapView = ClusteredMaps.default;
    } catch (e) {
      console.warn('react-native-map-clustering not available, using standard MapView');
    }
  } catch (e) {
    console.warn('react-native-maps not available');
  }
}

// Dark mode map style for Google Maps (native)
const darkMapStyle = [
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

interface EventsMapProps {
  events: EventWithStats[];
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

// Default region: Palermo, Sicily (primary event market)
const DEFAULT_REGION = {
  latitude: 38.1157,
  longitude: 13.3615,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

// Zoom level when centering on user location (~10km view)
const USER_LOCATION_DELTA = 0.1;

export function EventsMap({ events, initialRegion }: EventsMapProps) {
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [selectedVenueGroup, setSelectedVenueGroup] = useState<EventWithStats[] | null>(null);

  // Read user location from the global filter store
  const { userLocation } = useEventsFilterStore();

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

  // Calculate optimal region: prefer user location, fall back to event bounds or default
  const region = useMemo(() => {
    if (initialRegion) return initialRegion;

    // Zoom to user location if available
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: USER_LOCATION_DELTA,
        longitudeDelta: USER_LOCATION_DELTA,
      };
    }

    if (events.length === 0) return DEFAULT_REGION;

    const lats = events.map((e) => e.location_lat!).filter(Boolean);
    const lngs = events.map((e) => e.location_lng!).filter(Boolean);

    if (lats.length === 0 || lngs.length === 0) return DEFAULT_REGION;

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = Math.max(0.02, (maxLat - minLat) * 1.5);
    const lngDelta = Math.max(0.02, (maxLng - minLng) * 1.5);

    // If all events are spread nationwide (delta > 5 degrees), use default city view
    if (latDelta > 5 || lngDelta > 5) return DEFAULT_REGION;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [events, initialRegion, userLocation]);

  const handleSingleMarkerPress = useCallback((event: EventWithStats) => {
    router.push(`/event/${event.id}`);
  }, [router]);

  const handleVenueMarkerPress = useCallback((group: EventWithStats[]) => {
    if (group.length === 1) {
      router.push(`/event/${group[0].id}`);
    } else {
      setSelectedVenueGroup(group);
    }
  }, [router]);

  const handleMapPress = useCallback(() => {
    setSelectedVenueGroup(null);
  }, []);

  const renderCluster = useCallback((cluster: any) => {
    const { geometry, properties, onPress } = cluster;
    const coordinate = {
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0],
    };
    const Marker = NativeMarker as React.ComponentType<any>;
    return (
      <Marker
        key={`cluster-${geometry.coordinates[0]}-${geometry.coordinates[1]}`}
        coordinate={coordinate}
        onPress={onPress}
        tracksViewChanges={false}
      >
        <View style={styles.clusterMarker}>
          <Image source={crowdiaLogo} style={styles.clusterLogo} />
          <View style={[styles.clusterBadge, { backgroundColor: '#fff', borderColor: Magenta[500] }]}>
            <Text style={[styles.clusterBadgeText, { color: Magenta[500] }]}>
              {properties.point_count}
            </Text>
          </View>
        </View>
      </Marker>
    );
  }, []);

  // For web, use Google Maps JavaScript API
  if (Platform.OS === 'web' && WebGoogleMap) {
    return (
      <View style={styles.container}>
        <WebGoogleMap events={events} colorScheme={colorScheme} userLocation={userLocation} />
      </View>
    );
  }

  // Native platforms: use react-native-maps
  if (!NativeMapView || !NativeMarker) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.fallbackContainer}>
          <Ionicons name="map-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
            Map not available
          </Text>
        </View>
      </View>
    );
  }

  // Use clustered map if available, otherwise standard map
  const MapComponent = ClusteredMapView || NativeMapView;

  return (
    <View style={styles.container}>
      <MapComponent
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={colorScheme === 'dark' ? darkMapStyle : []}
        showsUserLocation
        showsMyLocationButton
        onPress={handleMapPress}
        // Clustering props (only used if ClusteredMapView is available)
        renderCluster={renderCluster}
        clusterColor={Magenta[500]}
        clusterTextColor="#FFFFFF"
        clusterFontFamily="System"
        radius={50}
        maxZoom={15}
        minZoom={1}
        minPoints={2}
        extent={512}
        nodeSize={64}
      >
        {venueGroups.map((group) => {
          const first = group[0];
          const count = group.length;
          const coordinate = {
            latitude: first.location_lat!,
            longitude: first.location_lng!,
          };

          if (count === 1) {
            // Single event at this location — standard marker
            return (
              <NativeMarker
                key={first.id}
                coordinate={coordinate}
                pinColor={Magenta[500]}
                onPress={() => handleSingleMarkerPress(first)}
              >
                {NativeCallout && (
                  <NativeCallout
                    tooltip
                    onPress={() => handleSingleMarkerPress(first)}
                    style={styles.calloutContainer}
                  >
                    <EventCallout event={first} onPress={() => handleSingleMarkerPress(first)} />
                  </NativeCallout>
                )}
              </NativeMarker>
            );
          }

          // Multiple events at same venue — badge marker
          return (
            <NativeMarker
              key={`venue-${coordinate.latitude}-${coordinate.longitude}`}
              coordinate={coordinate}
              onPress={() => handleVenueMarkerPress(group)}
            >
              <View style={[styles.venueBadge, { backgroundColor: Magenta[500] }]}>
                <Text style={styles.venueBadgeText}>{count}</Text>
              </View>
              {NativeCallout && (
                <NativeCallout tooltip style={styles.calloutContainer}>
                  <VenueCallout
                    events={group}
                    colorScheme={colorScheme}
                    onEventPress={(event) => {
                      router.push(`/event/${event.id}`);
                    }}
                  />
                </NativeCallout>
              )}
            </NativeMarker>
          );
        })}
      </MapComponent>

      {/* Venue event list overlay for native (fallback when callout isn't ideal) */}
      {selectedVenueGroup && selectedVenueGroup.length > 1 && (
        <View style={[styles.venueOverlay, { backgroundColor: colors.card }]}>
          <Text style={[styles.venueOverlayTitle, { color: colors.text }]}>
            {selectedVenueGroup[0].location_name || 'Events at this venue'}
          </Text>
          {selectedVenueGroup.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={[styles.venueOverlayItem, { borderTopColor: colors.cardBorder }]}
              onPress={() => {
                setSelectedVenueGroup(null);
                router.push(`/event/${event.id}`);
              }}
            >
              <Text style={[styles.venueOverlayItemTitle, { color: colors.text }]} numberOfLines={1}>
                {event.title}
              </Text>
              {event.event_start_time && (
                <Text style={[styles.venueOverlayItemDate, { color: colors.textSecondary }]}>
                  {new Date(event.event_start_time).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Europe/Rome',
                  })}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// Callout content for multi-event venues
interface VenueCalloutProps {
  events: EventWithStats[];
  colorScheme: 'light' | 'dark';
  onEventPress: (event: EventWithStats) => void;
}

function VenueCallout({ events, colorScheme, onEventPress }: VenueCalloutProps) {
  const colors = Colors[colorScheme];
  return (
    <View style={[venueCalloutStyles.container, { backgroundColor: colors.card }]}>
      <Text style={[venueCalloutStyles.title, { color: colors.text }]}>
        {events[0].location_name || 'Venue'} · {events.length} events
      </Text>
      {events.slice(0, 4).map((event, idx) => (
        <TouchableOpacity
          key={event.id}
          style={[venueCalloutStyles.item, idx > 0 && { borderTopColor: colors.cardBorder, borderTopWidth: StyleSheet.hairlineWidth }]}
          onPress={() => onEventPress(event)}
        >
          <Text style={[venueCalloutStyles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
        </TouchableOpacity>
      ))}
      {events.length > 4 && (
        <Text style={[venueCalloutStyles.more, { color: colors.textSecondary }]}>
          +{events.length - 4} more
        </Text>
      )}
    </View>
  );
}

const venueCalloutStyles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: Spacing.sm,
    minWidth: 180,
    maxWidth: 240,
  },
  title: {
    fontSize: Typography.xs,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  item: {
    paddingVertical: Spacing.xs,
  },
  itemTitle: {
    fontSize: Typography.sm,
  },
  more: {
    fontSize: Typography.xs,
    marginTop: Spacing.xs,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fallbackText: {
    fontSize: Typography.base,
    textAlign: 'center',
  },
  calloutContainer: {
    backgroundColor: 'transparent',
  },
  clusterMarker: {
    width: 32,
    height: 32,
  },
  clusterLogo: {
    width: 32,
    height: 32,
  },
  clusterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  clusterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  venueBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  venueBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  venueOverlay: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  venueOverlayTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  venueOverlayItem: {
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  venueOverlayItemTitle: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  venueOverlayItemDate: {
    fontSize: Typography.xs,
    marginTop: 2,
  },
});
