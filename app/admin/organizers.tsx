import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityList, createEntity, updateEntity, deleteEntity } from '@/services/admin-entities';
import { AdminDataTable, type Column, type FilterOption } from '@/components/admin/AdminDataTable';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';
import { BooleanBadge } from '@/components/admin/AdminDetailView';

const PAGE_SIZE = 20;
const SEARCH_COLUMNS = ['organization_name', 'instagram_handle', 'email'];

const columns: Column[] = [
  { key: 'organization_name', label: 'Organization Name', sortable: true, minWidth: 200 },
  {
    key: 'is_verified',
    label: 'Verified',
    sortable: true,
    width: 90,
    render: (item: any) => <BooleanBadge value={!!item.is_verified} />,
  },
  { key: 'instagram_handle', label: 'Instagram', sortable: true, minWidth: 150 },
  { key: 'email', label: 'Email', sortable: true, minWidth: 200 },
  {
    key: 'created_at',
    label: 'Created',
    sortable: true,
    width: 120,
    render: (item: any) =>
      item.created_at ? (
        <Text style={{ fontSize: 13 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
      ) : (
        <Text style={{ fontSize: 13 }}>-</Text>
      ),
  },
];

const filters: FilterOption[] = [
  {
    key: 'is_verified',
    label: 'Verified',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
];

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

export default function OrganizersScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('organization_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const result = await fetchEntityList({
        table: 'organizers',
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
    },
    [search, sortBy, sortOrder, page, activeFilters]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Organizers' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

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

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    if (editItem) {
      await updateEntity('organizers', editItem.id, values);
    } else {
      await createEntity('organizers', values);
    }
    setEditItem(null);
    setModalVisible(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!editItem) return;
    try {
      await deleteEntity('organizers', editItem.id);
      setEditItem(null);
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Organizers', headerBackTitle: 'Admin' }} />
      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        minTableWidth={760}
        searchPlaceholder="Search organizers..."
        search={search}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={(item) => router.push(`/admin/organizers/${item.id}`)}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onPressCreate={() => {
          setEditItem(null);
          setModalVisible(true);
        }}
        createLabel="Add Organizer"
      />
      <AdminFormModal
        visible={modalVisible}
        title={editItem ? 'Edit Organizer' : 'New Organizer'}
        fields={formFields}
        initialValues={editItem || {}}
        onSubmit={handleSubmit}
        onClose={() => {
          setModalVisible(false);
          setEditItem(null);
        }}
        onDelete={editItem ? handleDelete : undefined}
      />
    </>
  );
}
