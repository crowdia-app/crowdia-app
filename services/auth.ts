import { supabase } from '@/lib/supabase';
import { AuthError } from '@supabase/supabase-js';

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

    // "Auth session missing" is expected when not logged in - not an error
    if (error && error.message !== 'Auth session missing!') {
      throw error;
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

  static async verifyOrganizerEmail(token: string, type: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'signup' | 'recovery' | 'invite' | 'magiclink',
    });

    if (error) throw error;
    return data;
  }
}
