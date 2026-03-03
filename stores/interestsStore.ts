import { create } from 'zustand';
import { EventWithStats } from '@/types/database';
import {
  fetchUserInterestIds,
  fetchUserInterestedEvents,
  addInterest,
  removeInterest,
} from '@/services/interests';

interface InterestsState {
  /** Set of event IDs the current user is interested in */
  interestedEventIds: Set<string>;
  /** Cached list of interested events for the profile view */
  interestedEvents: EventWithStats[];
  isLoading: boolean;
  isSaving: boolean;

  /** Load the user's interested event IDs (call after login) */
  initialize: (userId: string) => Promise<void>;
  /** Load full event data for the interested events list */
  loadInterestedEvents: (userId: string) => Promise<void>;
  /** Toggle interest for an event (optimistic update) */
  toggleInterest: (userId: string, eventId: string) => Promise<void>;
  /** Check if user is interested in an event */
  isInterested: (eventId: string) => boolean;
  /** Clear all state on logout */
  reset: () => void;
}

export const useInterestsStore = create<InterestsState>((set, get) => ({
  interestedEventIds: new Set(),
  interestedEvents: [],
  isLoading: false,
  isSaving: false,

  initialize: async (userId: string) => {
    set({ isLoading: true });
    try {
      const ids = await fetchUserInterestIds(userId);
      set({ interestedEventIds: new Set(ids), isLoading: false });
    } catch (err) {
      console.error('Failed to initialize interests:', err);
      set({ isLoading: false });
    }
  },

  loadInterestedEvents: async (userId: string) => {
    set({ isLoading: true });
    try {
      const events = await fetchUserInterestedEvents(userId);
      set({ interestedEvents: events, isLoading: false });
    } catch (err) {
      console.error('Failed to load interested events:', err);
      set({ isLoading: false });
    }
  },

  toggleInterest: async (userId: string, eventId: string) => {
    const { interestedEventIds, interestedEvents } = get();
    const wasInterested = interestedEventIds.has(eventId);

    // Capture pre-mutation state for revert
    const prevIds = new Set(interestedEventIds);
    const prevEvents = [...interestedEvents];

    // Optimistic update -- flip the state immediately
    const newIds = new Set(interestedEventIds);
    if (wasInterested) {
      newIds.delete(eventId);
      set({
        interestedEventIds: newIds,
        interestedEvents: interestedEvents.filter((e) => e.id !== eventId),
      });
    } else {
      newIds.add(eventId);
      set({ interestedEventIds: newIds });
    }

    try {
      if (wasInterested) {
        await removeInterest(userId, eventId);
      } else {
        await addInterest(userId, eventId);
      }
    } catch (err) {
      // Revert on failure using captured pre-mutation state
      console.error('Failed to toggle interest:', err);
      set({
        interestedEventIds: prevIds,
        interestedEvents: prevEvents,
      });
    }
  },

  isInterested: (eventId: string) => {
    return get().interestedEventIds.has(eventId);
  },

  reset: () => {
    set({
      interestedEventIds: new Set(),
      interestedEvents: [],
      isLoading: false,
      isSaving: false,
    });
  },
}));
