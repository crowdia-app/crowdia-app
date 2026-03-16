import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchEntityById,
  updateEntity,
  deleteEntity,
} from '@/services/admin-entities';
import { AdminDetailView, StatusBadge, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const PLATFORM_COLORS: Record<string, { color: string; bgColor: string }> = {
  instagram: { color: Colors.magenta[500], bgColor: Colors.magenta[100] },
  facebook: { color: Colors.blue[700], bgColor: Colors.blue[100] },
  twitter: { color: Colors.charcoal[600], bgColor: Colors.charcoal[100] },
  other: { color: Colors.charcoal[600], bgColor: Colors.charcoal[100] },
};

const STATUS_COLORS: Record<string, { color: string; bgColor: string }> = {
  pending: { color: Colors.yellow[700], bgColor: Colors.yellow[100] },
  validated: { color: Colors.green[700], bgColor: Colors.green[100] },
  rejected: { color: Colors.red[700], bgColor: Colors.red[100] },
  skipped: { color: Colors.charcoal[600], bgColor: Colors.charcoal[100] },
};

const PLATFORMS = ['instagram', 'facebook', 'twitter', 'other'];
const STATUSES = ['pending', 'validated', 'rejected', 'skipped'];

export default function PotentialSourceDetail() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadItem = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const data = await fetchEntityById('potential_sources', id);
    setItem(data);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  if (!userProfile?.is_admin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Access Denied' }} />
        <Text style={{ color: colors.text, padding: 20 }}>Admin access required.</Text>
      </>
    );
  }

  const platformColors = PLATFORM_COLORS[item?.platform] || PLATFORM_COLORS.other;
  const statusColors = STATUS_COLORS[item?.validation_status] || STATUS_COLORS.pending;

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Source',
          fields: [
            { label: 'Handle', value: item.handle ?? '-' },
            {
              label: 'Platform',
              value: (
                <StatusBadge
                  status={item.platform ?? '-'}
                  color={platformColors.color}
                  bgColor={platformColors.bgColor}
                />
              ),
            },
            { label: 'Discovered Via', value: item.discovered_via_method ?? '-' },
          ],
        },
        {
          title: 'Validation',
          fields: [
            {
              label: 'Status',
              value: (
                <StatusBadge
                  status={item.validation_status ?? '-'}
                  color={statusColors.color}
                  bgColor={statusColors.bgColor}
                />
              ),
            },
            { label: 'Score', value: item.validation_score ?? '-' },
            { label: 'Notes', value: item.validation_notes ?? '-' },
            {
              label: 'Processed At',
              value: item.processed_at ? new Date(item.processed_at).toLocaleString() : '-',
            },
          ],
        },
        {
          title: 'Activity',
          fields: [
            { label: 'Occurrences', value: item.occurrence_count ?? 0 },
            {
              label: 'First Seen',
              value: item.first_seen_at ? new Date(item.first_seen_at).toLocaleString() : '-',
            },
            {
              label: 'Last Seen',
              value: item.last_seen_at ? new Date(item.last_seen_at).toLocaleString() : '-',
            },
          ],
        },
        {
          title: 'Relationships',
          fields: [
            { label: 'Discovered Via Source', value: item.discovered_via_source_id ?? '-' },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            {
              label: 'Created At',
              value: item.created_at ? new Date(item.created_at).toLocaleString() : '-',
            },
          ],
        },
      ]
    : [];

  const handleStatusUpdate = async (status: string) => {
    if (!id) return;
    try {
      await updateEntity('potential_sources', id, {
        validation_status: status,
        processed_at: new Date().toISOString(),
      });
      await loadItem();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update status');
    }
  };

  const handleEdit = () => {
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteEntity('potential_sources', id);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  const handleSubmit = async (values: Record<string, any>) => {
    if (!id) return;
    await updateEntity('potential_sources', id, values);
    loadItem();
  };

  const formFields: FormField[] = [
    { key: 'handle', label: 'Handle', type: 'text', required: true, placeholder: '@handle' },
    {
      key: 'platform',
      label: 'Platform',
      type: 'select',
      required: true,
      options: PLATFORMS.map((p) => ({ label: p, value: p })),
    },
    {
      key: 'discovered_via_method',
      label: 'Discovered Via Method',
      type: 'text',
      required: true,
      placeholder: 'e.g. scraping, manual, referral',
    },
    {
      key: 'validation_status',
      label: 'Validation Status',
      type: 'select',
      options: STATUSES.map((s) => ({ label: s, value: s })),
    },
    { key: 'validation_score', label: 'Validation Score', type: 'number', placeholder: '0-100' },
    { key: 'validation_notes', label: 'Validation Notes', type: 'textarea', placeholder: 'Notes...' },
  ];

  const actions =
    item?.validation_status === 'pending'
      ? [
          {
            label: 'Validate',
            icon: 'checkmark.circle.fill',
            color: Colors.green[500],
            onPress: () => handleStatusUpdate('validated'),
          },
          {
            label: 'Reject',
            icon: 'xmark.circle.fill',
            color: Colors.red[500],
            onPress: () => handleStatusUpdate('rejected'),
          },
          {
            label: 'Skip',
            icon: 'forward.fill',
            color: Colors.charcoal[400],
            onPress: () => handleStatusUpdate('skipped'),
          },
        ]
      : [];

  return (
    <>
      <AdminDetailView
        title={item?.handle ?? 'Potential Source'}
        subtitle={item?.platform ?? undefined}
        sections={sections}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        actions={actions}
      />

      <AdminFormModal
        visible={showModal}
        title="Edit Potential Source"
        fields={formFields}
        initialValues={item || {}}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
