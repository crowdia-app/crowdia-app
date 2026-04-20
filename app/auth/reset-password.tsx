import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { createAuthStyles } from '@/styles/auth.styles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/hooks/useTranslation';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const styles = createAuthStyles(colorScheme === 'dark');
  const t = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  const confirmPasswordRef = useRef<TextInput>(null);

  useEffect(() => {
    let resolved = false;

    const resolve = (valid: boolean, errorMsg?: string) => {
      if (resolved) return;
      resolved = true;
      setIsValidToken(valid);
      if (errorMsg) setError(errorMsg);
      setIsCheckingToken(false);
    };

    // Listen for PASSWORD_RECOVERY, SIGNED_IN, or INITIAL_SESSION — whichever fires first wins.
    // INITIAL_SESSION covers the race condition where detectSessionInUrl (which auto-exchanges
    // the PKCE code at client creation time) completes before this listener is registered.
    // We must NOT call exchangeCodeForSession manually because detectSessionInUrl: true already
    // handles the exchange — calling it twice causes "auth code already used" → false negative.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        resolve(true);
      } else if (event === 'SIGNED_IN' && session) {
        resolve(true);
      } else if (event === 'INITIAL_SESSION' && session) {
        // detectSessionInUrl completed before we registered — session already active
        resolve(true);
      }
    });

    const checkExistingSession = async () => {
      // 1. Fast path: detectSessionInUrl may have already completed the exchange
      const { data: { session: immediateSession } } = await supabase.auth.getSession();
      if (immediateSession) {
        resolve(true);
        return;
      }

      // 2. On web, check for Supabase error params in the URL (e.g. expired link)
      if (Platform.OS === 'web') {
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (errorParam) {
          resolve(false, errorDescription || 'Invalid or expired reset link. Please request a new one.');
          return;
        }
      }

      // 3. On native, detectSessionInUrl uses Linking.getInitialURL() which only works on cold
      //    start. If the app was already running when the deep link arrived, the code is only
      //    available via the URL params — exchange it manually here.
      if (Platform.OS !== 'web' && params.code) {
        try {
          await supabase.auth.exchangeCodeForSession(params.code as string);
        } catch {
          // Ignore — may already be exchanged by detectSessionInUrl on cold start.
          // If it failed for a real reason, getSession() below will return null and
          // we'll show the "link expired" error.
        }
        const { data: { session: afterExchange } } = await supabase.auth.getSession();
        if (afterExchange) {
          resolve(true);
          return;
        }
      }

      // 4. Wait for detectSessionInUrl to finish the async PKCE exchange on web.
      await new Promise(r => setTimeout(r, 5000));

      if (resolved) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        resolve(true);
        return;
      }

      resolve(false, 'Invalid or expired reset link. Please request a new one.');
    };

    checkExistingSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [params]);

  const handleResetPassword = async () => {
    if (!password) {
      setError(t.auth.resetPassword.enterPasswordFirst);
      return;
    }

    if (password.length < 6) {
      setError(t.auth.resetPassword.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.auth.resetPassword.passwordsDoNotMatch);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      } else {
        setSuccess(true);
        setIsLoading(false);
        // Sign out and clear the store so the user can log in with their new password
        await useAuthStore.getState().logout().catch(() => {});
      }
    } catch {
      setError(t.common.unexpectedError);
      setIsLoading(false);
    }
  };

  if (isCheckingToken) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t.auth.resetPassword.title,
            headerBackTitle: t.common.back,
          }}
        />
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>{t.auth.resetPassword.verifying}</Text>
        </View>
      </>
    );
  }

  if (!isValidToken) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t.auth.resetPassword.title,
            headerBackTitle: t.common.back,
          }}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>{t.auth.resetPassword.linkExpired}</Text>
            <Text style={styles.subtitle}>{t.auth.resetPassword.linkExpiredSubtitle}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.buttonText}>{t.auth.resetPassword.requestNewLink}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.secondaryButtonText}>{t.auth.forgotPassword.backToSignIn}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t.auth.resetPassword.title,
            headerBackTitle: t.common.back,
          }}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>{t.auth.resetPassword.successTitle}</Text>
            <Text style={styles.subtitle}>{t.auth.resetPassword.successSubtitle}</Text>
          </View>

          <Text style={styles.successText}>
            {t.auth.resetPassword.successBody}
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.buttonText}>{t.auth.resetPassword.signInButton}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t.auth.resetPassword.title,
          headerBackTitle: t.common.back,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <GlowingLogo size={80} />
          <Text style={styles.title}>{t.auth.resetPassword.title}</Text>
          <Text style={styles.subtitle}>{t.auth.resetPassword.subtitle}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t.auth.resetPassword.newPasswordLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.auth.passwordPlaceholder}
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t.auth.resetPassword.confirmPasswordLabel}</Text>
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder={t.auth.passwordPlaceholder}
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!isLoading}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleResetPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t.auth.resetPassword.resetButton}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.secondaryButtonText}>{t.common.cancel}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </>
  );
}
