import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityById, updateEntity, deleteEntity } from '@/services/admin-entities';
import { AdminDetailView, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const formFields: FormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'address', label: 'Address', type: 'text', required: true },
  { key: 'lat', label: 'Latitude', type: 'number', required: true },
  { key: 'lng', label: 'Longitude', type: 'number', required: true },
  { key: 'venue_type', label: 'Venue Type', type: 'text' },
  { key: 'website_url', label: 'Website URL', type: 'text' },
  { key: 'seasonality', label: 'Seasonality', type: 'text' },
];

export default function LocationDetailScreen() {
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
    const result = await fetchEntityById('locations', id!);
    setItem(result);
    setIsLoading(false);
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Location' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const formatDate = (val: string | null) =>
    val ? new Date(val).toLocaleString() : '-';

  const formatCoord = (val: number | null) =>
    val != null ? Number(val).toFixed(6) : '-';

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Location',
          fields: [
            { label: 'Name', value: item.name || '-' },
            { label: 'Address', value: item.address || '-' },
            { label: 'Venue Type', value: item.venue_type || '-' },
            { label: 'Website', value: item.website_url || '-' },
            { label: 'Seasonality', value: item.seasonality || '-' },
          ],
        },
        {
          title: 'Coordinates',
          fields: [
            { label: 'Latitude', value: formatCoord(item.lat) },
            { label: 'Longitude', value: formatCoord(item.lng) },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: formatDate(item.created_at) },
            { label: 'Updated', value: formatDate(item.updated_at) },
          ],
        },
      ]
    : [];

  const handleEdit = async (values: Record<string, any>) => {
    await updateEntity('locations', id!, values);
    setModalVisible(false);
    loadData();
  };

  const handleDelete = async () => {
    try {
      await deleteEntity('locations', id!);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  return (
    <>
      <AdminDetailView
        title={item?.name || 'Location'}
        subtitle={item?.address}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setModalVisible(true)}
        onDelete={handleDelete}
      />
      <AdminFormModal
        visible={modalVisible}
        title="Edit Location"
        fields={formFields}
        initialValues={item || {}}
        onSubmit={handleEdit}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}
