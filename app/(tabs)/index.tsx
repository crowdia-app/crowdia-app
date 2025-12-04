import { TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const { user, userProfile, organizerProfile, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      alert('Logout failed');
    }
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">
          {user
            ? userProfile?.display_name
              ? `Welcome, ${userProfile.display_name}!`
              : 'Welcome!'
            : 'Welcome to Crowdia'}
        </ThemedText>
      </ThemedView>

      {user && (
        <ThemedView style={styles.userInfoContainer}>
          <ThemedText type="subtitle">Your Profile</ThemedText>
          {userProfile?.display_name && (
            <ThemedText>
              <ThemedText type="defaultSemiBold">Name:</ThemedText> {userProfile.display_name}
            </ThemedText>
          )}
          <ThemedText>
            <ThemedText type="defaultSemiBold">Email:</ThemedText> {user.email}
          </ThemedText>
          <ThemedText>
            <ThemedText type="defaultSemiBold">Email Status:</ThemedText>{' '}
            {user.email_confirmed_at ? '✅ Confirmed' : '⚠️ Not Confirmed'}
          </ThemedText>
          <ThemedText>
            <ThemedText type="defaultSemiBold">Username:</ThemedText> {userProfile?.username || 'Not set'}
          </ThemedText>
          <ThemedText>
            <ThemedText type="defaultSemiBold">Check-ins:</ThemedText> {userProfile?.check_ins_count || 0}
          </ThemedText>

          {organizerProfile && (
            <ThemedView style={styles.organizerInfo}>
              <ThemedText type="subtitle">Organization</ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">Name:</ThemedText> {organizerProfile.organization_name}
              </ThemedText>
              <ThemedText>
                <ThemedText type="defaultSemiBold">Status:</ThemedText>{' '}
                {organizerProfile.is_verified ? '✅ Verified' : '⏳ Pending Verification'}
              </ThemedText>
            </ThemedView>
          )}

          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <ThemedText style={styles.buttonText}>Logout</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {!user && (
        <ThemedView style={styles.authContainer}>
          <ThemedText type="subtitle">Get Started</ThemedText>
          <ThemedText style={styles.description}>
            Join Crowdia to discover and attend amazing events in your community.
          </ThemedText>

          <TouchableOpacity style={styles.button} onPress={() => router.push('/auth/signup')}>
            <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/auth/login')}>
            <ThemedText style={styles.secondaryButtonText}>Already have an account? Login</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {user && userProfile && (
        <ThemedView style={styles.pointsContainer}>
          <ThemedText type="subtitle">Points</ThemedText>
          <ThemedView style={styles.pointsTotal}>
            <ThemedText type="title">{userProfile.points || 0}</ThemedText>
            <ThemedText style={styles.pointsLabel}>total points</ThemedText>
          </ThemedView>
          <ThemedView style={styles.pointsList}>
            <ThemedView style={styles.pointsItem}>
              <ThemedText>Account Created</ThemedText>
              <ThemedText type="defaultSemiBold">+10</ThemedText>
            </ThemedView>
            {userProfile.email_confirmed_points_awarded && (
              <ThemedView style={styles.pointsItem}>
                <ThemedText>Email Confirmed</ThemedText>
                <ThemedText type="defaultSemiBold">+50</ThemedText>
              </ThemedView>
            )}
            {userProfile.display_name && userProfile.username && (
              <ThemedView style={styles.pointsItem}>
                <ThemedText>Profile Completed</ThemedText>
                <ThemedText type="defaultSemiBold">+25</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  titleContainer: {
    marginBottom: 16,
  },
  userInfoContainer: {
    gap: 12,
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  organizerInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 122, 255, 0.3)',
    gap: 8,
  },
  authContainer: {
    gap: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  description: {
    marginBottom: 8,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  pointsContainer: {
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  pointsTotal: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pointsLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  pointsList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 193, 7, 0.3)',
    paddingTop: 12,
  },
  pointsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
