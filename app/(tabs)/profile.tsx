import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';
import { Colors, Magenta, Charcoal, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { GlowingLogo } from '@/components/ui/glowing-logo';

const numberFormatter = new Intl.NumberFormat();

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userProfile, organizerProfile, logout } = useAuthStore();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // On web, use window.confirm for non-blocking confirmation
      if (window.confirm('Are you sure you want to sign out?')) {
        logout().catch(() => {
          // Display error inline if needed
        });
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => {
              logout().catch(() => {
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              });
            },
          },
        ]
      );
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Logged out state
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.headerRow}>
            <GlowingLogo size={32} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Crowdia</Text>
          </View>
        </View>

        <View style={styles.centeredContent}>
          {/* Logo/Icon */}
          <View style={[styles.logoContainer, { backgroundColor: Magenta[500] }]}>
            <Ionicons name="sparkles" size={48} color="#FFFFFF" />
          </View>

          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            Welcome to Crowdia
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            Discover amazing events and connect with your community
          </Text>

          <View style={styles.authButtons}>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: Magenta[500] }]}
              onPress={() => router.push('/auth/signup')}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.divider }]}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Sign In
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Logged in state
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: Magenta[500] }]}>
            <Text style={styles.avatarText}>
              {getInitials(userProfile?.display_name)}
            </Text>
          </View>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {userProfile?.display_name || 'User'}
          </Text>
          {userProfile?.username ? (
            <Text style={[styles.username, { color: colors.textSecondary }]}>
              @{userProfile.username}
            </Text>
          ) : null}
        </View>

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Magenta[500] }]}>
              {numberFormatter.format(userProfile?.points || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Points
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Magenta[500] }]}>
              {numberFormatter.format(userProfile?.check_ins_count || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Check-ins
            </Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            ACCOUNT
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardRow}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                  Email
                </Text>
                <View style={styles.emailRow}>
                  <Text style={[styles.cardRowValue, { color: colors.text }]}>
                    {user.email}
                  </Text>
                  <Ionicons
                    name={user.email_confirmed_at ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={user.email_confirmed_at ? colors.success : colors.warning}
                  />
                </View>
              </View>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.cardRow}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                  Username
                </Text>
                <Text style={[styles.cardRowValue, { color: colors.text }]}>
                  {userProfile?.username || 'Not set'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Organization Section */}
        {organizerProfile ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              ORGANIZATION
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardRow}>
                <Ionicons name="business-outline" size={20} color={colors.textSecondary} />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    Name
                  </Text>
                  <Text style={[styles.cardRowValue, { color: colors.text }]}>
                    {organizerProfile.organization_name}
                  </Text>
                </View>
              </View>
              <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.cardRow}>
                <Ionicons
                  name={organizerProfile.is_verified ? 'shield-checkmark-outline' : 'time-outline'}
                  size={20}
                  color={organizerProfile.is_verified ? colors.success : colors.warning}
                />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    Status
                  </Text>
                  <Text
                    style={[
                      styles.cardRowValue,
                      { color: organizerProfile.is_verified ? colors.success : colors.warning },
                    ]}
                  >
                    {organizerProfile.is_verified ? 'Verified' : 'Pending Verification'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Points Breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            POINTS EARNED
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.pointsRow}>
              <View style={styles.pointsRowLeft}>
                <Ionicons name="person-add-outline" size={18} color={Magenta[500]} />
                <Text style={[styles.pointsRowText, { color: colors.text }]}>
                  Account Created
                </Text>
              </View>
              <Text style={[styles.pointsRowValue, { color: Magenta[500] }]}>+10</Text>
            </View>
            {userProfile?.email_confirmed_points_awarded ? (
              <>
                <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.pointsRow}>
                  <View style={styles.pointsRowLeft}>
                    <Ionicons name="mail-open-outline" size={18} color={Magenta[500]} />
                    <Text style={[styles.pointsRowText, { color: colors.text }]}>
                      Email Confirmed
                    </Text>
                  </View>
                  <Text style={[styles.pointsRowValue, { color: Magenta[500] }]}>+50</Text>
                </View>
              </>
            ) : null}
            {userProfile?.display_name && userProfile?.username ? (
              <>
                <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.pointsRow}>
                  <View style={styles.pointsRowLeft}>
                    <Ionicons name="checkmark-done-outline" size={18} color={Magenta[500]} />
                    <Text style={[styles.pointsRowText, { color: colors.text }]}>
                      Profile Completed
                    </Text>
                  </View>
                  <Text style={[styles.pointsRowValue, { color: Magenta[500] }]}>+25</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            LEGAL
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Pressable
              style={({ pressed }) => [styles.cardRow, pressed && { opacity: 0.6 }]}
              onPress={() => router.push('/legal/terms')}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: colors.text }]}>
                  Terms of Service
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
            <Pressable
              style={({ pressed }) => [styles.cardRow, pressed && { opacity: 0.6 }]}
              onPress={() => router.push('/legal/privacy')}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: colors.text }]}>
                  Privacy Policy
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          style={[styles.logoutButton, { backgroundColor: colors.card }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </Pressable>

        {/* Bottom Spacing */}
        <View style={{ height: insets.bottom + Spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },

  // Centered content for logged out state
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: 100,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  welcomeTitle: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    fontSize: Typography.base,
    textAlign: 'center',
    lineHeight: Typography.base * 1.5,
    marginBottom: Spacing.xxxl,
  },
  authButtons: {
    width: '100%',
    gap: Spacing.md,
  },
  primaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.base,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: Typography.base,
    fontWeight: '500',
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  displayName: {
    fontSize: Typography.xxl,
    fontWeight: '700',
  },
  username: {
    fontSize: Typography.sm,
    marginTop: Spacing.xs,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: Typography.xs,
  },
  statDivider: {
    width: 1,
    marginVertical: Spacing.xs,
  },

  // Sections
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },

  // Cards
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardRowContent: {
    flex: 1,
  },
  cardRowLabel: {
    fontSize: Typography.xs,
    marginBottom: 2,
  },
  cardRowValue: {
    fontSize: Typography.base,
    fontWeight: '500',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.md + 20 + Spacing.md,
  },

  // Points
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  pointsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pointsRowText: {
    fontSize: Typography.sm,
  },
  pointsRowValue: {
    fontSize: Typography.base,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  logoutText: {
    fontSize: Typography.base,
    fontWeight: '500',
  },
});
