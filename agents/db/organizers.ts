import { getSupabase } from "./client";
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

  const created = await createOrganizer(name);
  return { organizer: created, created: !!created };
}
