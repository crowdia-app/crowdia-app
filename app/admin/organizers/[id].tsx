import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityById, updateEntity, deleteEntity } from '@/services/admin-entities';
import { AdminDetailView, BooleanBadge, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const formFields: FormField[] = [
  { key: 'organization_name', label: 'Organization Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'instagram_handle', label: 'Instagram Handle', type: 'text' },
  { key: 'website_url', label: 'Website URL', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'logo_url', label: 'Logo URL', type: 'text' },
  { key: 'is_verified', label: 'Verified', type: 'boolean' },
];

export default function OrganizerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const result = await fetchEntityById('organizers', id!);
    setItem(result);
    setIsLoading(false);
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Organizer' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const formatDate = (val: string | null) =>
    val ? new Date(val).toLocaleString() : '-';

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Organization',
          fields: [
            { label: 'Name', value: item.organization_name || '-' },
            { label: 'Email', value: item.email || '-' },
            { label: 'Phone', value: item.phone || '-' },
            { label: 'Instagram', value: item.instagram_handle || '-' },
            { label: 'Website', value: item.website_url || '-' },
            { label: 'Address', value: item.address || '-' },
            { label: 'Logo URL', value: item.logo_url || '-' },
          ],
        },
        {
          title: 'Verification',
          fields: [
            { label: 'Verified', value: <BooleanBadge value={!!item.is_verified} /> },
            { label: 'Verified At', value: formatDate(item.verified_at) },
            { label: 'Verified By', value: item.verified_by || '-' },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: formatDate(item.created_at) },
          ],
        },
      ]
    : [];

  const handleEdit = async (values: Record<string, any>) => {
    await updateEntity('organizers', id!, values);
    setModalVisible(false);
    loadData();
  };

  const handleDelete = async () => {
    try {
      await deleteEntity('organizers', id!);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  return (
    <>
      <AdminDetailView
        title={item?.organization_name || 'Organizer'}
        subtitle={item?.email}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setModalVisible(true)}
        onDelete={handleDelete}
      />
      <AdminFormModal
        visible={modalVisible}
        title="Edit Organizer"
        fields={formFields}
        initialValues={item || {}}
        onSubmit={handleEdit}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}
