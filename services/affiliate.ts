import { supabase } from '@/lib/supabase';

export type AffiliateClickType = 'ticket' | 'event_url';

/**
 * Fire-and-forget click tracking. Records when a user taps an external link
 * (ticket URL or event page). Errors are swallowed so they never block the user.
 */
export async function trackAffiliateClick({
  userId,
  eventId,
  url,
  clickType,
}: {
  userId: string | null;
  eventId: string;
  url: string;
  clickType: AffiliateClickType;
}): Promise<void> {
  try {
    await supabase.from('affiliate_clicks').insert({
      user_id: userId ?? null,
      event_id: eventId,
      url,
      click_type: clickType,
    });
  } catch {
    // Silently ignore — click tracking must never interrupt the user
  }
}
