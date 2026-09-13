# Task 4: Models + Migration - Report

## Summary

Successfully created 5 SQLAlchemy models for the quiz feature and registered them with Alembic, including migration file.

## Files Created

### 1. `backend/app/models/quiz.py`
- **Quiz**: Main quiz entity with user_id, title, question_types (comma-separated), created_at
- **QuizSourceSession**: Association table linking quizzes to sessions (cascade delete)
- **QuizQuestion**: Quiz questions with snapshot data (prompt_text, options as JSON, correct_index, card_id reference)
- **QuizAttempt**: Quiz attempt tracking with score, duration, submission state
- **QuizAnswer**: Individual answers per attempt with is_correct flag and selected_index

Key design:
- All IDs use String(36) UUID format with default lambda
- Timestamps use DateTime(timezone=True) with UTC default
- Relationships configured with cascade="all, delete-orphan" where appropriate
- Foreign keys use ondelete="CASCADE" or "SET NULL" as needed
- UniqueConstraint on (attempt_id, question_id) in quiz_answers table

### 2. `backend/alembic/env.py` - Modified
Added imports for quiz models:
```python
from app.models.quiz import Quiz, QuizAnswer, QuizAttempt, QuizQuestion, QuizSourceSession  # noqa: F401
```

### 3. `backend/alembic/versions/20260910_add_quiz_tables.py` - Created
Migration file with:
- 5 table creation statements (quizzes, quiz_source_sessions, quiz_questions, quiz_attempts, quiz_answers)
- Proper foreign key constraints with cascade behavior
- Indexes on frequently queried columns (user_id, quiz_id, attempt_id)
- Downgrade function with correct reverse operations

## Testing

Model imports verified successfully:
```
Models import OK
```

## Commit

Committed to develop branch with message:
```
feat: add quiz, question, attempt and answer tables
```

Commit hash: d28ac2d

## Notes

- Quiz models use direct import from session.py to resolve relationship strings (no circular dependency issue)
- Migration preserves existing schema (depends on 20260909_events)
- All 5 quiz tables properly structured for N-to-N relationships and data integrity
