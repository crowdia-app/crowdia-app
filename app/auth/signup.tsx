import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useRef } from 'react';
import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { createAuthStyles } from '@/styles/auth.styles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { GoogleIcon } from '@/components/ui/google-icon';
import { AppleIcon } from '@/components/ui/apple-icon';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';

// On web, wrap form fields in a <form> so browsers recognize it for autofill
function FormWrapper({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <form
      onSubmit={(e: any) => { e.preventDefault(); onSubmit(); }}
      style={{ display: 'contents' }}
      autoComplete="on"
    >
      {children}
    </form>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = createAuthStyles(colorScheme === 'dark');
  const t = useTranslation();
  const { signUp, isSigningUp, signInWithGoogle, isGoogleSigningIn, signInWithApple, isAppleSigningIn, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleGoogleSignIn = async () => {
    clearError();
    try {
      await signInWithGoogle();
      if (Platform.OS !== 'web') {
        const { userProfile } = useAuthStore.getState();
        if (!userProfile?.username) {
          router.replace('/onboarding/user');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch {
      // Error displayed via store's error state
    }
  };

  const handleAppleSignIn = async () => {
    clearError();
    try {
      await signInWithApple();
      if (Platform.OS !== 'web') {
        router.replace('/(tabs)');
      }
    } catch {
      // Error displayed via store's error state
    }
  };

  const isAnyLoading = isSigningUp || isGoogleSigningIn || isAppleSigningIn;

  const handleSignup = async () => {
    setValidationError(null);

    if (!email || !password) {
      setValidationError(t.auth.signup.enterEmailAndPassword);
      return;
    }

    if (password !== confirmPassword) {
      setValidationError(t.auth.signup.passwordsDoNotMatch);
      return;
    }

    if (password.length < 6) {
      setValidationError(t.auth.signup.passwordTooShort);
      return;
    }

    clearError();

    try {
      await signUp(email, password);
      // Check if a session was established. When email confirmation is required,
      // Supabase returns a user but no session. In that case, we can't write to
      // the DB (RLS requires auth.uid()), so we show a "check your email" screen
      // instead of routing to onboarding where the profile upsert would fail.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/onboarding/user');
      } else {
        setPendingEmail(email);
        setEmailConfirmationPending(true);
      }
    } catch {
      // Error is displayed inline via the store's error state
    }
  };

  const displayError = validationError || error;

  if (emailConfirmationPending) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>{t.auth.emailConfirmation.title}</Text>
            <Text style={styles.subtitle}>{t.auth.emailConfirmation.subtitle}</Text>
          </View>
          <Text style={styles.successText}>{t.auth.emailConfirmation.body(pendingEmail)}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            <View style={styles.header}>
              <GlowingLogo size={80} />
              <Text style={styles.title}>{t.auth.signup.title}</Text>
              <Text style={styles.subtitle}>{t.auth.signup.subtitle}</Text>
            </View>

            {displayError && <Text style={styles.errorText}>{displayError}</Text>}

            <FormWrapper onSubmit={handleSignup}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.auth.emailLabel}</Text>
                <TextInput
                  nativeID="email"
                  style={styles.input}
                  placeholder={t.auth.emailPlaceholder}
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isAnyLoading}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.auth.passwordLabel}</Text>
                <TextInput
                  nativeID="new-password"
                  ref={passwordRef}
                  style={styles.input}
                  placeholder={t.auth.passwordPlaceholder}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  editable={!isAnyLoading}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <Text style={styles.helpText}>{t.auth.signup.passwordHelp}</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.auth.signup.confirmPasswordLabel}</Text>
                <TextInput
                  nativeID="confirm-password"
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder={t.auth.passwordPlaceholder}
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isAnyLoading}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={handleSignup}
                />
              </View>

              <Text style={styles.termsText}>
                {t.auth.signup.termsPrefix}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push('/legal/terms')}
                >
                  {t.auth.signup.termsLink}
                </Text>
                {t.auth.signup.termsAnd}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push('/legal/privacy')}
                >
                  {t.auth.signup.privacyLink}
                </Text>
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  isAnyLoading && styles.buttonDisabled,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleSignup}
                disabled={isAnyLoading}
              >
                {isSigningUp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t.auth.signup.createAccountButton}</Text>
                )}
              </Pressable>
            </FormWrapper>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.common.or}</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                isAnyLoading && styles.buttonDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleGoogleSignIn}
              disabled={isAnyLoading}
            >
              {isGoogleSigningIn ? (
                <ActivityIndicator color="#444" />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={styles.googleButtonText}>{t.auth.signup.continueGoogle}</Text>
                </>
              )}
            </Pressable>

            {Platform.OS !== 'android' && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t.common.or}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.appleButton,
                    isAnyLoading && styles.buttonDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleAppleSignIn}
                  disabled={isAnyLoading}
                >
                  {isAppleSigningIn ? (
                    <ActivityIndicator color={colorScheme === 'dark' ? '#000' : '#fff'} />
                  ) : (
                    <>
                      <AppleIcon size={20} color={colorScheme === 'dark' ? '#000' : '#fff'} />
                      <Text style={styles.appleButtonText}>{t.auth.signup.continueApple}</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.common.or}</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.secondaryButtonText}>{t.auth.signup.signInExisting}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
