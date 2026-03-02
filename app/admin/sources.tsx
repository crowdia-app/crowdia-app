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
import { BooleanBadge, StatusBadge } from '@/components/admin/AdminDetailView';

const TYPE_COLORS: Record<string, { color: string; bgColor: string }> = {
  website: { color: Colors.blue[700], bgColor: Colors.blue[100] },
  instagram: { color: Colors.magenta[500], bgColor: Colors.magenta[100] },
  facebook: { color: Colors.blue[700], bgColor: Colors.blue[100] },
  ra: { color: Colors.yellow[700], bgColor: Colors.yellow[100] },
  aggregator: { color: Colors.green[700], bgColor: Colors.green[100] },
  other: { color: Colors.red[700], bgColor: Colors.red[100] },
};

const SOURCE_TYPES = ['website', 'instagram', 'facebook', 'ra', 'aggregator', 'other'];

const FILTERS: FilterOption[] = [
  {
    key: 'type',
    label: 'Type',
    options: SOURCE_TYPES.map((t) => ({ label: t, value: t })),
  },
  {
    key: 'enabled',
    label: 'Enabled',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
  {
    key: 'is_aggregator',
    label: 'Aggregator',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
  {
    key: 'auto_discovered',
    label: 'Auto Discovered',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
];

export default function SourcesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [organizerOptions, setOrganizerOptions] = useState<{ label: string; value: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await fetchEntityList({
        table: 'event_sources',
        search,
        searchColumns: ['url', 'instagram_handle'],
        filters: activeFilters,
        sortBy,
        sortOrder,
        page,
        pageSize: 20,
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
      key: 'url',
      label: 'URL',
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
          {item.url?.length > 40 ? item.url.slice(0, 40) + '...' : item.url ?? '-'}
        </Text>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: 100,
      render: (item: any) => {
        const c = TYPE_COLORS[item.type] || TYPE_COLORS.other;
        return <StatusBadge status={item.type ?? '-'} color={c.color} bgColor={c.bgColor} />;
      },
    },
    {
      key: 'enabled',
      label: 'Enabled',
      width: 70,
      render: (item: any) => <BooleanBadge value={!!item.enabled} />,
    },
    {
      key: 'reliability_score',
      label: 'Reliability',
      width: 80,
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }}>
          {item.reliability_score ?? '-'}
        </Text>
      ),
    },
    {
      key: 'last_scraped_at',
      label: 'Last Scraped',
      width: 110,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {item.last_scraped_at ? new Date(item.last_scraped_at).toLocaleDateString() : '-'}
        </Text>
      ),
    },
  ];

  const formFields: FormField[] = [
    { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://...' },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      options: SOURCE_TYPES.map((t) => ({ label: t, value: t })),
    },
    { key: 'instagram_handle', label: 'Instagram Handle', type: 'text', placeholder: '@handle' },
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'is_aggregator', label: 'Is Aggregator', type: 'boolean' },
    { key: 'reliability_score', label: 'Reliability Score', type: 'number', placeholder: '0-100' },
    { key: 'organizer_id', label: 'Organizer', type: 'select', options: organizerOptions },
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
      await updateEntity('event_sources', editItem.id, values);
    } else {
      await createEntity('event_sources', values);
    }
    loadData();
  };

  const handleDelete = async () => {
    if (editItem) {
      await deleteEntity('event_sources', editItem.id);
      setShowModal(false);
      loadData();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Event Sources', headerBackTitle: 'Admin' }} />

      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="Search URL or handle..."
        search={search}
        onSearchChange={(text) => {
          setSearch(text);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={(item: any) => router.push(`/admin/sources/${item.id}`)}
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
        createLabel="Add Source"
      />

      <AdminFormModal
        visible={showModal}
        title={editItem ? 'Edit Source' : 'New Source'}
        fields={formFields}
        initialValues={editItem || { enabled: true, is_aggregator: false }}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        onDelete={editItem ? handleDelete : undefined}
      />
    </>
  );
}
