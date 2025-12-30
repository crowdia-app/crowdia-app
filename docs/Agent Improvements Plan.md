# Agent Improvements Plan

Based on extraction agent test run (2024-12-30).

## Quick Wins (Implementing Now)

### 1. Location Filtering
Add strict Palermo location validation to prevent non-local events (like "Squaxin Island Tribe Annual Ceremony" from Eventbrite).

**Implementation:** Update LLM prompt to strictly filter by Palermo/Sicily.

### 2. Date Validation
Skip events with start_time in the past.

### 3. Set is_published=true
Events should be published by default (can add review workflow later).

### 4. Deprioritize JS-Heavy Sources
RA.co venue pages and Xceed venue pages require JavaScript rendering. Jina Reader can't handle them.

**Action:** Set `is_active=false` for these sources in the database until we add headless browser support.

---

## Medium Priority (Future)

### 5. Add Headless Browser Support
Use Puppeteer in GitHub Actions to fetch JS-rendered pages.

**Affected sources:**
- RA.co (all pages - returns 403 or requires JS)
- Xceed venue pages (JS skeleton loading)
- Dice venue pages (JS skeleton loading)

**Note:** Xceed and Dice main city pages might work, just venue-specific pages need JS.

### 6. Confidence Scoring
Calculate confidence based on:
- Has image URL? (+20)
- Has description > 50 chars? (+20)
- Has ticket URL? (+15)
- Has end_time different from start_time? (+10)
- Has organizer name? (+15)
- Has location address? (+20)

Events with confidence < 50 could be flagged for review.

### 7. Better Duplicate Detection
Current: exact title match + same date
Improved: fuzzy title matching (Levenshtein distance < 3)

### 8. Event Update Detection
When re-scraping, detect if event details changed and update instead of skip.

---

## Low Priority (Later)

### 9. Admin Review UI
Simple web interface to:
- View unpublished events
- Approve/reject
- Edit before publishing

### 10. Event Cancellation Detection
If an event disappears from source, flag it for review rather than leaving stale.

### 11. Image Downloading
Download cover images to Supabase Storage instead of hotlinking external URLs.

---

## Source Status

| Source | Status | Notes |
|--------|--------|-------|
| PalermoToday | ✅ Working | Best source - 39 events |
| Eventbrite | ✅ Working | 17 events, needs location filtering |
| Balarm | ✅ Working | 2 events |
| Xceed (city) | ✅ Working | 1 event |
| Country DiscoClub (RA) | ⚠️ Partial | 4 events but inconsistent |
| RA.co venue pages | ❌ Blocked | 403 error |
| Xceed venue pages | ❌ JS-only | Needs headless browser |
| Dice venue pages | ❌ JS-only | Needs headless browser |
| TicketSMS | ❌ No events | Page might be empty or wrong URL |
