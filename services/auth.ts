import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
  isOrganizer?: boolean;
  organizationName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  static async signUp(input: SignUpInput) {
    const { email, password } = input;

    // Create auth user - profile is auto-created by database trigger
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    return authData;
  }

  static async login(input: LoginInput) {
    const { email, password } = input;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  static async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getCurrentUser() {
    // Use getSession() instead of getUser() for initialization -- getSession() reads from
    // local storage and avoids a network call that can hang indefinitely on slow/offline networks.
    // getUser() validates the JWT with the server on every call, which is unnecessary during
    // app startup and causes infinite loading when the network is unavailable.
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }
    return session.user;
  }

  static async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async getOrganizerProfile(userId: string) {
    const { data, error } = await supabase
      .from('organizers')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateProfile(userId: string, updates: { display_name?: string; bio?: string; profile_image_url?: string }) {
    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();

    if (error) throw error;
    return data;
  }

  static async awardEmailConfirmationPoints(userId: string) {
    const { error } = await supabase.rpc('award_email_confirmation_points', {
      user_id_param: userId,
    });

    if (error) throw error;

    // Fetch and return updated profile
    return await AuthService.getUserProfile(userId);
  }

  static async signInWithGoogle(): Promise<void> {
    if (Platform.OS === 'web') {
      // On web, redirect to Google OAuth and come back to the app
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://app.crowdia.ai',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } else {
      // On native, open the OAuth URL in a browser tab and wait for the deep link redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'crowdiaapp://auth/callback',
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, 'crowdiaapp://auth/callback');

      if (result.type === 'success' && result.url) {
        // Extract the code/tokens from the callback URL and exchange them
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          throw new Error('No authorization code in callback URL');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Google sign-in was cancelled');
      }
    }
  }

  static async signInWithApple(): Promise<void> {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: 'https://app.crowdia.ai' },
      });
      if (error) throw error;
    } else {
      // Native iOS Sign In with Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    }
  }

  static async awardReferralPoints(referredUserId: string) {
    const { error } = await supabase.rpc('award_referral_points', {
      referred_user_id: referredUserId,
    });
    if (error) console.error('Failed to award referral points:', error);
  }

  static async applyReferralCode(userId: string, referralCode: string) {
    // Look up the referrer by code
    const { data: referrer, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode.toUpperCase())
      .maybeSingle();

    if (lookupError || !referrer) {
      throw new Error('Invalid referral code');
    }

    if (referrer.id === userId) {
      throw new Error('You cannot use your own referral code');
    }

    // Link the referrer
    const { error: updateError } = await supabase
      .from('users')
      .update({ referred_by: referrer.id })
      .eq('id', userId)
      .is('referred_by', null); // Only set once

    if (updateError) throw updateError;

    return referrer.id;
  }

  static async fetchLeaderboard(limit = 50) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('rank, display_name, username, profile_image_url, points, check_ins_count')
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Array<{
      rank: number;
      display_name: string | null;
      username: string | null;
      profile_image_url: string | null;
      points: number | null;
      check_ins_count: number | null;
    }>;
  }

  static async verifyOrganizerEmail(token: string, type: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'signup' | 'recovery' | 'invite' | 'magiclink',
    });

    if (error) throw error;
    return data;
  }
}
