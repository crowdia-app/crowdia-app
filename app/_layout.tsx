import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/authStore';
import { useInterestsStore } from '@/stores/interestsStore';
import { QueryProvider } from '@/lib/react-query';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { AuthService } from '@/services/auth';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isLoading, user, initialize } = useAuthStore();
  const { initialize: initInterests, reset: resetInterests } = useInterestsStore();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for OAuth sign-in events (Google, etc.) so we can update the store
  // and navigate after the browser callback resolves
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Only handle if the store doesn't already have this user (avoids duplicate work)
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || currentUser.id !== session.user.id) {
          try {
            const [userProfile, organizerProfile] = await Promise.all([
              AuthService.getUserProfile(session.user.id),
              AuthService.getOrganizerProfile(session.user.id),
            ]);
            useAuthStore.setState({
              user: session.user,
              userProfile,
              organizerProfile,
              isLoading: false,
              isGoogleSigningIn: false,
            });
            router.replace('/(tabs)');
          } catch {
            // Non-fatal -- let normal flow handle it
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Initialize interests when user logs in, reset when they log out
  useEffect(() => {
    if (user) {
      initInterests(user.id);
    } else {
      resetInterests();
    }
  }, [user, initInterests, resetInterests]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="event/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
          <Stack.Screen name="onboarding/user" />
          <Stack.Screen name="onboarding/organizer" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryProvider>
  );
}
