import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { styles } from '@/styles/auth.styles';

export default function OrganizerOnboardingScreen() {
  const router = useRouter();
  const { user, organizerProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState(organizerProfile?.organization_name || '');
  const [address, setAddress] = useState(organizerProfile?.address || '');
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    router.replace('/auth/login');
    return null;
  }

  const handleSaveProfile = async () => {
    if (!organizationName) {
      Alert.alert('Error', 'Please enter organization name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('organizers')
        .update({
          organization_name: organizationName,
          address: address || null,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Profile updated! Your account is pending verification.');
      router.replace('/(tabs)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert('Skip onboarding?', 'You can complete your profile later.', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Skip',
        onPress: () => router.replace('/(tabs)'),
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Organization Profile</Text>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#666' }}>
          Tell us about your organization. Your profile will be reviewed before going public.
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Organization Name *"
          value={organizationName}
          onChangeText={setOrganizationName}
          editable={!isLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Address (optional)"
          value={address}
          onChangeText={setAddress}
          editable={!isLoading}
          multiline
          numberOfLines={3}
        />

        <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
          <Text style={{ fontSize: 13, color: '#666', lineHeight: 18 }}>
            📋 Verification: Your organization will be reviewed by our team. We&apos;ll notify you once approved.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
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
