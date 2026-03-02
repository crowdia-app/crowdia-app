import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityList, updateEntity } from '@/services/admin-entities';
import { AdminDataTable, type Column, type FilterOption } from '@/components/admin/AdminDataTable';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';
import { BooleanBadge } from '@/components/admin/AdminDetailView';

const PAGE_SIZE = 20;
const SEARCH_COLUMNS = ['username', 'display_name'];

const FILTERS: FilterOption[] = [
  {
    key: 'is_admin',
    label: 'Admin',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
];

const FORM_FIELDS: FormField[] = [
  { key: 'username', label: 'Username', type: 'text' },
  { key: 'display_name', label: 'Display Name', type: 'text' },
  { key: 'bio', label: 'Bio', type: 'textarea' },
  { key: 'is_admin', label: 'Admin', type: 'boolean' },
  { key: 'points', label: 'Points', type: 'number' },
];

export default function UsersScreen() {
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
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    const result = await fetchEntityList({
      table: 'users',
      search,
      searchColumns: SEARCH_COLUMNS,
      filters: activeFilters,
      sortBy,
      sortOrder,
      page,
      pageSize: PAGE_SIZE,
    });

    setData(result.data);
    setTotalPages(result.totalPages);
    setTotalCount(result.count);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [search, sortBy, sortOrder, page, activeFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleFilterChange = (key: string, value: any) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handlePressRow = (item: any) => {
    router.push(`/admin/users/${item.id}`);
  };

  const handleEdit = (item: any) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    if (!editItem) return;
    await updateEntity('users', editItem.id, values);
    setShowForm(false);
    setEditItem(null);
    loadData();
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Users' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const columns: Column[] = [
    { key: 'username', label: 'Username' },
    { key: 'display_name', label: 'Display Name' },
    { key: 'points', label: 'Points' },
    { key: 'check_ins_count', label: 'Check-ins' },
    {
      key: 'is_admin',
      label: 'Admin',
      render: (item: any) => <BooleanBadge value={!!item.is_admin} />,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (item: any) => (
        <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
        </Text>
      ),
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Users', headerBackTitle: 'Admin' }} />
      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="Search users..."
        search={search}
        onSearchChange={(text) => { setSearch(text); setPage(1); }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={handlePressRow}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
      />
      <AdminFormModal
        visible={showForm}
        title="Edit User"
        fields={FORM_FIELDS}
        initialValues={editItem || {}}
        onSubmit={handleSubmit}
        onClose={() => { setShowForm(false); setEditItem(null); }}
      />
    </>
  );
}
