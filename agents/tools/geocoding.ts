import { config } from "../config";

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!config.googleMapsKey) {
    console.warn("Google Maps API key not set, skipping geocoding");
    return null;
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", config.googleMapsKey);
    url.searchParams.set("region", "it");
    // Bias toward Sicily
    url.searchParams.set("bounds", "37.5,12.5|38.5,15.5");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
}
