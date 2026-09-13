# Task 10: DashboardPage (hero, tiles, filters, cards, tip dock)

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/components/SessionCard.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 3), `StatsSection` (Task 7, which uses Task 5 and Task 6), tokens (Task 1)
- Produces: `SessionCard({ session, onDelete })` where `onDelete: (id: string) => void` — reused by SessionsPage in Task 11

**Design reference:** `code.html` lines 4-24 (hero), 216-245 (sessions section), 247-263 (tip dock).

## Implementation

### Step 1: Create SessionCard component

Create new file `frontend/src/components/SessionCard.tsx`:

```tsx
import { ArrowRight, RotateCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Session } from '../types';

const MASTERED = 100;

type SessionCardProps = {
  session: Session;
  onDelete: (sessionId: string) => void;
};

export default function SessionCard({ session, onDelete }: SessionCardProps) {
  const percent =
    session.total_cards > 0
      ? Math.round((session.learned_cards / session.total_cards) * 100)
      : 0;
  const strong = percent >= 50;
  const mastered = percent >= MASTERED;

  return (
    <article className="group flex flex-col justify-between gap-space-sm rounded-xl border border-hairline bg-surface-card p-space-md transition-colors hover:bg-canvas-soft">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/sessions/${session.id}`}
          className="truncate text-title-md text-ink transition-colors group-hover:text-primary"
        >
          {session.title}
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`font-mono text-code-sm font-semibold ${
              strong ? 'text-secondary' : 'text-primary'
            }`}
          >
            {percent}%
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:border-primary hover:text-primary"
            onClick={() => onDelete(session.id)}
            title={`Delete ${session.title}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-hairline-soft">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              strong ? 'bg-secondary' : 'bg-primary'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-code-sm text-muted">
            {session.learned_cards} / {session.total_cards} learned
          </span>

          <Link
            to={`/sessions/${session.id}/study`}
            className={`inline-flex items-center gap-1 text-body-sm font-medium transition-colors ${
              mastered ? 'text-secondary hover:text-primary' : 'text-primary hover:text-primary-active'
            }`}
          >
            {mastered ? 'Review' : 'Study now'}
            {mastered ? <RotateCw size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>
      </div>
    </article>
  );
}
```

### Step 2: Rewrite DashboardPage

Replace entire `frontend/src/pages/DashboardPage.tsx` with the code in the Plan section (too long to repeat here — see plan for full implementation).

Key points:
- Hero section with user greeting, "Continue" and "Review History" buttons
- Stats section with four tiles and two charts
- Session toolbar with search input and create button
- Three filter chips: All Sessions, In Progress, Mastered
- Two-column card grid using SessionCard
- Tip dock with keyboard hints
- `streakDays` state passed to PageHeader via `onStreakChange` callback from StatsSection

## Verification

Run: `cd frontend && npm run build`
Expected: exits 0.

In the browser at `/`:
- Hero section with welcome message and action buttons
- Four metric tiles in one row (desktop), 2×2 (tablet), stacked (mobile)
- Two chart panels below
- Sessions toolbar with search box
- Three filter chips (All, In Progress, Mastered)
- 2-column card grid (1 on mobile, 2 on tablet)
- Tip dock at bottom
- Type in search box — cards narrow by title match
- Click "Mastered" with no 100% sessions — empty state reads "No sessions match this filter"

## Commit

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/components/SessionCard.tsx
git commit -m "feat(dashboard): editorial hero, session toolbar, filters and tip dock"
```

