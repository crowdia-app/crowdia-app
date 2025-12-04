import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { styles } from '@/styles/auth.styles';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, isSigningUp, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await signUp(email, password);
      // Redirect to onboarding to complete profile
      router.replace('/onboarding/user');
    } catch {
      Alert.alert('Signup Failed', error || 'An error occurred');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          editable={!isSigningUp}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />

        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          editable={!isSigningUp}
          secureTextEntry
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          blurOnSubmit={false}
        />

        <TextInput
          ref={confirmPasswordRef}
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#999"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!isSigningUp}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={handleSignup}
        />

        <TouchableOpacity
          style={[styles.button, isSigningUp && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={isSigningUp}
        >
          {isSigningUp ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
