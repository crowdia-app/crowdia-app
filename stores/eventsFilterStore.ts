import { create } from 'zustand';

export type SortOption = 'date_asc' | 'date_desc' | 'popular' | 'nearby';
export type TimeFilter = 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'custom';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface CustomDateRange {
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
}

interface EventsFilterState {
  searchQuery: string;
  debouncedSearch: string;
  sortBy: SortOption;
  timeFilter: TimeFilter;
  categoryIds: string[];
  since: string;
  userLocation: UserLocation | null;
  customDateRange: CustomDateRange | null;

  // Actions
  setSearchQuery: (query: string) => void;
  setDebouncedSearch: (query: string) => void;
  setSortBy: (sort: SortOption) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  toggleCategory: (id: string) => void;
  setCategoryIds: (ids: string[]) => void;
  setUserLocation: (location: UserLocation | null) => void;
  setCustomDateRange: (range: CustomDateRange | null) => void;
  resetFilters: () => void;
  refreshSince: () => void;

  // Derived
  hasActiveFilters: () => boolean;
}

const getInitialSince = () => new Date().toISOString();

export const useEventsFilterStore = create<EventsFilterState>((set, get) => ({
  searchQuery: '',
  debouncedSearch: '',
  sortBy: 'date_asc',
  timeFilter: 'all',
  categoryIds: [],
  since: getInitialSince(),
  userLocation: null,
  customDateRange: null,

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setDebouncedSearch: (query: string) =>
    set({
      debouncedSearch: query,
      since: new Date().toISOString(),
    }),

  setSortBy: (sort: SortOption) =>
    set({
      sortBy: sort,
      since: new Date().toISOString(),
    }),

  setTimeFilter: (filter: TimeFilter) =>
    set({
      timeFilter: filter,
      since: new Date().toISOString(),
    }),

  toggleCategory: (id: string) =>
    set((state) => {
      const ids = state.categoryIds.includes(id)
        ? state.categoryIds.filter((c) => c !== id)
        : [...state.categoryIds, id];
      return { categoryIds: ids, since: new Date().toISOString() };
    }),

  setCategoryIds: (ids: string[]) =>
    set({ categoryIds: ids, since: new Date().toISOString() }),

  setUserLocation: (location: UserLocation | null) =>
    set({ userLocation: location }),

  setCustomDateRange: (range: CustomDateRange | null) =>
    set({ customDateRange: range, since: new Date().toISOString() }),

  resetFilters: () =>
    set({
      searchQuery: '',
      debouncedSearch: '',
      sortBy: 'date_asc',
      timeFilter: 'all',
      categoryIds: [],
      customDateRange: null,
      since: new Date().toISOString(),
    }),

  refreshSince: () => set({ since: new Date().toISOString() }),

  hasActiveFilters: () => {
    const state = get();
    return (
      state.timeFilter !== 'all' ||
      state.sortBy !== 'date_asc' ||
      state.categoryIds.length > 0 ||
      state.customDateRange !== null
    );
  },
}));
