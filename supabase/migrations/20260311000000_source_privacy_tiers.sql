-- =============================================
-- DATA SOURCE PRIVACY TIERS & LEGAL CLASSIFICATION
-- =============================================
-- Adds privacy tier classification and scraping rules to event_sources.
-- Tiers:
--   1 = Public API        (official API, full data collection permitted)
--   2 = Open Web          (public site, robots.txt allows, no ToS restriction)
--   3 = Restricted Web    (public site, restrictive ToS; basic metadata only)
--   4 = Social Platform   (Instagram/Facebook; public posts only, no user data)
--   5 = Requires Auth     (closed platform; no automated scraping)

ALTER TABLE event_sources
  ADD COLUMN IF NOT EXISTS privacy_tier INTEGER CHECK (privacy_tier BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS legal_notes TEXT,
  ADD COLUMN IF NOT EXISTS scraping_rules JSONB DEFAULT '{}';

COMMENT ON COLUMN event_sources.privacy_tier IS '1=Public API, 2=Open Web, 3=Restricted Web, 4=Social Platform, 5=Requires Auth';
COMMENT ON COLUMN event_sources.legal_notes IS 'Human-readable ToS disclosure notes and classification justification';
COMMENT ON COLUMN event_sources.scraping_rules IS 'Per-source scraping rules: rate_limit_ms, retain_days, allowed_fields, requires_auth';

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_event_sources_privacy_tier ON event_sources(privacy_tier);

-- =============================================
-- AUTO-CLASSIFY KNOWN SOURCES
-- =============================================

-- Tier 1: Public APIs
UPDATE event_sources SET
  privacy_tier = 1,
  legal_notes = 'Resident Advisor public API — data use permitted per RA API Terms of Service',
  scraping_rules = '{"rate_limit_ms":500,"retain_days":null,"allowed_fields":["all"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%ra.co%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 1,
  legal_notes = 'Eventbrite public API — event data use permitted per Eventbrite Developer API Terms',
  scraping_rules = '{"rate_limit_ms":500,"retain_days":null,"allowed_fields":["all"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%eventbrite.%' AND privacy_tier IS NULL;

-- Tier 2: Open Web aggregators (Italian local sources, open event listings)
UPDATE event_sources SET
  privacy_tier = 2,
  legal_notes = 'PalermoToday — public news/events site; robots.txt permits crawling; publicly available event data',
  scraping_rules = '{"rate_limit_ms":2000,"retain_days":90,"allowed_fields":["title","date","venue","description","url","image"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%palermotoday.it%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 2,
  legal_notes = 'PalermoViva — public local events listing; publicly available event data',
  scraping_rules = '{"rate_limit_ms":2000,"retain_days":90,"allowed_fields":["title","date","venue","description","url","image"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%palermoviva.it%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 2,
  legal_notes = 'Balarm.it — Sicilian events aggregator; publicly available event data',
  scraping_rules = '{"rate_limit_ms":2000,"retain_days":90,"allowed_fields":["title","date","venue","description","url","image"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%balarm.it%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 2,
  legal_notes = 'Teatro.it — Italian theatre listings; publicly available event data',
  scraping_rules = '{"rate_limit_ms":2000,"retain_days":90,"allowed_fields":["title","date","venue","description","url","image"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%teatro.it%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 2,
  legal_notes = 'Terradamare.org — Sicilian cultural events; publicly available data',
  scraping_rules = '{"rate_limit_ms":2000,"retain_days":90,"allowed_fields":["title","date","venue","description","url","image"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%terradamare.org%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 2,
  legal_notes = 'Itinerarinellarte.it — Italian cultural events; publicly available data',
  scraping_rules = '{"rate_limit_ms":2000,"retain_days":90,"allowed_fields":["title","date","venue","description","url","image"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%itinerarinellarte.it%' AND privacy_tier IS NULL;

-- Tier 3: Restricted Web (commercial ticketing platforms with restrictive ToS)
UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'FeverUp — commercial event platform; ToS restricts automated scraping; collect only publicly visible event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%feverup.com%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'Ticketone — Italian ticketing platform; ToS restricts scraping; collect only public event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%ticketone.it%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'TicketSMS — Italian ticketing platform; ToS restricts scraping; collect only public event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%ticketsms.it%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'Dice.fm — music ticketing platform; ToS restricts automated access; collect only public event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%dice.fm%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'Xceed — nightlife platform; ToS restricts scraping; collect only public event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%xceed.me%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'Songkick — concert discovery; ToS restricts automated access; collect only public event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%songkick.com%' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 3,
  legal_notes = 'Bandsintown — artist event listings; ToS restricts scraping; collect only public event metadata',
  scraping_rules = '{"rate_limit_ms":5000,"retain_days":30,"allowed_fields":["title","date","venue","ticket_url"],"requires_auth":false,"human_review":false}'
WHERE url LIKE '%bandsintown.com%' AND privacy_tier IS NULL;

-- Tier 4: Social Platforms (Instagram, Facebook)
UPDATE event_sources SET
  privacy_tier = 4,
  legal_notes = 'Instagram — Meta platform; ToS prohibits automated scraping; collect only publicly posted event announcements; no user data stored; human review required for new sources',
  scraping_rules = '{"rate_limit_ms":10000,"retain_days":14,"allowed_fields":["title","date","venue"],"requires_auth":false,"human_review":true,"store_user_data":false}'
WHERE type = 'instagram' AND privacy_tier IS NULL;

UPDATE event_sources SET
  privacy_tier = 4,
  legal_notes = 'Facebook — Meta platform; ToS prohibits automated scraping; collect only publicly posted event info; no user data stored',
  scraping_rules = '{"rate_limit_ms":10000,"retain_days":14,"allowed_fields":["title","date","venue"],"requires_auth":false,"human_review":true,"store_user_data":false}'
WHERE type = 'facebook' AND privacy_tier IS NULL;
