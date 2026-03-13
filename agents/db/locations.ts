import { getSupabase } from "./client";
import { geocodeAddress } from "../tools/geocoding";
import type { Location } from "../../types/database";

/**
 * Normalize a venue name for duplicate-resistant lookup.
 * Strips social-handle @, city suffixes, and normalizes apostrophes/case.
 */
function normalizeName(name: string): string {
  return name
    .replace(/^@+/, "")                      // Strip leading @ (social handles like @aigiudici)
    .replace(/[,\s]+palermo\b.*/i, "")       // Strip ", Palermo" suffix and anything after
    .replace(/[''`]/g, "'")                  // Normalize curly/backtick apostrophes
    .trim();
}

export async function findLocationByName(name: string): Promise<Location | null> {
  // Try exact name first (case-insensitive)
  const { data } = await getSupabase()
    .from("locations")
    .select("*")
    .ilike("name", name)
    .maybeSingle();
  if (data) return data;

  // Try normalized name (strips @, city suffix, apostrophe variants)
  const normalized = normalizeName(name);
  if (normalized.toLowerCase() !== name.toLowerCase()) {
    const { data: byNorm } = await getSupabase()
      .from("locations")
      .select("*")
      .ilike("name", normalized)
      .maybeSingle();
    if (byNorm) return byNorm;
  }

  return null;
}

export async function createLocation(
  name: string,
  address?: string
): Promise<Location | null> {
  // Use normalized name for storage (strip @ handles, city suffixes)
  const storedName = normalizeName(name) || name;
  const fullAddress = address || `${storedName}, Palermo, Italy`;
  const geo = await geocodeAddress(fullAddress);

  const { data, error } = await getSupabase()
    .from("locations")
    .insert({
      name: storedName,
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
        .ilike("name", storedName)
        .maybeSingle();
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
  // Find by name (also tries normalized variant)
  const existing = await findLocationByName(name);
  if (existing) {
    return { location: existing, created: false };
  }

  // Also try to find by address to avoid creating address-level duplicates
  // (e.g., same venue stored under slightly different names but same address)
  const normalizedName = normalizeName(name);
  const fallbackAddress = `${normalizedName || name}, Palermo, Italy`;
  if (address && address !== fallbackAddress && address !== "Palermo, PA, Italy") {
    const { data: existingByAddress } = await getSupabase()
      .from("locations")
      .select("*")
      .ilike("address", address)
      .limit(1)
      .maybeSingle();
    if (existingByAddress) {
      return { location: existingByAddress as Location, created: false };
    }
  }

  const created = await createLocation(name, address);
  return { location: created, created: !!created };
}
