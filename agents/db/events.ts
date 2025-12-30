import { getSupabase } from "./client";
import type { EventInsert } from "../../types/database";

export async function findEventByTitleAndDate(
  title: string,
  startTime: string
): Promise<string | null> {
  const startDate = startTime.split("T")[0];

  const { data } = await getSupabase()
    .from("events")
    .select("id")
    .ilike("title", title)
    .gte("event_start_time", `${startDate}T00:00:00`)
    .lte("event_start_time", `${startDate}T23:59:59`)
    .single();

  return data?.id || null;
}

export async function createEvent(event: EventInsert): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("events")
    .insert(event)
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create event:", error.message);
    return null;
  }

  return data.id;
}
