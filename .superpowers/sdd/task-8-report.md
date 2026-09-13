# Task 8: End-to-end Smoke Test for Quiz Flow

## Summary
Created `backend/smoke_test_quiz.py` - a comprehensive smoke test script that verifies the complete quiz API flow from creation through deletion.

## File Created
- **Path:** `backend/smoke_test_quiz.py`
- **Commit:** 37aac2a - "test: add end-to-end smoke test for quiz flow"

## Test Coverage

The smoke test covers the following complete workflow:

### 1. User Registration (REGISTER)
- Register new user with unique email
- Extract and validate token

### 2. Session & Card Setup (SESSION_CREATE, CARD_CREATE)
- Create a session titled "Quiz Source"
- Add 6 vocab cards with synonyms:
  - abundant / dồi dào / plentiful
  - scarce / khan hiếm / rare
  - swift / nhanh nhẹn / rapid
  - sturdy / bền bỉ / robust
  - gloomy / u ám / dismal
  - vivid / sống động / vibrant

### 3. Capacity Validation (CAPACITY)
- POST `/quizzes/capacity` endpoint
- Validates: `max_questions = 18` (6 cards × 3 question types: en_to_vi, vi_to_en, synonym)

### 4. Quiz Creation (QUIZ_CREATE)
- POST `/quizzes` with 6 questions across all 3 types
- Validates:
  - `question_count = 6`
  - `attempt_count = 0` (before any attempts)
  - `best_score = null` (before any attempts)

### 5. Quiz Listing (QUIZ_LIST)
- GET `/quizzes` returns 1 quiz

### 6. Start Attempt (ATTEMPT_START)
- POST `/quizzes/{id}/attempts` starts new attempt
- Returns 6 questions with:
  - Validates: NO `correct_index` in questions (hidden until review)
  - 4 options per question
  - All options are unique (case-insensitive)

### 7. Answer Questions (ANSWER_*; DUPLICATE_*)
- POST `/attempts/{id}/answers` for each question
- Validates:
  - Response includes `is_correct` boolean
  - Response includes `correct_index` for feedback
  - Duplicate answers return 409 Conflict
- Tracks expected score from correct answers

### 8. Submit Attempt (ATTEMPT_SUBMIT)
- POST `/attempts/{id}/submit`
- Validates:
  - `score` matches expected score
  - `total_questions = 6`
  - `duration_seconds` is present

### 9. Review Attempt (ATTEMPT_REVIEW)
- GET `/attempts/{id}`
- Validates:
  - 6 questions returned
  - Each question has `correct_index` (0-3)
  - `is_correct` matches (selected_index == correct_index)

### 10. Quiz Detail Check (QUIZ_DETAIL)
- GET `/quizzes/{id}`
- Validates:
  - `attempt_count = 1`
  - `best_score` equals actual score
  - `attempts` array contains 1 item

### 11. Quiz Deletion (QUIZ_DELETE)
- DELETE `/quizzes/{id}` returns 204
- Cascade delete removes all associated data

### 12. Deletion Verification (QUIZ_NOT_FOUND)
- GET `/quizzes/{id}` returns 404
- Confirms hard delete

## Key Assertions

All assertions follow the spec requirements:

1. **Capacity Validation:** Correctly calculates 6 cards × 3 types = 18 max questions
2. **Question Visibility:** `correct_index` hidden during attempt, visible during review
3. **Answer Validation:** Duplicate answers correctly rejected with 409
4. **Score Tracking:** Score accurately reflects correct answers
5. **Cascade Delete:** Deleting quiz removes all attempts and answers
6. **State Progression:** Quiz metadata (attempt_count, best_score) updates correctly

## How to Run

```bash
cd backend
.venv/Scripts/python smoke_test_quiz.py
```

Expected output ends with: `QUIZ_SMOKE_OK`

## Test Output Pattern

The script follows the pattern of `smoke_test.py` with:
- Status code and response data printed for each endpoint
- Clear assertion messages for debugging
- Final success message `QUIZ_SMOKE_OK`
