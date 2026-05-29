-- Pre-computed similar event IDs for the "Love this Vibe?" carousel.
-- Populated nightly by agents/generate-similar-events.ts instead of running
-- an expensive pgvector cosine query per page load.
alter table events
  add column if not exists similar_event_ids uuid[] default null,
  add column if not exists similar_events_updated_at timestamptz default null;

-- NOTE: apply to prod via Supabase Dashboard SQL editor (Management API unavailable in agent env)
