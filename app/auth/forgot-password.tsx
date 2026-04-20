import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { createAuthStyles } from '@/styles/auth.styles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = createAuthStyles(colorScheme === 'dark');
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError(t.auth.forgotPassword.emailRequired);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t.auth.forgotPassword.invalidEmail);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Web: use origin so it works on any hostname (staging, prod).
      // Native: use the custom URL scheme so the deep link opens the native app directly,
      // keeping the PKCE code_verifier in SecureStore (same process) for a successful exchange.
      // NOTE: crowdiaapp://auth/reset-password must be in the Supabase allowed redirect URLs.
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/auth/reset-password`
        : 'crowdiaapp://auth/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      } else {
        setSuccess(true);
        setIsLoading(false);
      }
    } catch {
      setError(t.common.unexpectedError);
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t.auth.forgotPassword.checkEmail,
            headerBackTitle: t.common.back,
          }}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>{t.auth.forgotPassword.checkEmail}</Text>
            <Text style={styles.subtitle}>{t.auth.forgotPassword.checkEmailSubtitle}</Text>
          </View>

          <Text style={styles.successText}>
            {t.auth.forgotPassword.checkEmailBody(email)}
          </Text>

          <Text style={styles.helpText}>
            {t.auth.forgotPassword.checkEmailHelp}
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.buttonText}>{t.auth.forgotPassword.backToSignIn}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSuccess(false)}>
            <Text style={styles.linkText}>{t.auth.forgotPassword.didNotReceive}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t.auth.forgotPassword.title,
          headerBackTitle: t.common.back,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <GlowingLogo size={80} />
          <Text style={styles.title}>{t.auth.forgotPassword.title}</Text>
          <Text style={styles.subtitle}>{t.auth.forgotPassword.subtitle}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t.auth.emailLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.auth.emailPlaceholder}
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
            autoCapitalize="none"
            keyboardType="email-address"
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
            <Text style={styles.buttonText}>{t.auth.forgotPassword.sendResetLink}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>{t.auth.forgotPassword.backToSignIn}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </>
  );
}
