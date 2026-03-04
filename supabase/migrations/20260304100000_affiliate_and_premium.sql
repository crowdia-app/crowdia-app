-- Affiliate click tracking: records every time a user clicks an external link
-- (ticket URL or event page URL) from within the app.
-- This powers affiliate commission attribution and click-through analytics.
create table if not exists affiliate_clicks (
  id           uuid         primary key default gen_random_uuid(),
  user_id      uuid         references users(id) on delete set null,
  event_id     uuid         references events(id) on delete cascade,
  url          text         not null,
  -- 'ticket' = external_ticket_url, 'event_url' = event source page
  click_type   text         not null check (click_type in ('ticket', 'event_url')),
  created_at   timestamptz  not null default now()
);

-- Index for analytics queries: clicks per event, clicks per user
create index if not exists affiliate_clicks_event_id_idx on affiliate_clicks(event_id);
create index if not exists affiliate_clicks_user_id_idx  on affiliate_clicks(user_id);
create index if not exists affiliate_clicks_created_at_idx on affiliate_clicks(created_at);

-- RLS: anyone can insert their own click (unauthenticated clicks have user_id = null)
alter table affiliate_clicks enable row level security;

create policy "insert own click"
  on affiliate_clicks for insert
  with check (
    user_id is null or user_id = auth.uid()
  );

-- Admins can read all clicks for analytics
create policy "admins can read clicks"
  on affiliate_clicks for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.is_admin = true
    )
  );

-- Premium subscription columns on users
alter table users
  add column if not exists is_premium boolean not null default false,
  add column if not exists premium_expires_at timestamptz;
