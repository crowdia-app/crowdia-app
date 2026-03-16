import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityById, updateEntity, deleteEntity } from '@/services/admin-entities';
import { AdminDetailView, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const FORM_FIELDS: FormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'icon_url', label: 'Icon URL', type: 'text' },
];

export default function BadgeDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const result = await fetchEntityById('badges', id);
    setItem(result);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (values: Record<string, any>) => {
    if (!id) return;
    await updateEntity('badges', id, values);
    setShowForm(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!item) return;
    try {
      await deleteEntity('badges', id!);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Badge' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Badge',
          fields: [
            { label: 'Name', value: item.name || '-' },
            { label: 'Description', value: item.description || '-' },
            { label: 'Icon URL', value: item.icon_url || '-' },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: item.created_at ? new Date(item.created_at).toLocaleString() : '-' },
          ],
        },
      ]
    : [];

  return (
    <>
      <AdminDetailView
        title={item?.name || 'Badge'}
        subtitle={item?.description}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setShowForm(true)}
        onDelete={handleDelete}
      />
      <AdminFormModal
        visible={showForm}
        title="Edit Badge"
        fields={FORM_FIELDS}
        initialValues={item || {}}
        onSubmit={handleSubmit}
        onClose={() => setShowForm(false)}
      />
    </>
  );
}
