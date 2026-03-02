import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
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
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'icon', label: 'Icon', type: 'text' },
  { key: 'sort_order', label: 'Sort Order', type: 'number' },
];

export default function CategoryDetailScreen() {
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
    const result = await fetchEntityById('categories', id);
    setItem(result);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (values: Record<string, any>) => {
    if (!id) return;
    await updateEntity('categories', id, values);
    setShowForm(false);
    loadData();
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert('Delete Category', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntity('categories', id!);
          router.back();
        },
      },
    ]);
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Category' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Category',
          fields: [
            { label: 'Name', value: item.name || '-' },
            { label: 'Slug', value: item.slug || '-' },
            { label: 'Icon', value: item.icon || '-' },
            { label: 'Sort Order', value: item.sort_order ?? '-' },
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
        title={item?.name || 'Category'}
        subtitle={item?.slug}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setShowForm(true)}
        onDelete={handleDelete}
      />
      <AdminFormModal
        visible={showForm}
        title="Edit Category"
        fields={FORM_FIELDS}
        initialValues={item || {}}
        onSubmit={handleSubmit}
        onClose={() => setShowForm(false)}
      />
    </>
  );
}
