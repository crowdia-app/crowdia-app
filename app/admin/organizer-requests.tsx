import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Magenta, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchAllOrganizerRequests,
  approveOrganizerRequest,
  rejectOrganizerRequest,
  type OrganizerRequest,
} from '@/services/organizer-requests';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function OrganizerRequestsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { userProfile } = useAuthStore();

  const [requests, setRequests] = useState<OrganizerRequest[]>([]);
  const [filtered, setFiltered] = useState<OrganizerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<OrganizerRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    const data = await fetchAllOrganizerRequests();
    setRequests(data);
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFiltered(requests);
    } else {
      setFiltered(requests.filter((r) => r.status === statusFilter));
    }
  }, [requests, statusFilter]);

  const handleApprove = (req: OrganizerRequest) => {
    const doApprove = async () => {
      setIsSubmitting(true);
      try {
        await approveOrganizerRequest(req.id, req, userProfile!.id);
        await loadData();
      } catch (err: any) {
        if (Platform.OS === 'web') {
          window.alert('Failed to approve: ' + (err?.message || 'Unknown error'));
        } else {
          Alert.alert('Error', err?.message || 'Failed to approve request');
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Approve organizer request from ${req.user?.display_name || req.user?.username || 'this user'}?`)) {
        doApprove();
      }
    } else {
      Alert.alert(
        'Approve Request',
        `Approve organizer request from ${req.user?.display_name || req.user?.username || 'this user'}?\n\nOrganization: ${req.organization_name}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve', onPress: doApprove },
        ]
      );
    }
  };

  const handleRejectPress = (req: OrganizerRequest) => {
    setRejectTarget(req);
    setRejectReason('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    setIsSubmitting(true);
    try {
      await rejectOrganizerRequest(rejectTarget.id, userProfile!.id, rejectReason || undefined);
      setRejectTarget(null);
      setRejectReason('');
      await loadData();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert('Failed to reject: ' + (err?.message || 'Unknown error'));
      } else {
        Alert.alert('Error', err?.message || 'Failed to reject request');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Organizer Requests' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <>
      <Stack.Screen options={{ title: 'Organizer Requests', headerBackTitle: 'Admin' }} />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor={Magenta[500]}
          />
        }
      >
        {/* Header summary */}
        <View style={[styles.summaryBanner, { backgroundColor: colors.card }]}>
          <Ionicons name="people-outline" size={22} color={Magenta[500]} />
          <Text style={[styles.summaryText, { color: colors.text }]}>
            {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
          </Text>
        </View>

        {/* Status filter tabs */}
        <View style={styles.filterRow}>
          {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.filterTab,
                statusFilter === s && { backgroundColor: Magenta[500] },
                statusFilter !== s && { backgroundColor: colors.card },
              ]}
              onPress={() => setStatusFilter(s)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: statusFilter === s ? '#fff' : colors.text },
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Magenta[500]} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No {statusFilter === 'all' ? '' : statusFilter} requests
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                colors={colors}
                onApprove={() => handleApprove(req)}
                onReject={() => handleRejectPress(req)}
                isSubmitting={isSubmitting}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Reject Request</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {rejectTarget?.user?.display_name || rejectTarget?.user?.username || 'User'} -{' '}
              {rejectTarget?.organization_name}
            </Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Reason (optional)
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
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Explain why this request is being rejected..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.background }]}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={handleRejectSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Reject</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface RequestCardProps {
  req: OrganizerRequest;
  colors: any;
  onApprove: () => void;
  onReject: () => void;
  isSubmitting: boolean;
}

function RequestCard({ req, colors, onApprove, onReject, isSubmitting }: RequestCardProps) {
  const statusColor =
    req.status === 'approved'
      ? colors.success
      : req.status === 'rejected'
      ? colors.error
      : colors.warning;

  const statusIcon =
    req.status === 'approved'
      ? 'checkmark-circle'
      : req.status === 'rejected'
      ? 'close-circle'
      : 'time';

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* User info row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.orgName, { color: colors.text }]}>{req.organization_name}</Text>
          <Text style={[styles.userName, { color: colors.textSecondary }]}>
            {req.user?.display_name
              ? `${req.user.display_name}${req.user.username ? ` (@${req.user.username})` : ''}`
              : req.user?.username
              ? `@${req.user.username}`
              : 'Unknown user'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Ionicons name={statusIcon as any} size={14} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Reason */}
      {req.reason ? (
        <View style={[styles.reasonBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.reasonLabel, { color: colors.textMuted }]}>Reason</Text>
          <Text style={[styles.reasonText, { color: colors.text }]}>{req.reason}</Text>
        </View>
      ) : null}

      {/* Rejection reason */}
      {req.rejection_reason ? (
        <View style={[styles.reasonBox, { backgroundColor: colors.background }]}>
          <Text style={[styles.reasonLabel, { color: colors.error }]}>Rejection reason</Text>
          <Text style={[styles.reasonText, { color: colors.text }]}>{req.rejection_reason}</Text>
        </View>
      ) : null}

      {/* Date */}
      <Text style={[styles.dateText, { color: colors.textMuted }]}>
        Submitted {new Date(req.created_at).toLocaleDateString()}
        {req.reviewed_at
          ? ` · Reviewed ${new Date(req.reviewed_at).toLocaleDateString()}`
          : ''}
      </Text>

      {/* Action buttons (only for pending) */}
      {req.status === 'pending' ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnReject, { borderColor: colors.error }]}
            onPress={onReject}
            disabled={isSubmitting}
          >
            <Ionicons name="close" size={16} color={colors.error} />
            <Text style={[styles.actionBtnText, { color: colors.error }]}>Reject</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnApprove]}
            onPress={onApprove}
            disabled={isSubmitting}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Approve</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  summaryText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterTabText: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.base,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  orgName: {
    fontSize: Typography.base,
    fontWeight: '700',
  },
  userName: {
    fontSize: Typography.sm,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  reasonBox: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: 4,
  },
  reasonLabel: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: Typography.sm,
  },
  dateText: {
    fontSize: Typography.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionBtnReject: {
    borderWidth: 1,
  },
  actionBtnApprove: {
    backgroundColor: Magenta[500],
  },
  actionBtnText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalBtnDanger: {
    backgroundColor: '#ef4444',
  },
  modalBtnText: {
    fontSize: Typography.base,
    fontWeight: '600',
  },
});
