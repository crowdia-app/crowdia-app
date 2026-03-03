import { supabase } from '@/lib/supabase';
import { AuthError } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // Any auth error during init means no valid session -- clear stale state and continue
      console.warn('getCurrentUser error (clearing session):', error.message);
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
    return user;
  }

  static async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

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

  static async awardEmailConfirmationPoints(userId: string, currentPoints: number) {
    const { error } = await supabase
      .from('users')
      .update({
        points: currentPoints + 50,
        email_confirmed_points_awarded: true,
      })
      .eq('id', userId);

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
          // Handle implicit flow (hash params)
          const hashParams = new URLSearchParams(url.hash.replace('#', ''));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' });
          }
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('Google sign-in was cancelled');
      }
    }
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
