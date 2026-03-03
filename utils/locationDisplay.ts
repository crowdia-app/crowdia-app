/**
 * Location display utilities
 *
 * When the scraper cannot find a specific venue address, it falls back to
 * the city-level geocode (Palermo, PA, Italy) with coordinates 38.1157, 13.3615.
 * These coordinates are the city centroid -- not a useful pin on a map.
 *
 * This module provides helpers to:
 * 1. Detect city-only (imprecise) locations
 * 2. Format a readable location label instead of showing raw city coordinates
 */

/** Palermo city-center coordinates (geocoder fallback) */
const PALERMO_CENTER_LAT = 38.1157;
const PALERMO_CENTER_LNG = 13.3615;

/** Tolerance in degrees (~100m) for considering coords "city center" */
const CITY_CENTER_TOLERANCE = 0.001;

/** Addresses that indicate a city-only (imprecise) location */
const CITY_LEVEL_ADDRESS_PATTERNS = [
  /^palermo,?\s*(pa,?)?\s*italy$/i,
  /^palermo$/i,
  /^sicilia$/i,
  /^sicily$/i,
];

/**
 * Returns true if the location only has city-level precision
 * (i.e. the geocoder fell back to the city center).
 */
export function isCityOnlyLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined
): boolean {
  // Check address pattern first
  if (address) {
    for (const pattern of CITY_LEVEL_ADDRESS_PATTERNS) {
      if (pattern.test(address.trim())) return true;
    }
  }

  // Check if coordinates are within ~100m of Palermo city center
  if (lat != null && lng != null) {
    const latDiff = Math.abs(lat - PALERMO_CENTER_LAT);
    const lngDiff = Math.abs(lng - PALERMO_CENTER_LNG);
    if (latDiff < CITY_CENTER_TOLERANCE && lngDiff < CITY_CENTER_TOLERANCE) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the best display string for a location's address line.
 *
 * - If the address is city-only, returns "Palermo" (human-readable city name).
 * - Otherwise returns the full address as-is.
 */
export function formatLocationAddress(
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined
): string | null {
  if (!address) return null;

  if (isCityOnlyLocation(lat, lng, address)) {
    return 'Palermo';
  }

  return address;
}

/**
 * Returns true if the location has a precise address suitable for map display.
 * City-only locations should not show a map pin (it would be misleading).
 */
export function hasPreciseLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined
): boolean {
  if (!lat || !lng) return false;
  return !isCityOnlyLocation(lat, lng, address);
}
