import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { styles } from '@/styles/auth.styles';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoggingIn, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Login Failed', error || 'An error occurred');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        editable={!isLoggingIn}
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
        editable={!isLoggingIn}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <TouchableOpacity
        style={[styles.button, isLoggingIn && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoggingIn}
      >
        {isLoggingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/auth/signup')}>
        <Text style={styles.linkText}>Don&apos;t have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}
