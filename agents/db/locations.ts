import { getSupabase } from "./client";
import { geocodeAddress } from "../tools/geocoding";
import type { Location } from "../../types/database";

export async function findLocationByName(name: string): Promise<Location | null> {
  const { data } = await getSupabase()
    .from("locations")
    .select("*")
    .ilike("name", name)
    .single();

  return data;
}

export async function createLocation(
  name: string,
  address?: string
): Promise<Location | null> {
  const fullAddress = address || `${name}, Palermo, Italy`;
  const geo = await geocodeAddress(fullAddress);

  const { data, error } = await getSupabase()
    .from("locations")
    .insert({
      name,
      address: geo?.formattedAddress || fullAddress,
      lat: geo?.lat || 38.1157,
      lng: geo?.lng || 13.3615,
    })
    .select("*")
    .single();

  if (error) {
    // Handle unique constraint violation: another process may have inserted
    // a location with the same name or address concurrently. Retry as a find.
    if (error.code === "23505") {
      const retry = await getSupabase()
        .from("locations")
        .select("*")
        .ilike("name", name)
        .single();
      if (retry.data) return retry.data;
    }
    console.error("Failed to create location:", error.message);
    return null;
  }

  return data;
}

export async function findOrCreateLocation(
  name: string,
  address?: string
): Promise<{ location: Location | null; created: boolean }> {
  // First try to find by exact name (case-insensitive)
  const existing = await findLocationByName(name);
  if (existing) {
    return { location: existing, created: false };
  }

  // Also try to find by address to avoid creating address-level duplicates
  // (e.g., same venue stored under slightly different names but same address)
  if (address && address !== `${name}, Palermo, Italy` && address !== "Palermo, PA, Italy") {
    const { data: existingByAddress } = await getSupabase()
      .from("locations")
      .select("*")
      .ilike("address", address)
      .limit(1)
      .single();
    if (existingByAddress) {
      return { location: existingByAddress as Location, created: false };
    }
  }

  const created = await createLocation(name, address);
  return { location: created, created: !!created };
}
