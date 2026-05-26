import { supabase } from '@/lib/supabase';

export interface OrganizerTeamMember {
  id: string;
  organizer_id: string;
  user_id: string;
  role: string;
  granted_by: string | null;
  created_at: string;
  user?: {
    username: string | null;
    display_name: string | null;
  };
}

export async function fetchOrganizerTeamMembers(organizerId: string): Promise<OrganizerTeamMember[]> {
  const { data, error } = await supabase
    .from('organizer_team_members')
    .select('*, user:users(username, display_name)')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addOrganizerTeamMember(
  organizerId: string,
  userId: string,
  role: 'manager' | 'member' = 'manager',
  grantedBy: string
): Promise<void> {
  const { error } = await supabase.from('organizer_team_members').insert({
    organizer_id: organizerId,
    user_id: userId,
    role,
    granted_by: grantedBy,
  });
  if (error) throw error;
}

export async function removeOrganizerTeamMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('organizer_team_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function searchUsersByUsername(query: string): Promise<{ id: string; username: string | null; display_name: string | null }[]> {
  if (!query || query.length < 2) return [];
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name')
    .ilike('username', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}
