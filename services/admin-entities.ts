import { supabase } from '@/lib/supabase';

export interface FetchParams {
  table: string;
  search?: string;
  searchColumns?: string[];
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  select?: string;
}

export interface FetchResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchEntityList<T = any>({
  table,
  search,
  searchColumns = [],
  filters = {},
  sortBy = 'created_at',
  sortOrder = 'desc',
  page = 1,
  pageSize = 20,
  select = '*',
}: FetchParams): Promise<FetchResult<T>> {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from(table).select(select, { count: 'exact' });

    // Apply search across multiple columns using OR
    if (search && searchColumns.length > 0) {
      const orClauses = searchColumns.map((col) => `${col}.ilike.%${search}%`).join(',');
      query = query.or(orClauses);
    }

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'boolean') {
        query = query.eq(key, value);
      } else {
        query = query.eq(key, value);
      }
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error(`Failed to fetch ${table}:`, error);
      return { data: [], count: 0, page, pageSize, totalPages: 0 };
    }

    const total = count || 0;
    return {
      data: (data as T[]) || [],
      count: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error(`Failed to fetch ${table}:`, error);
    return { data: [], count: 0, page, pageSize, totalPages: 0 };
  }
}

export async function fetchEntityById<T = any>(table: string, id: string, select = '*'): Promise<T | null> {
  try {
    const { data, error } = await supabase.from(table).select(select).eq('id', id).single();
    if (error) {
      console.error(`Failed to fetch ${table}/${id}:`, error);
      return null;
    }
    return data as T;
  } catch (error) {
    console.error(`Failed to fetch ${table}/${id}:`, error);
    return null;
  }
}

export async function createEntity<T = any>(table: string, data: Record<string, any>): Promise<T | null> {
  try {
    const { data: result, error } = await supabase.from(table).insert(data).select().single();
    if (error) {
      console.error(`Failed to create ${table}:`, error);
      throw error;
    }
    return result as T;
  } catch (error) {
    console.error(`Failed to create ${table}:`, error);
    throw error;
  }
}

export async function updateEntity<T = any>(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<T | null> {
  try {
    const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select().single();
    if (error) {
      console.error(`Failed to update ${table}/${id}:`, error);
      throw error;
    }
    return result as T;
  } catch (error) {
    console.error(`Failed to update ${table}/${id}:`, error);
    throw error;
  }
}

export async function deleteEntity(table: string, id: string): Promise<void> {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error(`Failed to delete ${table}/${id}:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`Failed to delete ${table}/${id}:`, error);
    throw error;
  }
}

// Helper to fetch options for select dropdowns (e.g., organizers, categories)
export async function fetchSelectOptions(
  table: string,
  labelColumn: string,
  valueColumn = 'id'
): Promise<{ label: string; value: string }[]> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(`${valueColumn}, ${labelColumn}`)
      .order(labelColumn, { ascending: true })
      .limit(500);

    if (error) return [];
    return (data || []).map((row: any) => ({
      label: row[labelColumn] || row[valueColumn],
      value: row[valueColumn],
    }));
  } catch {
    return [];
  }
}
