import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityList, createEntity, updateEntity, deleteEntity } from '@/services/admin-entities';
import { AdminDataTable, type Column } from '@/components/admin/AdminDataTable';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const PAGE_SIZE = 20;
const SEARCH_COLUMNS = ['name', 'address'];

const columns: Column[] = [
  { key: 'name', label: 'Name', sortable: true, minWidth: 180 },
  {
    key: 'address',
    label: 'Address',
    sortable: true,
    minWidth: 250,
    render: (item: any) => (
      <Text style={{ fontSize: 13 }} numberOfLines={1}>
        {item.address ?? '-'}
      </Text>
    ),
  },
  { key: 'venue_type', label: 'Venue Type', sortable: true, width: 120 },
  {
    key: 'lat',
    label: 'Lat/Lng',
    sortable: false,
    width: 150,
    render: (item: any) => (
      <Text style={{ fontSize: 13 }} numberOfLines={1}>
        {item.lat != null && item.lng != null
          ? `${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}`
          : '-'}
      </Text>
    ),
  },
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

const formFields: FormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'address', label: 'Address', type: 'text', required: true },
  { key: 'lat', label: 'Latitude', type: 'number', required: true },
  { key: 'lng', label: 'Longitude', type: 'number', required: true },
  { key: 'venue_type', label: 'Venue Type', type: 'text' },
  { key: 'website_url', label: 'Website URL', type: 'text' },
  { key: 'seasonality', label: 'Seasonality', type: 'text' },
];

export default function LocationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
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
        table: 'locations',
        search,
        searchColumns: SEARCH_COLUMNS,
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
    [search, sortBy, sortOrder, page]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Locations' }} />
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

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    if (editItem) {
      await updateEntity('locations', editItem.id, values);
    } else {
      await createEntity('locations', values);
    }
    setEditItem(null);
    setModalVisible(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!editItem) return;
    try {
      await deleteEntity('locations', editItem.id);
      setEditItem(null);
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Locations', headerBackTitle: 'Admin' }} />
      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        minTableWidth={820}
        searchPlaceholder="Search locations..."
        search={search}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPressRow={(item) => router.push(`/admin/locations/${item.id}`)}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
        onPressCreate={() => {
          setEditItem(null);
          setModalVisible(true);
        }}
        createLabel="Add Location"
      />
      <AdminFormModal
        visible={modalVisible}
        title={editItem ? 'Edit Location' : 'New Location'}
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
