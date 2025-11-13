-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for geolocation
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================
-- USERS TABLE (Profiles)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    profile_image_url TEXT,
    bio TEXT,
    points INTEGER DEFAULT 0,
    check_ins_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
    ON users FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- =============================================
-- ORGANIZERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS organizers (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organization_name VARCHAR(200) NOT NULL,
    logo_url TEXT,
    address TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for organizers
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified organizers"
    ON organizers FOR SELECT
    USING (is_verified = true);

CREATE POLICY "Organizers can create profile"
    ON organizers FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Organizers can update own profile"
    ON organizers FOR UPDATE
    USING (auth.uid() = id);

-- =============================================
-- CATEGORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
    ON categories FOR SELECT
    USING (true);

-- =============================================
-- EVENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    cover_image_url TEXT NOT NULL,
    category_id UUID REFERENCES categories(id),
    location_name VARCHAR(300) NOT NULL,
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lng DECIMAL(11, 8) NOT NULL,
    location_address TEXT NOT NULL,
    event_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    event_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    external_ticket_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add spatial index for location queries
CREATE INDEX idx_events_location ON events USING GIST (
    ST_MakePoint(location_lng::float, location_lat::float)
);

-- Other indexes for performance
CREATE INDEX idx_events_start_time ON events(event_start_time);
CREATE INDEX idx_events_category ON events(category_id);
CREATE INDEX idx_events_featured ON events(is_featured);
CREATE INDEX idx_events_organizer ON events(organizer_id);

-- RLS Policies for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events from verified organizers"
    ON events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organizers
            WHERE organizers.id = events.organizer_id
            AND organizers.is_verified = true
        )
    );

CREATE POLICY "Organizers can create events"
    ON events FOR INSERT
    WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own events"
    ON events FOR UPDATE
    USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete own events"
    ON events FOR DELETE
    USING (auth.uid() = organizer_id);

-- =============================================
-- EVENT INTERESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS event_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

CREATE INDEX idx_event_interests_event ON event_interests(event_id);
CREATE INDEX idx_event_interests_user ON event_interests(user_id);

-- RLS Policies
ALTER TABLE event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interests"
    ON event_interests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create interests"
    ON event_interests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests"
    ON event_interests FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- EVENT CHECK-INS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS event_check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    check_in_location GEOGRAPHY(POINT) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

CREATE INDEX idx_event_checkins_event ON event_check_ins(event_id);
CREATE INDEX idx_event_checkins_user ON event_check_ins(user_id);

-- RLS Policies
ALTER TABLE event_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins"
    ON event_check_ins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create check-ins"
    ON event_check_ins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =============================================
-- BADGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
    ON badges FOR SELECT
    USING (true);

-- =============================================
-- USER BADGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_by UUID REFERENCES users(id),
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- RLS Policies
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user badges"
    ON user_badges FOR SELECT
    USING (true);

-- =============================================
-- WAITING LIST TABLE (Phase 0)
-- =============================================
CREATE TABLE IF NOT EXISTS waiting_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('social_explorer', 'event_creator', 'ambassador')),
    instagram VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- Only admins can view waiting list (no public access)
CREATE POLICY "No public access to waiting list"
    ON waiting_list FOR SELECT
    USING (false);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for events table
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- MATERIALIZED VIEW FOR EVENT STATS
-- =============================================
CREATE MATERIALIZED VIEW events_with_stats AS
SELECT
    e.*,
    COALESCE(i.interested_count, 0) AS interested_count,
    COALESCE(c.check_ins_count, 0) AS check_ins_count
FROM events e
LEFT JOIN (
    SELECT event_id, COUNT(*) AS interested_count
    FROM event_interests
    GROUP BY event_id
) i ON e.id = i.event_id
LEFT JOIN (
    SELECT event_id, COUNT(*) AS check_ins_count
    FROM event_check_ins
    GROUP BY event_id
) c ON e.id = c.event_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_events_with_stats_id ON events_with_stats(id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_events_with_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY events_with_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to refresh view on changes
CREATE TRIGGER refresh_events_stats_on_interest
    AFTER INSERT OR DELETE ON event_interests
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_events_with_stats();

CREATE TRIGGER refresh_events_stats_on_checkin
    AFTER INSERT OR DELETE ON event_check_ins
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_events_with_stats();

-- =============================================
-- SEED DATA - DEFAULT CATEGORIES
-- =============================================
INSERT INTO categories (name, slug, icon, sort_order) VALUES
    ('Music', 'music', 'musical-notes', 1),
    ('Art & Culture', 'art-culture', 'color-palette', 2),
    ('Food & Drink', 'food-drink', 'restaurant', 3),
    ('Sports & Fitness', 'sports-fitness', 'fitness', 4),
    ('Networking', 'networking', 'people', 5),
    ('Education', 'education', 'school', 6),
    ('Nightlife', 'nightlife', 'moon', 7),
    ('Community', 'community', 'heart', 8)
ON CONFLICT (slug) DO NOTHING;
