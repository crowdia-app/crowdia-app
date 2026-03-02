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

const PAGE_SIZE = 50;
const SEARCH_COLUMNS = ['name'];

const FORM_FIELDS: FormField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'icon', label: 'Icon', type: 'text' },
  { key: 'sort_order', label: 'Sort Order', type: 'number' },
];

export default function CategoriesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('sort_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editItem, setEditItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    const result = await fetchEntityList({
      table: 'categories',
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
  }, [search, sortBy, sortOrder, page]);

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

  const handlePressRow = (item: any) => {
    router.push(`/admin/categories/${item.id}`);
  };

  const handleCreate = () => {
    setEditItem(null);
    setShowForm(true);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    if (editItem) {
      await updateEntity('categories', editItem.id, values);
    } else {
      await createEntity('categories', values);
    }
    setShowForm(false);
    setEditItem(null);
    loadData();
  };

  const handleDelete = async () => {
    if (!editItem) return;
    Alert.alert('Delete Category', `Are you sure you want to delete "${editItem.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntity('categories', editItem.id);
          setShowForm(false);
          setEditItem(null);
          loadData();
        },
      },
    ]);
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Categories' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const columns: Column[] = [
    { key: 'name', label: 'Name' },
    { key: 'slug', label: 'Slug' },
    { key: 'icon', label: 'Icon' },
    { key: 'sort_order', label: 'Sort Order' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Categories', headerBackTitle: 'Admin' }} />
      <AdminDataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchPlaceholder="Search categories..."
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
        onPressCreate={handleCreate}
        createLabel="Add Category"
      />
      <AdminFormModal
        visible={showForm}
        title={editItem ? 'Edit Category' : 'New Category'}
        fields={FORM_FIELDS}
        initialValues={editItem || {}}
        onSubmit={handleSubmit}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        onDelete={editItem ? handleDelete : undefined}
      />
    </>
  );
}
