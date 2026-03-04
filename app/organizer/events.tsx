import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchEntityList,
  createEntity,
  updateEntity,
  deleteEntity,
  fetchSelectOptions,
} from '@/services/admin-entities';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';
import { BooleanBadge } from '@/components/admin/AdminDetailView';

export default function OrganizerEventsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { organizerProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('event_start_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!organizerProfile) return;
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await fetchEntityList({
        table: 'events',
        search,
        searchColumns: ['title', 'description'],
        filters: { organizer_id: organizerProfile.id },
        sortBy,
        sortOrder,
        page,
        pageSize: 20,
        select: '*, category:categories(name), location:locations(name)',
      });

      setData(result.data);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [organizerProfile, search, sortBy, sortOrder, page]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchSelectOptions('categories', 'name').then(setCategoryOptions);
    fetchSelectOptions('locations', 'name').then(setLocationOptions);
  }, []);

  if (!organizerProfile) {
    return (
      <>
        <Stack.Screen options={{ title: 'My Events' }} />
        <Text style={{ color: colors.text, padding: 20 }}>
          You must be an organizer to access this screen.
        </Text>
      </>
    );
  }

  const columns: Column[] = [
    {
      key: 'title',
      label: 'Title',
      minWidth: 200,
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
          {item.title ?? '-'}
        </Text>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: 120,
      sortable: false,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 13 }} numberOfLines={1}>
          {item.category?.name ?? '-'}
        </Text>
      ),
    },
    {
      key: 'event_start_time',
      label: 'Date',
      width: 120,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {item.event_start_time ? new Date(item.event_start_time).toLocaleDateString() : '-'}
        </Text>
      ),
    },
    {
      key: 'is_published',
      label: 'Published',
      width: 90,
      render: (item: any) => <BooleanBadge value={!!item.is_published} />,
    },
  ];

  const formFields: FormField[] = [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Event title' },
    { key: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Event description...' },
    { key: 'cover_image_url', label: 'Cover Image URL', type: 'text', required: true, placeholder: 'https://...' },
    { key: 'event_start_time', label: 'Start Time', type: 'text', required: true, placeholder: '2026-03-15T19:00:00' },
    { key: 'event_end_time', label: 'End Time', type: 'text', required: true, placeholder: '2026-03-15T23:00:00' },
    { key: 'external_ticket_url', label: 'Ticket URL', type: 'text', placeholder: 'https://...' },
    { key: 'is_published', label: 'Published', type: 'boolean' },
    { key: 'category_id', label: 'Category', type: 'select', options: categoryOptions },
    { key: 'location_id', label: 'Location', type: 'select', options: locationOptions },
  ];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleCreate = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    if (editItem) {
      await updateEntity('events', editItem.id, values);
    } else {
      await createEntity('events', { ...values, organizer_id: organizerProfile.id, is_featured: false });
    }
    loadData();
  };

  const handleDelete = async () => {
    if (!editItem) return;
    const doDelete = async () => {
      await deleteEntity('events', editItem.id);
      setShowModal(false);
      loadData();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this event?')) {
        await doDelete();
      }
    } else {
      Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'My Events', headerBackTitle: 'Profile' }} />

      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        minTableWidth={540}
        searchPlaceholder="Search my events..."
        search={search}
        onSearchChange={(text) => {
          setSearch(text);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={(item: any) => {
          setEditItem(item);
          setShowModal(true);
        }}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        onPressCreate={handleCreate}
        createLabel="Add Event"
      />

      <AdminFormModal
        visible={showModal}
        title={editItem ? 'Edit Event' : 'New Event'}
        fields={formFields}
        initialValues={editItem || { is_published: false }}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        onDelete={editItem ? handleDelete : undefined}
      />
    </>
  );
}
