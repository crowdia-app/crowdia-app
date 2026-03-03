import { supabase } from '@/lib/supabase';

export interface OrganizerRequest {
  id: string;
  user_id: string;
  organization_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined from users
  user?: {
    username: string | null;
    display_name: string | null;
    email?: string | null;
  };
}

/** Fetch the current user's organizer request */
export async function getMyOrganizerRequest(): Promise<OrganizerRequest | null> {
  const { data, error } = await supabase
    .from('organizer_requests')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch organizer request:', error);
    return null;
  }
  return data as OrganizerRequest | null;
}

/** Submit a new organizer request */
export async function submitOrganizerRequest(
  userId: string,
  organizationName: string,
  reason?: string
): Promise<OrganizerRequest> {
  const { data, error } = await supabase
    .from('organizer_requests')
    .insert({
      user_id: userId,
      organization_name: organizationName,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as OrganizerRequest;
}

/** Fetch all pending organizer requests (admin only) */
export async function fetchPendingOrganizerRequests(): Promise<OrganizerRequest[]> {
  const { data, error } = await supabase
    .from('organizer_requests')
    .select('*, user:user_id(username, display_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch organizer requests:', error);
    return [];
  }
  return (data || []) as OrganizerRequest[];
}

/** Fetch all organizer requests (admin only) */
export async function fetchAllOrganizerRequests(): Promise<OrganizerRequest[]> {
  const { data, error } = await supabase
    .from('organizer_requests')
    .select('*, user:user_id(username, display_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch organizer requests:', error);
    return [];
  }
  return (data || []) as OrganizerRequest[];
}

/** Approve a request: update status and create organizer record */
export async function approveOrganizerRequest(
  requestId: string,
  request: OrganizerRequest,
  reviewerId: string
): Promise<void> {
  // Create organizer record
  const { error: orgError } = await supabase.from('organizers').upsert({
    id: request.user_id,
    user_id: request.user_id,
    organization_name: request.organization_name,
    is_verified: false,
  });

  if (orgError) throw orgError;

  // Update request status
  const { error: reqError } = await supabase
    .from('organizer_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (reqError) throw reqError;
}

/** Reject a request */
export async function rejectOrganizerRequest(
  requestId: string,
  reviewerId: string,
  rejectionReason?: string
): Promise<void> {
  const { error } = await supabase
    .from('organizer_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) throw error;
}
