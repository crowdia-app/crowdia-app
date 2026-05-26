import { Platform } from 'react-native';

const UMAMI_HOST =
  process.env.EXPO_PUBLIC_UMAMI_HOST ?? 'https://media-server.tail0af452.ts.net:10000';
const WEBSITE_ID =
  process.env.EXPO_PUBLIC_UMAMI_WEBSITE_ID ?? '1625b9c8-185d-43a2-b1dc-ac3acde6790c';

export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && (window as unknown as { umami?: { track: (n: string, d?: unknown) => void } }).umami) {
      (window as unknown as { umami: { track: (n: string, d?: unknown) => void } }).umami.track(name, data);
    }
    return;
  }
  // Native: fire-and-forget to Umami collection API
  if (!WEBSITE_ID) return;
  fetch(`${UMAMI_HOST}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'event',
      payload: { website: WEBSITE_ID, hostname: 'app.crowdia.ai', url: '/', name, data },
    }),
  }).catch(() => {});
}
