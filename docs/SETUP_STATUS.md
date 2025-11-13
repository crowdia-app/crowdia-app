# Crowdia MVP - Setup Status & Next Steps

## ✅ Completed Infrastructure Setup

### Dependencies Installed
- `@supabase/supabase-js` - Supabase client library
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `react-hook-form` - Form handling
- `zod` - Schema validation
- `expo-location` - Geolocation services
- `react-native-maps` - Map display
- `expo-image-picker` - Image selection
- `expo-image-manipulator` - Image processing
- `date-fns` - Date utilities

### Project Structure Created
```
crowdia-app/
├── lib/                      # Utilities and clients
│   ├── supabase.ts          # Supabase client configuration
│   └── react-query.tsx      # React Query provider
├── services/                 # API service layer (empty, ready for implementation)
├── stores/                   # Zustand state stores (empty, ready for implementation)
├── types/                    # TypeScript type definitions
│   └── database.ts          # Complete database types
├── supabase/                 # Database schema and migrations
│   ├── migrations/
│   │   └── 20250101000000_initial_schema.sql  # Complete database schema
│   └── functions/           # Supabase Edge Functions (empty, ready for implementation)
└── .env.example             # Environment variable template
```

### Database Schema Defined
The complete database schema has been created in `supabase/migrations/20250101000000_initial_schema.sql` including:
- ✅ Users table with profiles
- ✅ Organizers table with verification system
- ✅ Events table with geolocation
- ✅ Categories table with seed data
- ✅ Event interests tracking
- ✅ Event check-ins with geofencing
- ✅ Badges system
- ✅ User badges
- ✅ Waiting list table
- ✅ Materialized view for event stats
- ✅ Row Level Security (RLS) policies
- ✅ Indexes for performance
- ✅ Triggers for auto-update timestamps

### TypeScript Types Generated
Complete type definitions in `types/database.ts` for type-safe development.

---

## 🔴 Required: Business/Admin Actions

### 1. Supabase Project Setup (CRITICAL - Required for all dev work)
**Action Required:** Mattia needs to:
1. Create a Supabase project at https://supabase.com
2. Run the migration file (`supabase/migrations/20250101000000_initial_schema.sql`) in the SQL editor
3. Provide the following credentials:
   - `EXPO_PUBLIC_SUPABASE_URL` (Project URL)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Anonymous public key)

**How to get credentials:**
- Go to Project Settings > API
- Copy the "Project URL"
- Copy the "anon/public" key

**Create `.env` file with:**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_APP_ENV=development
```

### 2. Additional Supabase Configuration Needed
After running the migration, Mattia should:
1. Enable Email/Password authentication in Supabase Dashboard (Authentication > Providers)
2. Configure email templates for signup/password reset
3. Set up Storage bucket for images:
   - Create bucket: `event-covers`
   - Create bucket: `profile-images`
   - Set appropriate access policies

---

## 📋 Tasks Updated in Notion

### Tasks Moved to "Needs More Biz Info"
The following tasks have been moved and commented because they require business input:

1. **Manually onboard 10-20 founding organizers**
   - Needs: List of target organizers, contact info, onboarding materials

2. **Import events from founding organizers**
   - Needs: Organizer list, event data, permission/approval, import format

3. **Iterate based on feedback**
   - Needs: Specific user feedback and actionable items from business team

4. **Monitor Supabase usage and costs**
   - Needs: Supabase project to exist first, monitoring tool decision

5. **Monitor app crashes and errors**
   - Needs: Error monitoring service selection (Sentry recommended), can implement after core features

6. **Test event creation and publishing**
   - Needs: Event creation feature to be built first (Phase 1C)

---

## 🚀 Ready to Implement Once Supabase is Configured

### Phase 1A - Consumer Core (High Priority)
Can start immediately after Supabase setup:

1. **Authentication System**
   - Sign up / Sign in screens
   - Email/Password only
   - Session management

2. **User Profile**
   - Profile creation flow
   - Profile view/edit
   - Avatar upload

3. **Event Feed**
   - Vertical scrolling feed
   - Event cards UI
   - Basic filters (Today, Tomorrow, Weekend, Category)
   - Pull-to-refresh

4. **Map View**
   - Display events on map
   - Event pins
   - Mini-card on pin tap

5. **Event Detail Page**
   - Full event information
   - "Interested/Going" button
   - "Buy Tickets" button (opens external URL)
   - "Check-in" button (with geofencing)

### Phase 1B - Gamification (Medium Priority)
Depends on Phase 1A being partially complete:

1. **Points Display**
   - Show points counter in profile
   - Visual feedback when earning points

2. **Interest Functionality**
   - Toggle interested status
   - Award +10 points
   - Show interested count
   - Real-time updates

3. **Check-in System**
   - Geolocation validation (150m radius)
   - Time validation (event must be ongoing)
   - Award +100 points
   - Prevent duplicate check-ins

4. **Share Functionality**
   - Native share sheet
   - Award +50 points

### Phase 1C - Organizer Features
After consumer features are working:

1. **Organizer Registration**
   - "I am an Organizer" toggle
   - Organization profile setup
   - Pending verification status

2. **Event Creation Form**
   - All required fields
   - Image upload
   - Location selection (Google Places API)
   - Ticket URL optional field

3. **Organizer Dashboard**
   - My Events list
   - Stats per event (interested count, check-in count)

4. **Public Organizer Profile**
   - Organization info
   - Event gallery (Upcoming/Past)

### Phase 1D - Admin Panel
Separate Next.js project (not started yet):

1. **Organizer Verification Queue**
2. **Event Management**
3. **User Management**
4. **Category Management**
5. **Badge Assignment**

---

## 🔧 Technical Decisions Made

### Why These Tools?
- **Expo**: Faster development, OTA updates, built-in modules
- **Supabase**: PostgreSQL + Auth + Storage + Realtime in one service, cost-effective (<$25/mo)
- **React Query**: Optimized server state caching and real-time updates
- **TypeScript**: Type safety and better developer experience

### Security Implemented
- ✅ Row Level Security (RLS) on all tables
- ✅ Proper authentication required for mutations
- ✅ Public access only to verified organizer content
- ✅ Secure check-in validation (server-side)

### Performance Optimizations Planned
- Database indexes on frequently queried fields
- Materialized view for event stats (auto-refreshing)
- Image compression before upload
- React Query caching (5-minute stale time)

---

## 📝 Next Immediate Steps

### For Development Team (Blocked until Supabase is ready):
1. ⏸️ Wait for Supabase credentials from Mattia
2. ⏸️ Then implement authentication flows
3. ⏸️ Then build event feed UI

### For Business Team (Mattia):
1. 🔴 **URGENT**: Set up Supabase project and provide credentials
2. 🟡 Compile list of founding organizers for manual onboarding
3. 🟡 Prepare any event data that needs to be imported
4. 🟡 Decide on error monitoring service (Sentry recommended per Technical Plan)
5. 🟡 Review and approve the database schema

---

## 📊 Phase Status

| Phase | Status | Blocked By |
|-------|--------|------------|
| Phase 0 - Infrastructure | 🟡 Partial | Supabase setup needed |
| Phase 1A - Consumer Core | 🔴 Not Started | Supabase credentials |
| Phase 1B - Gamification | 🔴 Not Started | Phase 1A |
| Phase 1C - Organizer Features | 🔴 Not Started | Phase 1A, 1B |
| Phase 1D - Admin Panel | 🔴 Not Started | Separate project |
| Phase 1E - Testing & Launch | 🔴 Not Started | All previous phases |

**Legend:**
- 🟢 Complete
- 🟡 In Progress / Partial
- 🔴 Not Started / Blocked

---

## 💡 Recommendations

1. **Priority 1**: Get Supabase set up ASAP - this unblocks all development work
2. **Priority 2**: Focus on Phase 1A (Consumer Core) first - this validates the core product loop
3. **Priority 3**: Implement gamification (Phase 1B) to drive engagement
4. **Consider**: Setting up a staging environment on Supabase for testing before production

---

## ❓ Questions for Business Team

1. Do we have design mockups/wireframes for the UI screens?
2. What's the target launch date for MVP?
3. Are there any brand assets (logo, colors, fonts) ready?
4. Who will be the first "Founding Partner" organizers to onboard?
5. Do we need to support languages other than Italian/English initially?

---

**Last Updated:** 2025-11-13
**Setup by:** Dev Team
**Status:** Infrastructure Complete, Waiting on Supabase Credentials
