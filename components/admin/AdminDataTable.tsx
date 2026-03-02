import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  render?: (item: T) => React.ReactNode;
}

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string | boolean }[];
}

interface Props<T = any> {
  columns: Column<T>[];
  data: T[];
  isLoading: boolean;
  searchPlaceholder?: string;
  search: string;
  onSearchChange: (text: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  onPressRow?: (item: T) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  filters?: FilterOption[];
  activeFilters?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onPressCreate?: () => void;
  createLabel?: string;
  minTableWidth?: number;
}

export function AdminDataTable<T extends { id?: string }>({
  columns,
  data,
  isLoading,
  searchPlaceholder = 'Search...',
  search,
  onSearchChange,
  sortBy,
  sortOrder,
  onSort,
  onPressRow,
  page,
  totalPages,
  totalCount,
  onPageChange,
  onRefresh,
  isRefreshing = false,
  filters,
  activeFilters = {},
  onFilterChange,
  onPressCreate,
  createLabel = 'Create',
  minTableWidth,
}: Props<T>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [showFilters, setShowFilters] = useState(false);

  const getValue = (item: any, key: string): any => {
    const parts = key.split('.');
    let val = item;
    for (const p of parts) {
      val = val?.[p];
    }
    return val;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.magenta[500]} />
        ) : undefined
      }
    >
      {/* Search + Filter + Create Bar */}
      <View style={styles.toolbar}>
        <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.icon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={onSearchChange}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.toolbarActions}>
          {filters && filters.length > 0 && (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: showFilters ? Colors.magenta[500] : colors.card }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <IconSymbol name="line.3.horizontal.decrease" size={18} color={showFilters ? '#fff' : colors.icon} />
            </TouchableOpacity>
          )}
          {onPressCreate && (
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: Colors.magenta[500] }]}
              onPress={onPressCreate}
            >
              <IconSymbol name="plus" size={16} color="#fff" />
              <Text style={styles.createButtonText}>{createLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      {showFilters && filters && onFilterChange && (
        <View style={[styles.filterBar, { backgroundColor: colors.card }]}>
          {filters.map((filter) => (
            <View key={filter.key} style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: colors.subtext }]}>{filter.label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        activeFilters[filter.key] === undefined || activeFilters[filter.key] === ''
                          ? Colors.magenta[500]
                          : colors.inputBackground,
                    },
                  ]}
                  onPress={() => onFilterChange(filter.key, '')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          activeFilters[filter.key] === undefined || activeFilters[filter.key] === ''
                            ? '#fff'
                            : colors.text,
                      },
                    ]}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {filter.options.map((opt) => {
                  const active = activeFilters[filter.key] === opt.value;
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[
                        styles.filterChip,
                        { backgroundColor: active ? Colors.magenta[500] : colors.inputBackground },
                      ]}
                      onPress={() => onFilterChange(filter.key, active ? '' : opt.value)}
                    >
                      <Text style={[styles.filterChipText, { color: active ? '#fff' : colors.text }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}
        </View>
      )}

      {/* Count */}
      <View style={styles.countBar}>
        <Text style={[styles.countText, { color: colors.subtext }]}>
          {totalCount} {totalCount === 1 ? 'result' : 'results'}
        </Text>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.magenta[500]} />
        </View>
      )}

      {/* Horizontally scrollable table */}
      {!isLoading && (
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={minTableWidth ? { minWidth: minTableWidth } : { minWidth: '100%' as any }}>
            {/* Table Header */}
            <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
              {columns.map((col) => (
                <TouchableOpacity
                  key={col.key}
                  style={[styles.headerCell, col.width ? { width: col.width } : { flex: 1 }, col.minWidth ? { minWidth: col.minWidth } : undefined]}
                  onPress={() => col.sortable !== false && onSort(col.key)}
                  disabled={col.sortable === false}
                >
                  <Text style={[styles.headerText, { color: colors.subtext }]} numberOfLines={1}>
                    {col.label}
                  </Text>
                  {sortBy === col.key && (
                    <IconSymbol
                      name={sortOrder === 'asc' ? 'chevron.up' : 'chevron.down'}
                      size={12}
                      color={Colors.magenta[500]}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Table Rows */}
            {data.map((item, idx) => (
              <TouchableOpacity
                key={(item as any).id || idx}
                style={[
                  styles.tableRow,
                  {
                    backgroundColor: idx % 2 === 0 ? colors.background : colors.card,
                    borderBottomColor: colors.divider,
                  },
                ]}
                onPress={() => onPressRow?.(item)}
                disabled={!onPressRow}
              >
                {columns.map((col) => (
                  <View key={col.key} style={[styles.cell, col.width ? { width: col.width } : { flex: 1 }, col.minWidth ? { minWidth: col.minWidth } : undefined]}>
                    {col.render ? (
                      col.render(item)
                    ) : (
                      <Text style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                        {String(getValue(item, col.key) ?? '-')}
                      </Text>
                    )}
                  </View>
                ))}
              </TouchableOpacity>
            ))}

            {/* Empty State */}
            {data.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol name="tray" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No results found</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={[styles.pagination, { borderTopColor: colors.divider }]}>
          <TouchableOpacity
            style={[styles.pageButton, { backgroundColor: colors.card, opacity: page <= 1 ? 0.4 : 1 }]}
            onPress={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <IconSymbol name="chevron.left" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pageInfo, { color: colors.text }]}>
            {page} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pageButton, { backgroundColor: colors.card, opacity: page >= totalPages ? 0.4 : 1 }]}
            onPress={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <IconSymbol name="chevron.right" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sm,
    paddingVertical: 2,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  createButtonText: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  filterBar: {
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  filterGroup: { gap: Spacing.xs },
  filterLabel: { fontSize: Typography.xs, fontWeight: '600' },
  filterChips: { flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterChipText: { fontSize: Typography.xs, fontWeight: '500' },
  countBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  countText: { fontSize: Typography.xs },
  loadingContainer: {
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    paddingRight: Spacing.sm,
  },
  headerText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    justifyContent: 'center',
    paddingRight: Spacing.sm,
  },
  cellText: {
    fontSize: Typography.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.md,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageInfo: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
});
