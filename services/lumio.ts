import { supabase } from '@/lib/supabase';

export interface LumioRequest {
  message: string;
  userId: string | null;
  userCity?: string;
  userLocale?: string;
  userTier?: string;
  sessionId?: string;
}

export interface LumioEvent {
  id: string;
  title: string;
  location_name?: string | null;
  event_start_time?: string | null;
}

export interface LumioResponse {
  reply: string;
  lumioAvatar: 'idle' | 'listening' | 'thinking' | 'excited';
  events: LumioEvent[];
  tier?: string;
  modelUsed?: string;
  sessionId?: string;
}

export async function askLumio(
  message: string,
  userId: string | null,
  sessionId?: string,
): Promise<LumioResponse> {
  const { data, error } = await supabase.functions.invoke('lumio-chat', {
    body: { message, userId, sessionId } satisfies LumioRequest,
  });

  if (error) {
    console.error('Lumio chat error:', error);
    return {
      reply: 'Non riesco a rispondere in questo momento. Riprova tra poco!',
      lumioAvatar: 'idle',
      events: [],
    };
  }

  return {
    reply: data.reply ?? 'Non ho trovato nulla.',
    lumioAvatar: data.lumioAvatar ?? 'idle',
    events: data.events ?? [],
    tier: data.tier,
    modelUsed: data.modelUsed,
    sessionId: data.sessionId,
  };
}
