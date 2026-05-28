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
  return {
    reply: 'Sto cercando eventi per te...',
    lumioAvatar: 'thinking',
    events: [],
  };
}
