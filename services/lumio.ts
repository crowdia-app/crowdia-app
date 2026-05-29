import { supabase } from '@/lib/supabase';

export interface LumioRequest {
  message: string;
  userId: string | null;
  userCity?: string;
  userLocale?: string;
  userTier?: string;
}

export interface LumioResponse {
  reply: string;
  lumioAvatar: 'idle' | 'listening' | 'thinking' | 'excited';
  events: unknown[];
  tier?: string;
  modelUsed?: string;
}

export async function askLumio(
  message: string,
  userId: string | null,
): Promise<LumioResponse> {
  const { data, error } = await supabase.functions.invoke('lumio-chat', {
    body: { message, userId } satisfies LumioRequest,
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
  };
}
