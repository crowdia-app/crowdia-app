import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { AuthService } from '@/services/auth';
import { Database } from '@/types/database';

type UserProfile = Database['public']['Tables']['users']['Row'];
type OrganizerProfile = Database['public']['Tables']['organizers']['Row'];

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  organizerProfile: OrganizerProfile | null;
  isLoading: boolean;
  error: string | null;
  isSigningUp: boolean;
  isLoggingIn: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string, username?: string, isOrganizer?: boolean, organizationName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  organizerProfile: null,
  isLoading: true,
  error: null,
  isSigningUp: false,
  isLoggingIn: false,

  initialize: async () => {
    try {
      const user = await AuthService.getCurrentUser();
      if (user) {
        let [userProfile, organizerProfile] = await Promise.all([
          AuthService.getUserProfile(user.id),
          AuthService.getOrganizerProfile(user.id),
        ]);

        // Check if email is confirmed and points haven't been awarded yet
        if (
          user.email_confirmed_at &&
          userProfile &&
          !userProfile.email_confirmed_points_awarded
        ) {
          // Award 50 points for email confirmation
          userProfile = await AuthService.awardEmailConfirmationPoints(
            user.id,
            userProfile.points
          );
        }

        set({
          user,
          userProfile,
          organizerProfile,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize auth',
        isLoading: false,
      });
    }
  },

  signUp: async (email, password, displayName, username, isOrganizer = false, organizationName = '') => {
    set({ isSigningUp: true, error: null });
    try {
      const authData = await AuthService.signUp({
        email,
        password,
        displayName,
        username,
        isOrganizer,
        organizationName: isOrganizer ? organizationName : undefined,
      });

      if (authData.user) {
        const [userProfile, organizerProfile] = await Promise.all([
          AuthService.getUserProfile(authData.user.id),
          isOrganizer ? AuthService.getOrganizerProfile(authData.user.id) : Promise.resolve(null),
        ]);

        set({
          user: authData.user,
          userProfile,
          organizerProfile,
          isSigningUp: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Sign up failed',
        isSigningUp: false,
      });
      throw error;
    }
  },

  login: async (email, password) => {
    set({ isLoggingIn: true, error: null });
    try {
      const authData = await AuthService.login({ email, password });

      if (authData.user) {
        let [userProfile, organizerProfile] = await Promise.all([
          AuthService.getUserProfile(authData.user.id),
          AuthService.getOrganizerProfile(authData.user.id),
        ]);

        // Check if email is confirmed and points haven't been awarded yet
        if (
          authData.user.email_confirmed_at &&
          userProfile &&
          !userProfile.email_confirmed_points_awarded
        ) {
          // Award 50 points for email confirmation
          userProfile = await AuthService.awardEmailConfirmationPoints(
            authData.user.id,
            userProfile.points
          );
        }

        set({
          user: authData.user,
          userProfile,
          organizerProfile,
          isLoggingIn: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoggingIn: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await AuthService.logout();
      set({
        user: null,
        userProfile: null,
        organizerProfile: null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Logout failed',
        isLoading: false,
      });
      throw error;
    }
  },

  refreshProfile: async () => {
    const state = useAuthStore.getState();
    if (!state.user) return;

    try {
      const [userProfile, organizerProfile] = await Promise.all([
        AuthService.getUserProfile(state.user.id),
        AuthService.getOrganizerProfile(state.user.id),
      ]);

      set({ userProfile, organizerProfile });
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  },

  clearError: () => set({ error: null }),
}));
