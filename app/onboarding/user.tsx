import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { styles } from '@/styles/auth.styles';
import { supabase } from '@/lib/supabase';

export default function UserOnboardingScreen() {
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(userProfile?.display_name || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your display name');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'Please choose a username');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Session expired. Please log in again.');
      return;
    }

    setIsLoading(true);
    try {
      // Upsert user profile and award 25 points for completing profile
      // (upsert handles the edge case where the stub row was not yet created)
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          points: (userProfile?.points || 0) + 25,
        });

      if (profileError) throw profileError;

      // Refresh the store with updated profile
      await refreshProfile();

      // Go to main app — organizer requests are submitted from the Profile screen
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Onboarding error:', err);
      const pgError = err as { code?: string; message?: string };
      if (pgError?.code === '23505') {
        Alert.alert('Username taken', 'That username is already in use. Please choose a different one.');
      } else {
        Alert.alert('Error', 'Failed to save profile. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor="#999"
          value={displayName}
          onChangeText={setDisplayName}
          editable={!isLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} disabled={isLoading}>
          <Text style={styles.linkText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
