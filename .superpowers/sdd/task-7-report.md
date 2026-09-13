# Task 7 Report: Router `/attempts`

## Summary
Successfully implemented the quiz attempts router with three endpoints to handle quiz attempt lifecycle: answering questions, submitting attempts, and reviewing results.

## Files Created
- `backend/app/routers/attempts.py` - Quiz attempts router with 3 endpoints

## Files Modified
- `backend/app/main.py` - Added attempts router import and mount at `/attempts` prefix

## Endpoints Implemented

### 1. POST `/attempts/{attempt_id}/answers` → `AnswerSubmitResponse`
**Purpose:** Submit an answer for a single question in a quiz attempt

**Request Schema:** `AnswerSubmitRequest`
- `question_id` (str): ID of the question being answered
- `selected_index` (int | None): Selected answer option (0-3, nullable for unanswered)

**Response Schema:** `AnswerSubmitResponse`
- `is_correct` (bool): Whether the answer is correct
- `correct_index` (int): The correct answer index

**Validation & Logic:**
- Validates attempt belongs to current user (404 if not)
- Checks attempt is not yet submitted (409 if already submitted)
- Validates question exists in the quiz (404 if not)
- Prevents duplicate answers via unique constraint (409 if duplicate)
- Calculates correctness: `is_correct = (selected_index == question.correct_index)` or False if NULL
- Increments `attempt.score` if answer is correct
- Creates `QuizAnswer` record and commits

**Error Responses:**
- 404: Attempt not found or not owned by user
- 404: Question not found in quiz
- 409: Attempt already submitted
- 409: Question already answered (duplicate)

### 2. POST `/attempts/{attempt_id}/submit` → `AttemptSubmitResponse`
**Purpose:** Finalize an attempt, mark unanswered questions, and set submission metadata

**Request:** Empty body

**Response Schema:** `AttemptSubmitResponse`
- `attempt_id` (str): The attempt ID
- `score` (int): Final score
- `total_questions` (int): Total number of questions
- `duration_seconds` (int): Time taken in seconds

**Validation & Logic:**
- Validates attempt belongs to current user (404 if not)
- Checks attempt not already submitted (409 if already submitted)
- Fetches all questions in quiz
- Fetches all answered questions for this attempt
- Creates `QuizAnswer` records for unanswered questions with:
  - `selected_index = NULL`
  - `is_correct = false`
- Sets `submitted_at` to current UTC time
- Calculates `duration_seconds` as integer difference between `submitted_at` and `started_at`
- Commits changes

**Error Responses:**
- 404: Attempt not found
- 409: Already submitted

### 3. GET `/attempts/{attempt_id}` → `AttemptReviewOut`
**Purpose:** Review a submitted attempt with all questions, answers, and correct indices

**Response Schema:** `AttemptReviewOut`
- `attempt_id` (str): The attempt ID
- `quiz_id` (str): The quiz ID
- `quiz_title` (str): Quiz title
- `score` (int): Final score
- `total_questions` (int): Total questions
- `duration_seconds` (int | None): Time taken
- `submitted_at` (datetime): Submission timestamp
- `questions` (list[ReviewQuestionOut]): Array of questions with full details

**ReviewQuestionOut** includes:
- `id`, `question_type`, `prompt_text`, `prompt_phonetic`, `options` (from question)
- `correct_index` (revealed after submission)
- `selected_index` (user's answer, nullable)
- `is_correct` (whether user got it right)
- `card_id` (original card reference, nullable)
- `position` (question order)

**Validation & Logic:**
- Validates attempt belongs to current user (404 if not)
- Checks attempt is submitted (409 if not submitted yet)
- Fetches quiz for title
- Fetches all questions ordered by position
- Fetches all answers
- Builds question objects with answer details
- Returns complete review data

**Error Responses:**
- 404: Attempt not found
- 409: Attempt not yet submitted

## Helper Functions

### `_get_owned_attempt(db, attempt_id, user_id) → QuizAttempt`
Fetches a `QuizAttempt` and validates it belongs to the specified user. Raises 404 HTTPException if not found or not owned by user.

## Implementation Details

**Imports:**
```python
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizQuestion
from app.schemas.quiz import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    AttemptReviewOut,
    AttemptSubmitResponse,
    ReviewQuestionOut,
)
```

**Router Registration:**
```python
app.include_router(attempts.router, prefix="/attempts", tags=["attempts"])
```

## Testing

Route verification shows all three endpoints are properly registered:
```
['/attempts/{attempt_id}/answers', '/attempts/{attempt_id}/submit', '/attempts/{attempt_id}']
```

## Commit Information

**Commit SHA:** 585c5e7
**Message:** feat: add quiz attempt answer, submit and review endpoints

Implements three new endpoints for handling quiz attempts:
- POST /attempts/{attempt_id}/answers: submit answer to a question
- POST /attempts/{attempt_id}/submit: finalize attempt with unanswered questions
- GET /attempts/{attempt_id}: review attempt results after submission

## Files Changed Summary
- `backend/app/routers/attempts.py`: 249 lines added (new file)
- `backend/app/main.py`: 1 line added (router import and mount)
