-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- Add embedding column to events table (1536 dims for text-embedding-3-small)
alter table events add column if not exists embedding vector(1536);

-- Index for fast cosine similarity search (IVFFlat for approximate nearest neighbor)
-- lists = 100 is good for up to ~1M rows; rebuild after significant data growth
create index if not exists events_embedding_idx
  on events using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC function: match events by vector similarity, returning full event data
-- Returns events from events_with_stats joined with similarity score
create or replace function match_events(
  query_embedding vector(1536),
  match_threshold float default 0.4,
  match_count int default 20,
  filter_since timestamptz default now()
)
returns table (
  id uuid,
  organizer_id uuid,
  title text,
  description text,
  cover_image_url text,
  category_id uuid,
  category_name text,
  location_id uuid,
  location_name text,
  location_address text,
  location_lat float8,
  location_lng float8,
  location_venue_type text,
  event_start_time timestamptz,
  event_end_time timestamptz,
  external_ticket_url text,
  event_url text,
  source text,
  is_published boolean,
  confidence_score int,
  is_featured boolean,
  created_at timestamptz,
  updated_at timestamptz,
  interested_count bigint,
  check_ins_count bigint,
  similarity float
)
language sql stable
as $$
  select
    ews.id,
    ews.organizer_id,
    ews.title,
    ews.description,
    ews.cover_image_url,
    ews.category_id,
    ews.category_name,
    ews.location_id,
    ews.location_name,
    ews.location_address,
    ews.location_lat,
    ews.location_lng,
    ews.location_venue_type,
    ews.event_start_time,
    ews.event_end_time,
    ews.external_ticket_url,
    ews.event_url,
    ews.source,
    ews.is_published,
    ews.confidence_score,
    ews.is_featured,
    ews.created_at,
    ews.updated_at,
    ews.interested_count,
    ews.check_ins_count,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from events e
  join events_with_stats ews on ews.id = e.id
  where
    e.embedding is not null
    and ews.is_published = true
    and ews.event_start_time >= filter_since
    and (1 - (e.embedding <=> query_embedding)) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Grant access to anon and authenticated users (RLS on events handles row-level security)
grant execute on function match_events(vector, float, int, timestamptz) to anon, authenticated;
