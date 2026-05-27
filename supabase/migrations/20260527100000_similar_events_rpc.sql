-- RPC to find semantically similar events using pgvector cosine distance.
-- Uses the pre-computed embedding on the events table (added in 20260304000000_rag_search.sql).
-- Returns up to limit_count published upcoming events ordered by cosine similarity, excluding the input event.
-- Returns empty set if the input event has no embedding (older events before the embedding pipeline).
create or replace function similar_events(event_id uuid, limit_count int default 3)
returns setof events_with_stats
language sql stable security definer
set search_path = public
as $$
  select ews.*
  from events ref
  join events e on e.id != ref.id
  join events_with_stats ews on ews.id = e.id
  where
    ref.id = event_id
    and ref.embedding is not null
    and e.embedding is not null
    and ews.is_published = true
    and ews.event_start_time >= now()
  order by e.embedding <=> ref.embedding
  limit limit_count;
$$;

grant execute on function similar_events(uuid, int) to anon, authenticated;
