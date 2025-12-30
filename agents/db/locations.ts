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
    console.error("Failed to create location:", error.message);
    return null;
  }

  return data;
}

export async function findOrCreateLocation(
  name: string,
  address?: string
): Promise<{ location: Location | null; created: boolean }> {
  const existing = await findLocationByName(name);
  if (existing) {
    return { location: existing, created: false };
  }

  const created = await createLocation(name, address);
  return { location: created, created: !!created };
}
