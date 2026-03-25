import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

const INITIAL_DELAY_MS = 2 * 60 * 1000; // 2 minutes of browsing
const REDISPLAY_DELAY_MS = 10 * 60 * 1000; // 10 minutes after dismissal

/**
 * Shows a login prompt to unauthenticated users after a period of browsing.
 * Also exposes a `show()` method to trigger it on-demand (e.g. when an action requires auth).
 */
export function useLoginPrompt() {
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePrompt = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Re-check auth at fire time — user may have logged in since scheduling
      if (!useAuthStore.getState().user) {
        setVisible(true);
      }
    }, delay);
  }, []);

  useEffect(() => {
    if (user) {
      // Logged in — cancel pending timer and hide modal
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(false);
      return;
    }
    // Start the initial browsing timer
    schedulePrompt(INITIAL_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, schedulePrompt]);

  const dismiss = useCallback(() => {
    setVisible(false);
    schedulePrompt(REDISPLAY_DELAY_MS);
  }, [schedulePrompt]);

  const show = useCallback(() => {
    if (!useAuthStore.getState().user) {
      setVisible(true);
    }
  }, []);

  return { visible, dismiss, show };
}
