import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';

const AUTO_PROMPT_DELAY_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Hook that manages a login prompt modal for unauthenticated users.
 * Shows automatically after 2 minutes of browsing, or on demand via `show()`.
 * Once dismissed it won't auto-show again during the same session.
 */
export function useLoginPrompt() {
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const autoDismissedRef = useRef(false);

  // Auto-prompt after 2 minutes for unauthenticated users
  useEffect(() => {
    if (user || autoDismissedRef.current) return;

    const timer = setTimeout(() => {
      if (!useAuthStore.getState().user) {
        setVisible(true);
      }
    }, AUTO_PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [user]);

  // Hide modal when user logs in
  useEffect(() => {
    if (user) {
      setVisible(false);
    }
  }, [user]);

  const dismiss = useCallback(() => {
    setVisible(false);
    autoDismissedRef.current = true;
  }, []);

  const show = useCallback(() => {
    if (!useAuthStore.getState().user) {
      setVisible(true);
    }
  }, []);

  return { visible, dismiss, show };
}
