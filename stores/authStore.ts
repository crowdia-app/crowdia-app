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
  isGoogleSigningIn: boolean;
  isAppleSigningIn: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string, username?: string, isOrganizer?: boolean, organizationName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

/** Extract error message from any thrown value */
function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  if (typeof error === 'string') return error;
  return String(error);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  organizerProfile: null,
  isLoading: true,
  error: null,
  isSigningUp: false,
  isLoggingIn: false,
  isGoogleSigningIn: false,
  isAppleSigningIn: false,

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
          userProfile = await AuthService.awardEmailConfirmationPoints(user.id);
          // Award referral points to the referrer if this user was referred
          if (userProfile?.referred_by) {
            await AuthService.awardReferralPoints(user.id);
          }
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
      // Init errors should never block the login page
      console.error('Auth init error:', error);
      set({ isLoading: false });
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
        error: getErrorMessage(error),
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
          // Award referral points to the referrer if this user was referred
          if (userProfile?.referred_by) {
            await AuthService.awardReferralPoints(authData.user.id);
          }
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
        error: getErrorMessage(error),
        isLoggingIn: false,
      });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    set({ isGoogleSigningIn: true, error: null });
    try {
      await AuthService.signInWithGoogle();
      // For web, the page will redirect. For native, session is set after code exchange.
      // Fetch the user/profile if session is now available.
      const user = await AuthService.getCurrentUser();
      if (user) {
        let [userProfile, organizerProfile] = await Promise.all([
          AuthService.getUserProfile(user.id),
          AuthService.getOrganizerProfile(user.id),
        ]);

        // Google users are inherently email-verified -- award confirmation points if not yet awarded
        if (userProfile && !userProfile.email_confirmed_points_awarded) {
          userProfile = await AuthService.awardEmailConfirmationPoints(user.id);
          if (userProfile?.referred_by) {
            await AuthService.awardReferralPoints(user.id);
          }
        }

        set({ user, userProfile, organizerProfile, isGoogleSigningIn: false });
      } else {
        // Web redirect case -- page is navigating away, just clear the loading state
        set({ isGoogleSigningIn: false });
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      // Don't surface cancellation as an error
      if (msg === 'Google sign-in was cancelled') {
        set({ isGoogleSigningIn: false });
      } else {
        set({ error: msg, isGoogleSigningIn: false });
        throw error;
      }
    }
  },

  signInWithApple: async () => {
    set({ isAppleSigningIn: true, error: null });
    try {
      await AuthService.signInWithApple();
      // For web, the page will redirect. For native, session is set after signInWithIdToken.
      const user = await AuthService.getCurrentUser();
      if (user) {
        let [userProfile, organizerProfile] = await Promise.all([
          AuthService.getUserProfile(user.id),
          AuthService.getOrganizerProfile(user.id),
        ]);

        // Apple users are email-verified -- award confirmation points if not yet awarded
        if (userProfile && !userProfile.email_confirmed_points_awarded) {
          userProfile = await AuthService.awardEmailConfirmationPoints(user.id);
          if (userProfile?.referred_by) {
            await AuthService.awardReferralPoints(user.id);
          }
        }

        set({ user, userProfile, organizerProfile, isAppleSigningIn: false });
      } else {
        // Web redirect case
        set({ isAppleSigningIn: false });
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      // Don't surface cancellation as an error
      if (msg.includes('canceled') || msg.includes('cancelled') || msg.includes('ERR_REQUEST_CANCELED')) {
        set({ isAppleSigningIn: false });
      } else {
        set({ error: msg, isAppleSigningIn: false });
        throw error;
      }
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
        error: getErrorMessage(error),
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
