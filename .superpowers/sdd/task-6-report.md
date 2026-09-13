# Task 6: Quiz Router Implementation

## Summary
Successfully implemented the quizzes API router with 6 endpoints for complete quiz management functionality in `backend/app/routers/quizzes.py`.

## Files Created/Modified
- **Created:** `backend/app/routers/quizzes.py` (372 lines)
- **Modified:** `backend/app/main.py` (added quizzes router import and mount)
- **Commit:** `c624196` - feat: add quizzes router with capacity, create, list and delete

## Implemented Endpoints

### 1. POST /quizzes/capacity
**Purpose:** Compute quiz generation capacity for given sessions and question types

**Request:** `CapacityRequest`
- `session_ids: list[str]` (min 1)
- `question_types: list[QuestionType]` (min 1)

**Response:** `CapacityResponse`
- `total_cards: int` - Total card count across selected sessions
- `per_type: dict[str, int]` - Capacity per question type
- `max_questions: int` - Total question generation capacity

**Business Logic:**
- Validates sessions belong to current user
- Loads all cards with eager-loaded synonyms
- Enforces minimum 4-card pool (MIN_POOL_SIZE)
- Computes capacity using `quiz_generator.compute_capacity()`
- Returns 400 if insufficient cards

---

### 2. POST /quizzes
**Purpose:** Create new quiz with automatically generated questions

**Request:** `QuizCreate`
- `title: str` (1-255 chars)
- `session_ids: list[str]` (min 1)
- `question_count: int` (1-100)
- `question_types: list[QuestionType]` (min 1)

**Response:** `QuizListItem`

**Business Logic:**
- Validates all session_ids belong to user (404 if not)
- Loads all cards from specified sessions
- Validates minimum 4-card pool requirement
- Calls `quiz_generator.generate_questions()` to create randomized questions
- Persists Quiz record with comma-separated question_types
- Creates QuizSourceSession records for each source session
- Creates QuizQuestion records with:
  - options stored as JSON string
  - position based on generation order
  - card_id reference (for review)
- Returns computed QuizListItem with stats

**Data Model:**
```
Quiz
  └─ source_sessions: [QuizSourceSession]
  └─ questions: [QuizQuestion]
       └─ options: JSON array of 4 strings
       └─ correct_index: position of answer after shuffle
```

---

### 3. GET /quizzes
**Purpose:** List all quizzes for current user

**Response:** `list[QuizListItem]`

**Query Details:**
- Filters by `Quiz.user_id == current_user.id`
- Orders by `created_at DESC` (newest first)
- Computes stats for each quiz:
  - `question_count`: from `COUNT(QuizQuestion)`
  - `attempt_count`: from submitted attempts only
  - `best_score`: max score across submitted attempts
  - `last_attempt_at`: most recent submission timestamp
  - `source_session_titles`: eager-loaded from QuizSourceSession

---

### 4. GET /quizzes/{quiz_id}
**Purpose:** Get quiz details with complete attempt history

**Response:** `QuizDetailOut`
```python
quiz: QuizListItem              # Full quiz metadata
attempts: list[AttemptSummary]  # Only submitted attempts, newest first
```

**Business Logic:**
- Verifies quiz ownership (404 if not found or not owned)
- Loads all QuizAttempt records ordered by submitted_at DESC
- Filters to only include submitted_at IS NOT NULL
- Returns full quiz details plus attempt history

---

### 5. DELETE /quizzes/{quiz_id}
**Purpose:** Delete quiz and all related data

**Response:** 204 No Content (on success)

**Cascade Behavior:**
- Deletes Quiz record
- SQLAlchemy cascade="all, delete-orphan" handles:
  - QuizSourceSession records
  - QuizQuestion records
  - QuizAttempt records and their QuizAnswer children
- Soft foreign key on QuizQuestion.card_id uses ondelete="SET NULL"

**Security:**
- Verifies ownership before deletion (404 if not owned)

---

### 6. POST /quizzes/{quiz_id}/attempts
**Purpose:** Start a new quiz attempt

**Response:** `AttemptStartOut`
```python
attempt_id: str           # ID of created attempt
quiz_id: str             # Source quiz ID
quiz_title: str          # Quiz title for UI
questions: list[QuestionOut]  # Questions WITHOUT correct_index
```

**Business Logic:**
- Verifies quiz ownership (404 if not found)
- **Cleanup phase:** Deletes all unsubmitted attempts by user on this quiz
  - Query: `submitted_at IS NULL AND user_id == current_user.id`
- Creates new QuizAttempt:
  - `started_at`: current UTC timestamp
  - `total_questions`: from COUNT(QuizQuestion)
  - `score`, `duration_seconds`: NULL (filled on submission)
  - `submitted_at`: NULL (filled when attempt completes)
- Loads quiz questions in position order
- Constructs QuestionOut objects:
  - Parses `options` from stored JSON
  - **Deliberately excludes** correct_index (answer protection)
- Returns attempt data with question list

**Question Loading:**
```python
SELECT QuizQuestion 
WHERE quiz_id = ? 
ORDER BY position
```

---

## Helper Functions

### `_load_user_sessions(db, user_id, session_ids)`
- Queries sessions by ID
- Validates all requested IDs are found
- Returns list or raises 400 "Session not found"
- Used by: capacity, create_quiz endpoints

### `_load_user_cards(db, user_id, session_ids)`
- Joins Card → Session to filter by user
- Eager-loads synonyms with `selectinload(Card.synonyms)`
- Returns all cards from specified sessions
- Used by: capacity, create_quiz endpoints

### `_get_owned_quiz(db, quiz_id, user_id)`
- Loads Quiz with ownership check
- Returns Quiz or raises 404 "Quiz not found"
- Used by: get_quiz, delete_quiz, start_attempt endpoints

### `_quiz_list_item(db, quiz)`
- Computes QuizListItem from Quiz record
- Loads source sessions and builds title list
- Counts attempts and computes stats:
  - `question_count`: from COUNT(QuizQuestion)
  - `best_score`: MAX(score) from submitted attempts
  - `last_attempt_at`: MAX(submitted_at)
  - `attempt_count`: COUNT of submitted attempts
- Used by: every endpoint that returns QuizListItem

---

## Database Queries Summary

| Endpoint | Query Type | Key Operations |
|----------|-----------|-----------------|
| POST /capacity | Validation | SELECT Session, SELECT Card with synonyms |
| POST / (create) | Insert | SELECT Session, SELECT Card, INSERT Quiz + QuizSourceSession + QuizQuestion |
| GET / (list) | Aggregation | SELECT Quiz (many), per-quiz stats calculation |
| GET /{id} | Aggregation | SELECT Quiz, SELECT QuizAttempt ordered |
| DELETE /{id} | Delete | DELETE Quiz (cascade) |
| POST /{id}/attempts | Insert + Cleanup | DELETE unsubmitted attempts, INSERT QuizAttempt, SELECT QuizQuestion |

All queries use:
- `selectinload()` for eager loading relationships (synonyms, sessions)
- `select()` SQLAlchemy 2.0 style (async-compatible)
- Proper `where()` clauses for filtering and access control
- Index-friendly ordering (created_at, submitted_at)

---

## Error Handling

| Error | HTTP Status | Conditions |
|-------|------------|-----------|
| Session not found | 400 | User requests sessions they don't own |
| Quiz not found | 404 | Quiz doesn't exist or doesn't belong to user |
| Need at least 4 cards | 400 | Card pool < MIN_POOL_SIZE |
| Could not generate questions | 400 | Question generation fails (rare) |

---

## Route Mount

**In `backend/app/main.py`:**
```python
from app.routers import auth, sessions, cards, imports, stats, quizzes

app.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
```

**Resulting Endpoints:**
```
POST   /quizzes/capacity
POST   /quizzes
GET    /quizzes
GET    /quizzes/{quiz_id}
DELETE /quizzes/{quiz_id}
POST   /quizzes/{quiz_id}/attempts
```

---

## Key Design Decisions

### 1. Question Options Storage
- Options stored as JSON string in database
- Parsed on every question output
- Allows flexible option count if needed in future
- Immutable after quiz creation (snapshot design)

### 2. Answer Protection
- `QuestionOut` (during quiz) **explicitly excludes** `correct_index`
- Prevents accidental disclosure even if schema is logged
- Only revealed after attempt submission via `ReviewQuestionOut`

### 3. Unsubmitted Attempt Cleanup
- When starting new attempt, delete all unfinished attempts by user
- Prevents orphaned partial attempts
- Ensures single active attempt per user per quiz at any time

### 4. Stats Computation
- Stats computed at request time, not cached
- Leverages database aggregation (COUNT, MAX)
- Ensures always accurate (no stale data)
- Acceptable performance for typical user quiz counts

### 5. Session Ownership Verification
- Every endpoint validates sessions belong to user before using
- 400 response (not 403) signals validation error vs auth error
- Prevents accidental data leakage via session enumeration

---

## Testing Verification

**Route Discovery:**
```bash
grep -n "@router\." backend/app/routers/quizzes.py
```

Output confirms 6 endpoints:
- Line 138: POST /capacity
- Line 170: POST / (create)
- Line 236: GET / (list)
- Line 257: GET /{quiz_id}
- Line 296: DELETE /{quiz_id}
- Line 309: POST /{quiz_id}/attempts

---

## Next Steps

- **Task 7:** Create attempts router with:
  - POST /quizzes/{quiz_id}/attempts/{attempt_id}/answers (submit single answer)
  - POST /quizzes/{quiz_id}/attempts/{attempt_id}/submit (finalize attempt)
  - GET /quizzes/{quiz_id}/attempts/{attempt_id}/review (review after submission)
  
- **Integration Testing:** Verify capacity computation, question generation, and attempt lifecycle
- **Load Testing:** Profile stats computation under many quiz/attempt records
