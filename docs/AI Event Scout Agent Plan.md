# AI Event Scout Agent - Implementation Plan

## Overview

The AI Event Scout Agent is an automated system that discovers events in metropolitan areas, extracts structured data, and populates the Crowdia database with events, locations, and organizers.

**Implementation:** Node.js scripts triggered by GitHub Actions cron jobs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                            │
│  ┌─────────────────┐           ┌─────────────────┐          │
│  │ Extraction Cron │           │ Discovery Cron  │          │
│  │  (2x daily)     │           │   (weekly)      │          │
│  └────────┬────────┘           └────────┬────────┘          │
└───────────┼─────────────────────────────┼───────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│              scripts/event-scout/                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    index.ts                          │    │
│  │  CLI entry point with --extraction/--discovery flags │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                  │
│  ┌───────────────────┐       ┌───────────────────┐         │
│  │ agents/           │       │ agents/           │         │
│  │ extraction.ts     │       │ discovery.ts      │         │
│  │ - Fetch sources   │       │ - Brave search    │         │
│  │ - Extract events  │       │ - Find new URLs   │         │
│  │ - Save to DB      │       │ - Save sources    │         │
│  └───────────────────┘       └───────────────────┘         │
│              │                           │                  │
│              └─────────────┬─────────────┘                  │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Shared Modules                     │    │
│  │  db/        - Supabase client, CRUD operations      │    │
│  │  tools/     - OpenRouter, Brave, Geocoding, Slack   │    │
│  │  config.ts  - Environment variables                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase                                │
│  events, locations, organizers, event_aggregators, etc.     │
└─────────────────────────────────────────────────────────────┘
```

---

## Two-Workflow Architecture

### Agent 1: Discovery Agent (Weekly)

**Purpose:** Find NEW event source pages and add them to the database.

**Process:**
1. Brave Search for event-related queries: "[city] events", "[city] clubs", etc.
2. For each result, classify: Is this an event listing page?
3. Check if we already have this source in our database
4. If NEW, add to `event_aggregators` table

**Run Frequency:** Weekly (Mondays at 6am UTC)

### Agent 2: Extraction Agent (Daily)

**Purpose:** Fetch known event sources and extract event data.

**Process:**
1. Query database for all active event sources
2. For each source URL:
   - Fetch page content (via Jina AI Reader → markdown)
   - Extract events using LLM (OpenRouter)
   - Geocode addresses if needed (Google Maps)
3. Deduplicate against existing events
4. Insert new events with `is_published = false`

**Run Frequency:** Twice daily (8am/8pm UTC)

---

## File Structure

```
agents/                      # AI Agents (standalone Node.js)
├── index.ts                 # CLI entry point
├── config.ts                # Environment configuration
├── extraction.ts            # Extraction agent
├── discovery.ts             # Discovery agent
├── db/
│   ├── index.ts             # Barrel export
│   ├── client.ts            # Supabase client (service role)
│   ├── events.ts            # Event CRUD operations
│   ├── locations.ts         # Location CRUD with geocoding
│   ├── organizers.ts        # Organizer CRUD
│   ├── categories.ts        # Category find/create
│   └── sources.ts           # Get event sources from DB
└── tools/
    ├── index.ts             # Barrel export
    ├── openrouter.ts        # LLM event extraction
    ├── brave-search.ts      # Web search for discovery
    ├── web-fetch.ts         # Jina AI page fetching
    ├── geocoding.ts         # Google Maps geocoding
    └── slack.ts             # Notifications

types/
└── database.ts              # Shared TypeScript types

lib/
└── supabase.ts              # App Supabase client (anon key)

scripts/
└── run-agents.ts            # Thin wrapper (optional)

.github/workflows/
└── event-scout.yml          # GitHub Actions cron triggers
```

---

## Usage

### Local Development

```bash
# Run extraction agent
npm run agents:extract

# Run discovery agent
npm run agents:discover

# Run both agents
npm run agents:both

# Dry run (no changes)
npm run agents -- --dry-run

# Show help
npm run agents -- --help
```

### GitHub Actions

The agents run automatically:
- **Extraction:** Twice daily (8am/8pm UTC)
- **Discovery:** Weekly (Mondays 6am UTC)

Manual trigger available via GitHub Actions UI with options:
- Agent selection (extraction/discovery/both)
- Dry run mode

---

## External Services

| Service | Purpose | Cost |
|---------|---------|------|
| **OpenRouter** | LLM extraction (MiMo-V2-Flash) | FREE |
| **Brave Search** | Web search for discovery | FREE (2k/month) |
| **Google Maps** | Geocoding addresses | FREE (10k/month) |
| **Jina AI Reader** | HTML → Markdown conversion | FREE (generous tier) |
| **Slack** | Run notifications | FREE |

**Estimated monthly cost: $0**

---

## Environment Variables

Required in GitHub Secrets and local `.env`:

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPEN_ROUTER_API_KEY=sk-or-v1-...
BRAVE_API_KEY=BSA...
GOOGLE_MAPS_API_KEY=AIza...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # optional
```

---

## Code Examples

### LLM Event Extraction (OpenRouter)

```typescript
import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://crowdia.app",
    "X-Title": "Crowdia Event Scout",
  },
});

const response = await openrouter.chat.completions.create({
  model: "xiaomi/mimo-v2-flash:free",
  messages: [
    {
      role: "system",
      content: "Extract events from page content. Return JSON.",
    },
    {
      role: "user",
      content: `Extract events:\n\n${pageContent}\n\nRespond with JSON only.`,
    },
  ],
  max_tokens: 8192,
  temperature: 0.3,
});
```

### Web Search (Brave API)

```typescript
async function braveSearch(query: string): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "20");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_API_KEY!,
    },
  });

  const data = await response.json();
  return data.web?.results || [];
}
```

### Page Fetching (Jina AI)

```typescript
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: "text/plain",
      "X-Return-Format": "markdown",
    },
  });

  return response.text();
}
```

---

## Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `events` | Event records with `event_url`, `source`, `is_published` |
| `locations` | Venues with `event_sources` JSONB |
| `organizers` | Promoters with `event_sources` JSONB |
| `event_aggregators` | City-wide event listing sites |
| `categories` | Event categories |

### Agent-Specific Fields

```sql
-- events table additions
event_url VARCHAR(500),           -- Original source URL
source VARCHAR(50),               -- "aggregator", "location", "organizer"
is_published BOOLEAN DEFAULT false,
confidence_score INTEGER,
source_metadata JSONB

-- locations/organizers
event_sources JSONB               -- {"ra": "https://ra.co/...", "dice": "..."}

-- event_aggregators table
CREATE TABLE event_aggregators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  base_url VARCHAR(500),
  events_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  scrape_priority INTEGER DEFAULT 5,
  notes TEXT
);
```

---

## Configuration

Key settings (hardcoded in `config.ts`, adjustable):

| Setting | Value |
|---------|-------|
| Target Metro | Palermo, Sicily, Italy |
| Max events per run | 100 |
| Time window | 14 days |
| Rate limit | 2000ms between requests |
| LLM Model | `xiaomi/mimo-v2-flash:free` |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Events discovered per run | 50+ |
| Data completeness | 80%+ have all required fields |
| Duplicate detection accuracy | 95%+ |
| False positive rate | < 5% |
| Run time | < 10 minutes |

---

## Status

### Completed

- [x] Database schema migrations
- [x] Initial data import (17 locations, 16 organizers, 7 aggregators)
- [x] Node.js agent implementation
- [x] GitHub Actions workflow
- [x] All external service integrations

### Future Improvements

- [ ] Admin review UI for unpublished events
- [ ] Confidence scoring algorithm
- [ ] Detail page fetching for richer data
- [ ] Re-scraping for event updates/cancellations
- [ ] Runtime configuration via `agent_config` table
