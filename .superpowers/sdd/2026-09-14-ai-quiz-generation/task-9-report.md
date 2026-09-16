# Task 9 Report — Frontend

## Status
Implementation complete. `npx tsc --noEmit` passes with no errors. `npm run build` succeeds.

## Changes

1. `frontend/src/types/index.ts`
   - `QuestionType` extended with `'cloze' | 'context'`.
   - Added `AI_QUESTION_TYPES` constant array.
   - Added Vietnamese labels for the two new types to `QUESTION_TYPE_LABELS`.
   - `Quiz` gained `status`, `uses_ai`, `error_message`, `ai_question_count`.
   - Added `AiStatus` and `QuizStatus` interfaces.
   - Added `explanation?: string | null` to `AnswerResult` (the answer-submit response type in this codebase).
   - Added `explanation?: string | null` and `source?: string` to `ReviewQuestion`.

2. `frontend/src/components/quiz/QuizCreateModal.tsx`
   - Fetches `GET /quizzes/ai-status` on open, stores in `aiStatus` state.
   - Replaced the hardcoded `QUESTION_TYPES` list with a computed `availableTypes` (includes `cloze`/`context` only when `aiStatus.available`).
   - Added an "AI" chip next to AI question types and an explanatory note when any AI type is selected.

3. `frontend/src/hooks/useQuizPolling.ts` (new)
   - Polls `GET /quizzes/{id}/status` every 2s for quizzes with `status === 'pending'`.
   - Stops entirely (no interval) when there are no pending quizzes — verified via the `pendingIds` dependency gate.

4. `frontend/src/pages/QuizzesPage.tsx`
   - Wired `useQuizPolling` to update quiz status/question_count/error_message in place.
   - Added `handleRetry` calling `POST /quizzes/{id}/retry` and replacing the quiz in state.
   - Passes `onRetry` to `QuizCard`.

5. `frontend/src/components/quiz/QuizCard.tsx`
   - Added `onRetry` prop.
   - Renders a pending-state card (title + "AI đang soạn đề…" note + shimmer skeleton) when `status === 'pending'`, before the normal clickable card — so it isn't clickable while pending.
   - Renders a failed-state card (error message + retry button) when `status === 'failed'`.

6. `frontend/src/components/quiz/QuizQuestionView.tsx`
   - Added `renderPrompt` that splits `cloze` prompts on `___` and renders a `.cloze-blank` span in place of the blank.
   - Explanation (`result.explanation`) is rendered only inside the existing `hasResult` block — i.e., only after the user has answered, never before.

7. `frontend/src/pages/AttemptReviewPage.tsx`
   - Renders `question.explanation` under each reviewed question, with an "AI soạn" chip when `question.source === 'ai'`.

8. `frontend/src/index.css`
   - Added styles: pending/failed card text, shimmer skeleton + keyframes, `.type-chip`, `.ai-note`, `.cloze-blank`, `.answer-explanation` / `.review-explanation`.

## Extra fixes required for type-safety (not explicitly listed in the plan but necessary for `Record<QuestionType, ...>` exhaustiveness)
- `frontend/src/components/QuestionTypeBadges.tsx`: added `cloze`/`context` entries to the `typeColors` map.
- `frontend/src/components/session/PracticeSummary.tsx`: added `cloze`/`context` zero-entries to `typeBreakdown` (Practice mode doesn't generate these types, but the map must be exhaustive over `QuestionType`).

## Note on Step 9 deviation
The plan describes adding explanation state directly in `TakeQuizPage.tsx`. In this codebase, the actual "feedback" block (correct/incorrect + Next button) lives inside `QuizQuestionView.tsx`, driven by the `result: AnswerResult | null` prop passed down from `TakeQuizPage`. Since `AnswerResult` now carries `explanation`, no state change was needed in `TakeQuizPage.tsx` itself — the explanation renders inside `QuizQuestionView`'s existing `hasResult` conditional, satisfying "after answering, not during quiz" without touching `TakeQuizPage.tsx`.

## Verification
- `cd frontend && npx tsc --noEmit` — no errors.
- `cd frontend && npm run build` — succeeded (dist output produced, pre-existing chunk-size warning only, unrelated to this change).

## Commit
`feat(quiz-ui): AI question types, pending state and explanations`
