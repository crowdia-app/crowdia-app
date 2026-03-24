import { supabase } from '@/lib/supabase';

export interface PublicUserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  is_voice: boolean;
  points: number | null;
  created_at: string | null;
}

export interface VoiceRequest {
  id: string;
  user_id: string;
  instagram_handle: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceAttendee {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
  user: {
    username: string | null;
    display_name: string | null;
    profile_image_url: string | null;
  } | null;
}

/** Fetch the current user's voice request (if any) */
export async function getMyVoiceRequest(): Promise<VoiceRequest | null> {
  const { data, error } = await supabase
    .from('voice_requests')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch voice request:', error);
    return null;
  }
  return data as VoiceRequest | null;
}

/** Submit a voice application */
export async function submitVoiceRequest(
  userId: string,
  instagramHandle?: string,
  reason?: string
): Promise<VoiceRequest> {
  const { data, error } = await supabase
    .from('voice_requests')
    .insert({
      user_id: userId,
      instagram_handle: instagramHandle || null,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as VoiceRequest;
}

/** Get list of voices attending an event */
export async function getVoicesByEventId(eventId: string): Promise<VoiceAttendee[]> {
  const { data, error } = await supabase
    .from('voice_events')
    .select('*, user:user_id(username, display_name, profile_image_url)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch voices for event:', error);
    return [];
  }
  return (data || []) as VoiceAttendee[];
}

/** Count how many voices are attending an event */
export async function getVoiceCountForEvent(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('voice_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) return 0;
  return count ?? 0;
}

/** Fetch a user's public profile by ID */
export async function fetchPublicUserProfile(userId: string): Promise<PublicUserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, bio, profile_image_url, is_voice, points, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
  return data as PublicUserProfile | null;
}

/** Get events a voice is attending (with basic event data) */
export async function getVoiceEvents(userId: string) {
  const { data, error } = await supabase
    .from('voice_events')
    .select('event_id, created_at, event:event_id(id, title, event_start_time, event_end_time, cover_image_url, is_published)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch voice events:', error);
    return [];
  }
  return data || [];
}

export interface VoiceEventEntry {
  event_id: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    event_start_time: string;
    event_end_time: string | null;
    cover_image_url: string | null;
    is_published: boolean | null;
  } | null;
}

/** Fetch instagram handle from approved voice request for a user */
export async function fetchVoiceInstagram(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('voice_requests')
    .select('instagram_handle')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle();

  if (error) return null;
  return data?.instagram_handle ?? null;
}
