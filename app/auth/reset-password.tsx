import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { createAuthStyles } from '@/styles/auth.styles';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const styles = createAuthStyles(colorScheme === 'dark');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  const confirmPasswordRef = useRef<TextInput>(null);

  useEffect(() => {
    // Check for recovery token in URL hash (web) or params (deep link)
    const checkRecoveryToken = async () => {
      try {
        // On web, Supabase automatically handles the hash fragment
        // We just need to check if there's a valid session with recovery type
        if (Platform.OS === 'web') {
          // Parse hash fragment from URL
          const hash = window.location.hash;
          if (hash && hash.includes('type=recovery')) {
            // Supabase client should automatically pick up the token
            const { data: { session }, error } = await supabase.auth.getSession();
            if (session && !error) {
              setIsValidToken(true);
            } else {
              setError('Invalid or expired reset link. Please request a new one.');
            }
          } else {
            setError('No recovery token found. Please use the link from your email.');
          }
        } else {
          // For native apps, check params
          const accessToken = params.access_token as string;
          const refreshToken = params.refresh_token as string;
          const type = params.type as string;

          if (type === 'recovery' && accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error) {
              setIsValidToken(true);
            } else {
              setError('Invalid or expired reset link. Please request a new one.');
            }
          } else {
            setError('No recovery token found. Please use the link from your email.');
          }
        }
      } catch {
        setError('Failed to verify reset link. Please try again.');
      } finally {
        setIsCheckingToken(false);
      }
    };

    checkRecoveryToken();
  }, [params]);

  const handleResetPassword = async () => {
    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
        // Sign out so user can log in with new password
        await supabase.auth.signOut();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (isCheckingToken) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Reset Password',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[styles.subtitle, { marginTop: 16 }]}>Verifying reset link...</Text>
        </View>
      </>
    );
  }

  if (!isValidToken) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Reset Password',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>Link Expired</Text>
            <Text style={styles.subtitle}>This reset link is no longer valid</Text>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.buttonText}>Request New Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
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
            title: 'Password Reset',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <GlowingLogo size={80} />
            <Text style={styles.title}>Password Updated</Text>
            <Text style={styles.subtitle}>Your password has been successfully reset</Text>
          </View>

          <Text style={styles.successText}>
            You can now sign in with your new password.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
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
          <Text style={styles.title}>Create New Password</Text>
          <Text style={styles.subtitle}>Enter your new password below</Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
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
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput
            ref={confirmPasswordRef}
            style={styles.input}
            placeholder="••••••••"
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
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </>
  );
}
