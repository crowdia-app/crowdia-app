import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
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
import { AdminDataTable, type Column, type FilterOption } from '@/components/admin/AdminDataTable';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';
import { BooleanBadge } from '@/components/admin/AdminDetailView';

const FILTERS: FilterOption[] = [
  {
    key: 'is_published',
    label: 'Published',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
  {
    key: 'is_featured',
    label: 'Featured',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
];

export default function EventsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('event_start_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [organizerOptions, setOrganizerOptions] = useState<{ label: string; value: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await fetchEntityList({
        table: 'events',
        search,
        searchColumns: ['title', 'description'],
        filters: activeFilters,
        sortBy,
        sortOrder,
        page,
        pageSize: 20,
        select: '*, category:categories(name), location:locations(name), organizer:organizers(organization_name)',
      });

      setData(result.data);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [search, activeFilters, sortBy, sortOrder, page]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchSelectOptions('organizers', 'organization_name').then(setOrganizerOptions);
    fetchSelectOptions('categories', 'name').then(setCategoryOptions);
    fetchSelectOptions('locations', 'name').then(setLocationOptions);
  }, []);

  if (!userProfile?.is_admin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Access Denied' }} />
        <Text style={{ color: colors.text, padding: 20 }}>Admin access required.</Text>
      </>
    );
  }

  const columns: Column[] = [
    {
      key: 'title',
      label: 'Title',
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
          {item.title?.length > 30 ? item.title.slice(0, 30) + '...' : item.title ?? '-'}
        </Text>
      ),
    },
    {
      key: 'organizer',
      label: 'Organizer',
      width: 110,
      sortable: false,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>
          {item.organizer?.organization_name ?? '-'}
        </Text>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: 90,
      sortable: false,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 12 }} numberOfLines={1}>
          {item.category?.name ?? '-'}
        </Text>
      ),
    },
    {
      key: 'event_start_time',
      label: 'Date',
      width: 100,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {item.event_start_time ? new Date(item.event_start_time).toLocaleDateString() : '-'}
        </Text>
      ),
    },
    {
      key: 'is_published',
      label: 'Published',
      width: 80,
      render: (item: any) => <BooleanBadge value={!!item.is_published} />,
    },
    {
      key: 'is_featured',
      label: 'Featured',
      width: 80,
      render: (item: any) => <BooleanBadge value={!!item.is_featured} />,
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
    { key: 'is_featured', label: 'Featured', type: 'boolean' },
    { key: 'organizer_id', label: 'Organizer', type: 'select', options: organizerOptions },
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

  const handleFilterChange = (key: string, value: any) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value === '' || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
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
      await createEntity('events', values);
    }
    loadData();
  };

  const handleDelete = async () => {
    if (editItem) {
      await deleteEntity('events', editItem.id);
      setShowModal(false);
      loadData();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Events', headerBackTitle: 'Admin' }} />

      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="Search events..."
        search={search}
        onSearchChange={(text) => {
          setSearch(text);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={(item: any) => router.push(`/admin/events/${item.id}`)}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onPressCreate={handleCreate}
        createLabel="Add Event"
      />

      <AdminFormModal
        visible={showModal}
        title={editItem ? 'Edit Event' : 'New Event'}
        fields={formFields}
        initialValues={editItem || { is_published: false, is_featured: false }}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        onDelete={editItem ? handleDelete : undefined}
      />
    </>
  );
}
