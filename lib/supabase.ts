import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Check if running in browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Cross-platform storage adapter
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isBrowser) {
      return window.localStorage.getItem(key);
    }
    if (Platform.OS !== 'web') {
      return await SecureStore.getItemAsync(key);
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isBrowser) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (isBrowser) {
      window.localStorage.removeItem(key);
      return;
    }
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
