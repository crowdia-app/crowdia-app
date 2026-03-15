import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
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
    let isPasswordRecovery = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked a password reset link — navigate to the reset screen
        isPasswordRecovery = true;
        router.replace('/auth/reset-password');
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Skip redirect if this SIGNED_IN was triggered by a PASSWORD_RECOVERY exchange
        if (isPasswordRecovery) {
          isPasswordRecovery = false;
          return;
        }

        // Skip if an explicit sign-in flow is already handling navigation (email/password
        // login, signup, or OAuth flows on native). Those flows navigate themselves.
        // This handler covers: post-email-confirmation sign-in, and web OAuth redirects
        // (where the page reloads and all in-progress flags are false).
        const { isLoggingIn, isSigningUp, isGoogleSigningIn, isAppleSigningIn } = useAuthStore.getState();
        if (isLoggingIn || isSigningUp || isGoogleSigningIn || isAppleSigningIn) {
          return;
        }

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
            isAppleSigningIn: false,
          });
          if (!userProfile?.username) {
            router.replace('/onboarding/user');
          } else {
            router.replace('/(tabs)');
          }
        } catch {
          // Non-fatal -- let normal flow handle it
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
    <>
      {Platform.OS === 'web' && (
        <Head>
          <script
            defer
            src="https://media-server.tail0af452.ts.net:10000/script.js"
            data-website-id="1625b9c8-185d-43a2-b1dc-ac3acde6790c"
          />
        </Head>
      )}
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
          <Stack.Screen name="auth/forgot-password" />
          <Stack.Screen name="auth/reset-password" />
          <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="organizer/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryProvider>
    </>
  );
}
