import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityById, updateEntity } from '@/services/admin-entities';
import { AdminDetailView, BooleanBadge, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const FORM_FIELDS: FormField[] = [
  { key: 'username', label: 'Username', type: 'text' },
  { key: 'display_name', label: 'Display Name', type: 'text' },
  { key: 'bio', label: 'Bio', type: 'textarea' },
  { key: 'is_admin', label: 'Admin', type: 'boolean' },
  { key: 'points', label: 'Points', type: 'number' },
];

export default function UserDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();

  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const result = await fetchEntityById('users', id);
    setItem(result);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (values: Record<string, any>) => {
    if (!id) return;
    await updateEntity('users', id, values);
    setShowForm(false);
    loadData();
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'User' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Profile',
          fields: [
            { label: 'Username', value: item.username || '-' },
            { label: 'Display Name', value: item.display_name || '-' },
            { label: 'Bio', value: item.bio || '-' },
            { label: 'Profile Image', value: item.profile_image_url || '-' },
          ],
        },
        {
          title: 'Stats',
          fields: [
            { label: 'Points', value: item.points ?? 0 },
            { label: 'Check-ins', value: item.check_ins_count ?? 0 },
          ],
        },
        {
          title: 'Admin',
          fields: [
            { label: 'Is Admin', value: <BooleanBadge value={!!item.is_admin} /> },
            {
              label: 'Email Points',
              value: <BooleanBadge value={!!item.email_confirmed_points_awarded} trueLabel="Awarded" falseLabel="Not Awarded" />,
            },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: item.created_at ? new Date(item.created_at).toLocaleString() : '-' },
            { label: 'Updated', value: item.updated_at ? new Date(item.updated_at).toLocaleString() : '-' },
          ],
        },
      ]
    : [];

  return (
    <>
      <AdminDetailView
        title={item?.display_name || item?.username || 'User'}
        subtitle={item?.username ? `@${item.username}` : undefined}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setShowForm(true)}
      />
      <AdminFormModal
        visible={showForm}
        title="Edit User"
        fields={FORM_FIELDS}
        initialValues={item || {}}
        onSubmit={handleSubmit}
        onClose={() => setShowForm(false)}
      />
    </>
  );
}
