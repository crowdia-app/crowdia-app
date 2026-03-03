import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { useEventsFilterStore } from '@/stores/eventsFilterStore';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/**
 * Hook that requests the user's location and writes it into the events filter store.
 * The store then passes it through to fetchEvents for distance-based sorting.
 */
export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const { userLocation, setUserLocation } = useEventsFilterStore();

  const requestLocation = useCallback(async () => {
    setStatus('requesting');

    try {
      const { status: permStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (permStatus !== 'granted') {
        setStatus('denied');
        setUserLocation(null);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setStatus('granted');
    } catch {
      setStatus('unavailable');
      setUserLocation(null);
    }
  }, [setUserLocation]);

  const clearLocation = useCallback(() => {
    setUserLocation(null);
    setStatus('idle');
  }, [setUserLocation]);

  return {
    userLocation,
    status,
    requestLocation,
    clearLocation,
    hasLocation: userLocation !== null,
  };
}
