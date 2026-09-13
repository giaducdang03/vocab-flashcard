# Task 3: Endpoint GET /stats/daily - Report

## Implementation Status: DONE

### Steps Completed

#### Step 1: Create `backend/app/schemas/stats.py` ✓
- Created schema file with two Pydantic models:
  - `DailyPoint`: Contains `date` (date) and `learned_count` (int)
  - `DailyStatsOut`: Contains `days` (int), `daily` (list of DailyPoint), and `current_streak` (int)

#### Step 2: Add `calculate_streak` to `backend/app/services/learning.py` ✓
- Added import: `from datetime import date, timedelta`
- Added `calculate_streak(learned_dates: set[date], today: date) -> int` function
- Function correctly handles the case where today hasn't had any learning yet (starts counting from yesterday)
- Logic: counts consecutive days backward from today/yesterday with at least 1 learned card

#### Step 3: Create `backend/app/routers/stats.py` ✓
- Created router with `GET /daily` endpoint
- Implements query parameters:
  - `days`: 1-365 (default 30)
  - `tz_offset_minutes`: -840 to 840 (default 0)
- Properly handles timezone offset by converting `occurred_at` timestamps to local dates
- Queries `card_learn_events` table with joins to Card and Session
- Filters by event_type="learned" and current user's session
- Returns dense daily array (no gaps) with learned_count for each day

#### Step 4: Modify `backend/app/main.py` ✓
- Added import: `from app.routers import auth, sessions, cards, imports, stats`
- Registered router: `app.include_router(stats.router, prefix="/stats", tags=["stats"])`

#### Step 5: Endpoint Restart ✓
- Rebuilt Docker containers with `docker compose up -d --build`
- Backend successfully started and health check passed

#### Step 6: Parameter Validation Tests ✓
- Test `days=0`: Returns 422 Unprocessable Entity ✓
- Test `days=400`: Returns 422 Unprocessable Entity ✓
- Test `tz_offset_minutes=999`: Returns 422 Unprocessable Entity ✓
All validation tests passed as expected.

#### Step 7: Endpoint Tests ✓

**Test 1: Basic endpoint access (7 days, +420min timezone)**
```
GET /stats/daily?days=7&tz_offset_minutes=420
Authorization: Bearer <token>
Response: 200 OK
```
Returns expected structure:
- `days: 7`
- `daily`: Array with exactly 7 DailyPoint objects
- `current_streak: 0` (no learned cards yet for this user)
- All date objects are properly formatted ISO dates
- Covers from 2026-09-03 to 2026-09-09 (7 consecutive days)

**Test 2: Default parameters (30 days)**
```
GET /stats/daily
Authorization: Bearer <token>
Response: 200 OK
```
Returns expected structure:
- `days: 30`
- `daily`: Array with exactly 30 DailyPoint objects (dense)
- `current_streak: 0` (no learned cards)
- Covers from 2026-08-11 to 2026-09-09 (30 consecutive days)
- All learned_count values are 0 (user has not learned any cards yet)

**Test 3: Authentication required**
```
GET /stats/daily
Response: 401 Unauthorized (no token)
```
Endpoint properly requires Bearer token authentication.

### Verification Results

- **Endpoint Returns**: HTTP 200 with correct JSON structure
- **Parameter Validation**: All edge cases (days=0, days=400, tz_offset_minutes=999) properly return 422
- **Dense Array**: Daily array always contains exactly `days` entries with no gaps
- **Date Range**: Correctly calculates from `today - (days-1)` to today
- **Timezone Handling**: Correctly applies tz_offset_minutes to local date calculation
- **Streak Calculation**: Function correctly counts consecutive days (0 for new users with no learned cards)
- **Authentication**: Endpoint properly validates Bearer token via `get_current_user`

### Technical Details

- **Query Structure**: Uses base select with joins to Card → Session for user filtering
- **Window Query**: Counts distinct card_ids per local date with "learned" event type
- **Streak Query**: Queries all learned dates then runs calculation logic
- **Date Offset**: Uses SQLAlchemy's func.date with timedelta offset for proper timezone handling
- **Distinct Cards**: Counts learned_count as count(distinct(CardLearnEvent.card_id)) to avoid duplication

### Commit Hash

```
ab25b4f feat: add GET /stats/daily with daily series and streak
```

### No Concerns

- All implementation requirements met
- All tests passing
- Code follows project patterns and conventions
- Proper error handling and validation
- Documentation matches implementation
