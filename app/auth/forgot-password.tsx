import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { createAuthStyles } from '@/styles/auth.styles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { supabase } from '@/services/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = createAuthStyles(colorScheme === 'dark');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'crowdia://reset-password',
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      } else {
        setSuccess(true);
        setIsLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Check Your Email',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subtitle}>We've sent you a password reset link</Text>
          </View>

          <Text style={styles.successText}>
            If an account exists with {email}, you will receive an email with instructions to reset your password.
          </Text>

          <Text style={styles.helpText}>
            Please check your inbox and spam folder. The link will expire in 1 hour.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSuccess(false)}>
            <Text style={styles.linkText}>Didn't receive the email? Try again</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Reset Password',
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <GlowingLogo size={80} />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
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
            <Text style={styles.buttonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </>
  );
}
