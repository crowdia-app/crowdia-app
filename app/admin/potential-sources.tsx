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
} from '@/services/admin-entities';
import { AdminDataTable, type Column, type FilterOption } from '@/components/admin/AdminDataTable';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';
import { StatusBadge } from '@/components/admin/AdminDetailView';

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

const FILTERS: FilterOption[] = [
  {
    key: 'validation_status',
    label: 'Status',
    options: STATUSES.map((s) => ({ label: s, value: s })),
  },
  {
    key: 'platform',
    label: 'Platform',
    options: PLATFORMS.map((p) => ({ label: p, value: p })),
  },
];

export default function PotentialSourcesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('occurrence_count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await fetchEntityList({
        table: 'potential_sources',
        search,
        searchColumns: ['handle'],
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
      key: 'handle',
      label: 'Handle',
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
          {item.handle ?? '-'}
        </Text>
      ),
    },
    {
      key: 'platform',
      label: 'Platform',
      width: 100,
      render: (item: any) => {
        const c = PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.other;
        return <StatusBadge status={item.platform ?? '-'} color={c.color} bgColor={c.bgColor} />;
      },
    },
    {
      key: 'validation_status',
      label: 'Status',
      width: 90,
      render: (item: any) => {
        const c = STATUS_COLORS[item.validation_status] || STATUS_COLORS.pending;
        return <StatusBadge status={item.validation_status ?? '-'} color={c.color} bgColor={c.bgColor} />;
      },
    },
    {
      key: 'occurrence_count',
      label: 'Occurrences',
      width: 80,
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }}>
          {item.occurrence_count ?? 0}
        </Text>
      ),
    },
    {
      key: 'validation_score',
      label: 'Score',
      width: 60,
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 14 }}>
          {item.validation_score ?? '-'}
        </Text>
      ),
    },
    {
      key: 'last_seen_at',
      label: 'Last Seen',
      width: 100,
      render: (item: any) => (
        <Text style={{ color: colors.subtext, fontSize: 12 }}>
          {item.last_seen_at ? new Date(item.last_seen_at).toLocaleDateString() : '-'}
        </Text>
      ),
    },
  ];

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
      await updateEntity('potential_sources', editItem.id, values);
    } else {
      await createEntity('potential_sources', values);
    }
    loadData();
  };

  const handleDelete = async () => {
    if (editItem) {
      await deleteEntity('potential_sources', editItem.id);
      setShowModal(false);
      loadData();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Potential Sources', headerBackTitle: 'Admin' }} />

      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="Search handle..."
        search={search}
        onSearchChange={(text) => {
          setSearch(text);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={(item: any) => router.push(`/admin/potential-sources/${item.id}`)}
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
        title={editItem ? 'Edit Potential Source' : 'New Potential Source'}
        fields={formFields}
        initialValues={editItem || { platform: 'instagram', validation_status: 'pending' }}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        onDelete={editItem ? handleDelete : undefined}
      />
    </>
  );
}
