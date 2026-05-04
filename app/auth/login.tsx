import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { createAuthStyles } from '@/styles/auth.styles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { GoogleIcon } from '@/components/ui/google-icon';
import { AppleIcon } from '@/components/ui/apple-icon';
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

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = createAuthStyles(colorScheme === 'dark');
  const t = useTranslation();
  const { login, isLoggingIn, signInWithGoogle, isGoogleSigningIn, signInWithApple, isAppleSigningIn, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    setValidationError(null);
    if (!email || !password) {
      setValidationError(t.auth.login.fillAllFields);
      return;
    }

    clearError();

    try {
      await login(email, password);
      const { userProfile } = useAuthStore.getState();
      if (!userProfile?.username) {
        router.replace('/onboarding/user');
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      // Error is displayed inline via the store's error state
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    try {
      await signInWithGoogle();
      // On native the session is set synchronously after code exchange
      if (Platform.OS !== 'web') {
        const { userProfile } = useAuthStore.getState();
        if (!userProfile?.username) {
          router.replace('/onboarding/user');
        } else {
          router.replace('/(tabs)');
        }
      }
      // On web the page redirects; nothing to do here
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

  const isAnyLoading = isLoggingIn || isGoogleSigningIn || isAppleSigningIn;

  const displayError = validationError || error;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <GlowingLogo size={80} />
          <Text style={styles.title}>{t.auth.login.title}</Text>
          <Text style={styles.subtitle}>{t.auth.login.subtitle}</Text>
        </View>

        {displayError && <Text style={styles.errorText}>{displayError}</Text>}

        <FormWrapper onSubmit={handleLogin}>
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
              nativeID="password"
              ref={passwordRef}
              style={styles.input}
              placeholder={t.auth.passwordPlaceholder}
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              editable={!isAnyLoading}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
            <Pressable onPress={() => router.push('/auth/forgot-password')}>
              <Text style={styles.forgotPasswordLink}>{t.auth.login.forgotPassword}</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              isAnyLoading && styles.buttonDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleLogin}
            disabled={isAnyLoading}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t.auth.login.signInButton}</Text>
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
              <Text style={styles.googleButtonText}>{t.auth.login.continueGoogle}</Text>
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
                  <Text style={styles.appleButtonText}>{t.auth.login.continueApple}</Text>
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
          onPress={() => router.push('/auth/signup')}
        >
          <Text style={styles.secondaryButtonText}>{t.auth.login.createAccount}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </>
  );
}
