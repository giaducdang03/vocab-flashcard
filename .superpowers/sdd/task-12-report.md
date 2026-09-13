# Task 12: Quiz Detail Page + Attempt History Report

## Summary
Successfully created the Quiz Detail Page with attempt history functionality and implemented the `/quizzes/:id` route.

## Files Created

### 1. `frontend/src/components/quiz/AttemptHistory.tsx`
- Displays attempt history in a responsive table format
- **Columns:**
  - Date: Formatted as "MMM DD, YYYY HH:MM"
  - Score: "X/Y" format
  - Percent: Calculated percentage of correct answers
  - Duration: Formatted as "Xm Ys" or "Xs" for seconds only
  - Action: Review button (placeholder for future implementation)
- **Empty State:** "No attempts yet..." message with supporting text
- Helper functions:
  - `formatDuration()`: Converts seconds to readable format (handles null case)
  - `formatDate()`: Converts ISO date string to user-friendly format

### 2. `frontend/src/pages/QuizDetailPage.tsx`
- Main quiz detail page with the following layout:
  - **Header:** Back navigation link to `/quizzes`
  - **Hero Card:** 
    - Eyebrow: "Quiz"
    - Title: Quiz title
    - Meta: "{question_count} questions · question_types · from sessions"
    - Button: "Start quiz" or "Retake quiz" based on attempt history
  - **Section:** "Attempt history (count)"
  - **AttemptHistory Component:** Displays all attempts or empty state
- **State Management:**
  - `detail`: QuizDetail object or null
  - `loading`: Boolean loading state
- **API:** Fetches `GET /quizzes/{id}`
- **Lifecycle:** Scrolls to top on mount via `useEffect`

## Files Modified

### 1. `frontend/src/App.tsx`
- Added import: `import QuizDetailPage from './pages/QuizDetailPage';`
- Added new route:
  ```typescript
  <Route
    path="/quizzes/:id"
    element={
      <ProtectedRoute>
        <QuizDetailPage />
      </ProtectedRoute>
    }
  />
  ```

### 2. `frontend/src/pages/QuizzesPage.tsx`
- Updated `onOpen` callback in QuizCard component
- Changed from TODO placeholder to actual navigation: `navigate(`/quizzes/${quiz.id}`)`

## Testing Results

✅ **TypeScript Check:** No type errors
```bash
npx tsc --noEmit
```

✅ **Build:** Successful build with Vite
```bash
npm run build
✓ 1652 modules transformed
✓ built in 2.64s
```

## Git Commit

```
commit 3e78514
feat: add quiz detail page with attempt history

- Created AttemptHistory component with table display
- Created QuizDetailPage with hero card and attempt history section
- Added /quizzes/:id route in App.tsx
- Updated QuizzesPage navigation to quiz detail page
```

## Technical Details

### Component Architecture
- **AttemptHistory:** Stateless component receiving attempts array
- **QuizDetailPage:** Page component with state management and API integration
- Both components follow existing project patterns and styling conventions

### Styling
- Uses existing CSS classes from the project
- Responsive table with hover effects
- Consistent with QuizCard and SessionDetailPage styling

### Types Used
- `QuizDetail`: Contains quiz info and attempts array
- `QuizAttemptSummary`: Individual attempt data
- `QuestionType`: For displaying question types
- `QUESTION_TYPE_LABELS`: For translating question types to display labels

## Next Steps (Not Implemented)
- Review button functionality linking to attempt review page
- Error handling UI for failed API calls
- Loading state for individual attempts (if implemented)
