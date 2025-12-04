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
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
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

    if (isOrganizer && !organizationName.trim()) {
      Alert.alert('Error', 'Please enter your organization name');
      return;
    }

    setIsLoading(true);
    try {
      // Update user profile and award 25 points for completing profile
      const { error: profileError } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          points: (userProfile?.points || 0) + 25,
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Refresh the store with updated profile
      await refreshProfile();

      // If organizer, create organizer profile
      if (isOrganizer) {
        const { error: organizerError } = await supabase
          .from('organizers')
          .insert({
            id: user?.id,
            organization_name: organizationName.trim(),
            is_verified: false,
          });

        if (organizerError) throw organizerError;

        // Go to organizer-specific onboarding
        router.replace('/onboarding/organizer');
      } else {
        // Go to main app
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
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
          style={[styles.toggleButton, isOrganizer && styles.toggleButtonActive]}
          onPress={() => setIsOrganizer(!isOrganizer)}
          disabled={isLoading}
        >
          <Text style={[styles.toggleText, isOrganizer && styles.toggleTextActive]}>
            {isOrganizer ? '✓ ' : ''}I want to create events (Organizer)
          </Text>
        </TouchableOpacity>

        {isOrganizer && (
          <TextInput
            style={styles.input}
            placeholder="Organization Name"
            placeholderTextColor="#999"
            value={organizationName}
            onChangeText={setOrganizationName}
            editable={!isLoading}
          />
        )}

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
