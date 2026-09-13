# Task 5: Pydantic Schemas for Quiz API

## Summary
Successfully created comprehensive Pydantic schemas for the quiz API in `backend/app/schemas/quiz.py`.

## File Created
- **Path:** `backend/app/schemas/quiz.py`
- **Size:** 110 lines of code with 110 insertions
- **Commit:** `ffb60b8` - feat: add quiz pydantic schemas

## Schema Definitions

### Core Types
- `QuestionType`: Literal type supporting three question formats: `en_to_vi`, `vi_to_en`, `synonym`

### Request/Response Models

#### Capacity Management
- `CapacityRequest`: Request for quiz capacity checking (session_ids, question_types)
- `CapacityResponse`: Response with total cards count and max questions available

#### Quiz Management
- `QuizCreate`: Request to create a new quiz (title, session_ids, question_count, question_types)
- `QuizListItem`: Quiz summary for list views (includes attempt_count, best_score, last_attempt_at)
- `QuizDetailOut`: Combined quiz info and attempt history

#### Attempt Management
- `AttemptStartOut`: Quiz and questions data when starting an attempt
- `AttemptSummary`: Summarized attempt record (score, total_questions, duration_seconds)
- `AttemptSubmitResponse`: Score and metadata after submitting entire attempt
- `AttemptReviewOut`: Complete attempt review with detailed question feedback

#### Question Handling
- `QuestionOut`: Question shown **while taking the quiz** (NO `correct_index`) - prevents answer leakage
- `ReviewQuestionOut`: Question shown **after submission** (includes `correct_index`, selected_index, is_correct)

#### Individual Answers
- `AnswerSubmitRequest`: Submit single answer (question_id, selected_index)
- `AnswerSubmitResponse`: Immediate feedback (is_correct, correct_index)

## Key Design Decision: Answer Protection

The schema intentionally separates question presentation into two variants:

### QuestionOut Fields (During Quiz)
```
- id, question_type, prompt_text, prompt_phonetic
- options, position
- ✗ NO correct_index (prevents accidental answer disclosure)
```

### ReviewQuestionOut Fields (After Submission)
```
- All QuestionOut fields PLUS:
- correct_index (now safe to reveal)
- selected_index (user's choice)
- is_correct (evaluation result)
- card_id (reference to source card)
```

## Verification

### Test Results
```bash
# QuestionOut validation
QuestionOut fields: ['id', 'options', 'position', 'prompt_phonetic', 'prompt_text', 'question_type']
Has correct_index: False ✓

# ReviewQuestionOut validation
ReviewQuestionOut fields: ['card_id', 'correct_index', 'id', 'is_correct', 'options', 'position', 'prompt_phonetic', 'prompt_text', 'question_type', 'selected_index']
Has correct_index: True ✓
```

All schemas import successfully and field validation works as expected.

## Architecture Benefits

1. **Type Safety**: Full Pydantic validation prevents invalid data from reaching API consumers
2. **API Clarity**: Response schema distinguishes between quiz-taking and quiz-review flows
3. **Security**: Answer protection is enforced at the schema level, not just business logic
4. **Extensibility**: Optional fields (e.g., `card_id`, `duration_seconds`) support future enhancements
5. **Documentation**: Schema docstrings explain the purpose of each model

## Next Steps
- Implement database models to persist these entities
- Create API endpoints that use these schemas
- Add validation tests for schema constraints (min/max lengths, field ranges)
