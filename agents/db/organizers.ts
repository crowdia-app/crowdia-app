import { getSupabase } from "./client";
import { config } from "../config";
import type { Organizer } from "../../types/database";

export async function findOrganizerByName(name: string): Promise<Organizer | null> {
  const { data } = await getSupabase()
    .from("organizers")
    .select("*")
    .ilike("organization_name", name)
    .single();

  return data;
}

export async function createOrganizer(name: string): Promise<Organizer | null> {
  const { data, error } = await getSupabase()
    .from("organizers")
    .insert({ organization_name: name })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create organizer:", error.message);
    return null;
  }

  return data;
}

export async function findOrCreateOrganizer(
  name: string
): Promise<{ organizer: Organizer | null; created: boolean }> {
  const existing = await findOrganizerByName(name);
  if (existing) {
    return { organizer: existing, created: false };
  }

  if (!config.autoCreateOrganizers) {
    console.log(`[kill-switch] Skipping new organizer creation for "${name}" (autoCreateOrganizers disabled)`);
    return { organizer: null, created: false };
  }

  const created = await createOrganizer(name);
  return { organizer: created, created: !!created };
}
