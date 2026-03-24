import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  useColorScheme,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useInterestsStore } from '@/stores/interestsStore';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Magenta, Charcoal, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { GlowingLogo } from '@/components/ui/glowing-logo';
import { EventCard } from '@/components/events/EventCard';
import {
  getMyOrganizerRequest,
  submitOrganizerRequest,
  type OrganizerRequest,
} from '@/services/organizer-requests';
import {
  getMyVoiceRequest,
  submitVoiceRequest,
  type VoiceRequest,
} from '@/services/voices';

const numberFormatter = new Intl.NumberFormat();

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userProfile, organizerProfile, logout } = useAuthStore();
  const { interestedEvents, isLoading: interestsLoading, loadInterestedEvents } = useInterestsStore();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  // Organizer request state
  const [orgRequest, setOrgRequest] = useState<OrganizerRequest | null | undefined>(undefined);
  const [showOrgRequestModal, setShowOrgRequestModal] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgReason, setOrgReason] = useState('');
  const [isSubmittingOrgRequest, setIsSubmittingOrgRequest] = useState(false);

  // Voice request state
  const [voiceRequest, setVoiceRequest] = useState<VoiceRequest | null | undefined>(undefined);
  const [showVoiceRequestModal, setShowVoiceRequestModal] = useState(false);
  const [voiceInstagram, setVoiceInstagram] = useState('');
  const [voiceReason, setVoiceReason] = useState('');
  const [isSubmittingVoiceRequest, setIsSubmittingVoiceRequest] = useState(false);

  // Reload saved events every time this tab is focused (same pattern as saved.tsx)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadInterestedEvents(user.id);
      }
    }, [user, loadInterestedEvents])
  );

  // Load organizer request status
  const loadOrgRequest = useCallback(async () => {
    if (!user) return;
    const req = await getMyOrganizerRequest();
    setOrgRequest(req);
  }, [user]);

  useEffect(() => {
    loadOrgRequest();
  }, [loadOrgRequest]);

  // Load voice request status
  const loadVoiceRequest = useCallback(async () => {
    if (!user) return;
    const req = await getMyVoiceRequest();
    setVoiceRequest(req);
  }, [user]);

  useEffect(() => {
    loadVoiceRequest();
  }, [loadVoiceRequest]);

  const handleSubmitOrgRequest = async () => {
    if (!user || !orgName.trim()) return;
    setIsSubmittingOrgRequest(true);
    try {
      await submitOrganizerRequest(user.id, orgName.trim(), orgReason.trim() || undefined);
      setShowOrgRequestModal(false);
      setOrgName('');
      setOrgReason('');
      await loadOrgRequest();
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit request';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsSubmittingOrgRequest(false);
    }
  };

  const handleSubmitVoiceRequest = async () => {
    if (!user) return;
    setIsSubmittingVoiceRequest(true);
    try {
      await submitVoiceRequest(
        user.id,
        voiceInstagram.trim() || undefined,
        voiceReason.trim() || undefined
      );
      setShowVoiceRequestModal(false);
      setVoiceInstagram('');
      setVoiceReason('');
      await loadVoiceRequest();
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit request';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsSubmittingVoiceRequest(false);
    }
  };

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
              {numberFormatter.format(interestedEvents.length)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Saved
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

        {/* Organizer: Manage Events */}
        {organizerProfile ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              MANAGE
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.cardRow,
                { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => router.push('/organizer/events')}
            >
              <Ionicons name="calendar-outline" size={20} color={Magenta[500]} />
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardRowValue, { color: colors.text }]}>
                  My Events
                </Text>
                <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                  Create and manage your events
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* Become an Organizer / Request Status */}
        {!organizerProfile ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              ORGANIZER
            </Text>
            {orgRequest === undefined ? null : orgRequest === null ? (
              // No request submitted yet
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  styles.cardRow,
                  { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setShowOrgRequestModal(true)}
              >
                <Ionicons name="business-outline" size={20} color={Magenta[500]} />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowValue, { color: colors.text }]}>
                    Become an Organizer
                  </Text>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    Request to host events on Crowdia
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ) : orgRequest.status === 'pending' ? (
              // Request pending
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardRow}>
                  <Ionicons name="time-outline" size={20} color={colors.warning} />
                  <View style={styles.cardRowContent}>
                    <Text style={[styles.cardRowValue, { color: colors.text }]}>
                      Request Under Review
                    </Text>
                    <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                      {orgRequest.organization_name} · Submitted{' '}
                      {new Date(orgRequest.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.requestStatusBadge, { borderColor: colors.warning }]}>
                    <Text style={[styles.requestStatusText, { color: colors.warning }]}>Pending</Text>
                  </View>
                </View>
              </View>
            ) : orgRequest.status === 'rejected' ? (
              // Request rejected — show status + allow reapply
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardRow}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  <View style={styles.cardRowContent}>
                    <Text style={[styles.cardRowValue, { color: colors.text }]}>
                      Request Not Approved
                    </Text>
                    {orgRequest.rejection_reason ? (
                      <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                        {orgRequest.rejection_reason}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.requestStatusBadge, { borderColor: colors.error }]}>
                    <Text style={[styles.requestStatusText, { color: colors.error }]}>Rejected</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Become a Voice / Voice Status */}
        {!userProfile?.is_voice ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              VOICES
            </Text>
            {voiceRequest === undefined ? null : voiceRequest === null ? (
              // No request submitted yet
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  styles.cardRow,
                  { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setShowVoiceRequestModal(true)}
              >
                <Ionicons name="mic-outline" size={20} color={Magenta[500]} />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowValue, { color: colors.text }]}>
                    Become a Voice
                  </Text>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    Apply to be a Crowdia influencer
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ) : voiceRequest.status === 'pending' ? (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardRow}>
                  <Ionicons name="time-outline" size={20} color={colors.warning} />
                  <View style={styles.cardRowContent}>
                    <Text style={[styles.cardRowValue, { color: colors.text }]}>
                      Application Under Review
                    </Text>
                    <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                      Submitted {new Date(voiceRequest.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.requestStatusBadge, { borderColor: colors.warning }]}>
                    <Text style={[styles.requestStatusText, { color: colors.warning }]}>Pending</Text>
                  </View>
                </View>
              </View>
            ) : voiceRequest.status === 'rejected' ? (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardRow}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  <View style={styles.cardRowContent}>
                    <Text style={[styles.cardRowValue, { color: colors.text }]}>
                      Application Not Approved
                    </Text>
                    {voiceRequest.rejection_reason ? (
                      <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                        {voiceRequest.rejection_reason}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.requestStatusBadge, { borderColor: colors.error }]}>
                    <Text style={[styles.requestStatusText, { color: colors.error }]}>Rejected</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          // User is a voice — show their voice badge
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              VOICES
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardRow}>
                <Ionicons name="mic" size={20} color={Magenta[500]} />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowValue, { color: colors.text }]}>
                    You're a Voice
                  </Text>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    Your attendance is featured on event pages
                  </Text>
                </View>
                <View style={[styles.requestStatusBadge, { borderColor: Magenta[500] }]}>
                  <Text style={[styles.requestStatusText, { color: Magenta[500] }]}>Active</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Saved Events */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            SAVED EVENTS
          </Text>
          {interestsLoading ? (
            <View style={styles.interestsLoader}>
              <ActivityIndicator size="small" color={Magenta[500]} />
            </View>
          ) : interestedEvents.length === 0 ? (
            <View style={[styles.emptyInterests, { backgroundColor: colors.card }]}>
              <Ionicons name="heart-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyInterestsText, { color: colors.textSecondary }]}>
                No saved events yet
              </Text>
              <Text style={[styles.emptyInterestsSub, { color: colors.textMuted }]}>
                Tap the heart on any event to save it here
              </Text>
            </View>
          ) : (
            <View style={styles.interestedEventsList}>
              {interestedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Points Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              POINTS EARNED
            </Text>
            <Pressable
              style={styles.leaderboardLink}
              onPress={() => router.push('/leaderboard')}
            >
              <Ionicons name="trophy-outline" size={14} color={Magenta[500]} />
              <Text style={[styles.leaderboardLinkText, { color: Magenta[500] }]}>
                Leaderboard
              </Text>
            </Pressable>
          </View>
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
            {(userProfile?.check_ins_count ?? 0) > 0 ? (
              <>
                <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.pointsRow}>
                  <View style={styles.pointsRowLeft}>
                    <Ionicons name="location-outline" size={18} color={Magenta[500]} />
                    <Text style={[styles.pointsRowText, { color: colors.text }]}>
                      Check-ins ({userProfile!.check_ins_count})
                    </Text>
                  </View>
                  <Text style={[styles.pointsRowValue, { color: Magenta[500] }]}>
                    +{(userProfile!.check_ins_count ?? 0) * 25}
                  </Text>
                </View>
              </>
            ) : null}
            {interestedEvents.length > 0 ? (
              <>
                <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.pointsRow}>
                  <View style={styles.pointsRowLeft}>
                    <Ionicons name="heart-outline" size={18} color={Magenta[500]} />
                    <Text style={[styles.pointsRowText, { color: colors.text }]}>
                      Saved Events ({interestedEvents.length})
                    </Text>
                  </View>
                  <Text style={[styles.pointsRowValue, { color: Magenta[500] }]}>
                    +{interestedEvents.length * 5}
                  </Text>
                </View>
              </>
            ) : null}
            {userProfile?.referral_points_awarded ? (
              <>
                <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.pointsRow}>
                  <View style={styles.pointsRowLeft}>
                    <Ionicons name="people-outline" size={18} color={Magenta[500]} />
                    <Text style={[styles.pointsRowText, { color: colors.text }]}>
                      Referral Bonus
                    </Text>
                  </View>
                  <Text style={[styles.pointsRowValue, { color: Magenta[500] }]}>+100</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Referral Code */}
        {userProfile?.referral_code ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              REFER A FRIEND
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardRow}>
                <Ionicons name="people-outline" size={20} color={Magenta[500]} />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    Your referral code
                  </Text>
                  <Text style={[styles.referralCode, { color: colors.text }]}>
                    {userProfile.referral_code}
                  </Text>
                </View>
              </View>
              <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.cardRow}>
                <Ionicons name="gift-outline" size={20} color={colors.textSecondary} />
                <View style={styles.cardRowContent}>
                  <Text style={[styles.cardRowLabel, { color: colors.textSecondary }]}>
                    You earn +100 pts when a friend signs up with your code and confirms their email
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

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

      {/* Become a Voice Modal */}
      <Modal
        visible={showVoiceRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowVoiceRequestModal(false);
          setVoiceInstagram('');
          setVoiceReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Become a Voice</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Voices are Crowdia influencers whose attendance is featured on event pages. Apply below and an admin will review your request.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Instagram handle (optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.divider,
                },
              ]}
              value={voiceInstagram}
              onChangeText={setVoiceInstagram}
              placeholder="@yourhandle"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Why do you want to be a Voice? (optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textInputMultiline,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.divider,
                },
              ]}
              value={voiceReason}
              onChangeText={setVoiceReason}
              placeholder="Tell us about yourself and your connection to the Palermo scene..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.background }]}
                onPress={() => {
                  setShowVoiceRequestModal(false);
                  setVoiceInstagram('');
                  setVoiceReason('');
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: Magenta[500] }]}
                onPress={handleSubmitVoiceRequest}
                disabled={isSubmittingVoiceRequest}
              >
                {isSubmittingVoiceRequest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Apply</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Become an Organizer Modal */}
      <Modal
        visible={showOrgRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowOrgRequestModal(false);
          setOrgName('');
          setOrgReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Become an Organizer</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Submit a request to host events on Crowdia. An admin will review your application.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Organization Name *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.divider,
                },
              ]}
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Your organization or event brand name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Why do you want to become an organizer? (optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textInputMultiline,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.divider,
                },
              ]}
              value={orgReason}
              onChangeText={setOrgReason}
              placeholder="Tell us about the events you plan to host..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.background }]}
                onPress={() => {
                  setShowOrgRequestModal(false);
                  setOrgName('');
                  setOrgReason('');
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  { backgroundColor: orgName.trim() ? Magenta[500] : colors.divider },
                ]}
                onPress={handleSubmitOrgRequest}
                disabled={!orgName.trim() || isSubmittingOrgRequest}
              >
                {isSubmittingOrgRequest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Submit Request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  leaderboardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  leaderboardLinkText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  referralCode: {
    fontSize: Typography.xl,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
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

  // Saved Events
  interestsLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyInterests: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyInterestsText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  emptyInterestsSub: {
    fontSize: Typography.sm,
    textAlign: 'center',
  },
  interestedEventsList: {
    marginHorizontal: -Spacing.lg,
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

  // Organizer request status badge
  requestStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  requestStatusText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },

  // Organizer request modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: Typography.sm,
    lineHeight: Typography.sm * 1.5,
  },
  modalLabel: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.base,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalBtnText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
});
