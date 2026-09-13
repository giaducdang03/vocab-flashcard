# Session Detail "Editorial Focus" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the session detail page (`/sessions/:id`) to the "Editorial Focus" design system, add a search/filter/sort toolbar with bulk actions, move the add-card form into a modal, and replace the numbered-pagination mock with client-side infinite scroll.

**Architecture:** The backend endpoint `GET /sessions/{id}` already returns every card for the session in one response — it is not changed. All search, filtering, sorting, bulk selection, and "infinite scroll" batching happen client-side over the array already held in React state. The page is decomposed into four new presentational/behavioral units (`CardsToolbar`, `BulkActionBar`, `CardRow`, `AddCardModal`) plus one reusable hook (`useInfiniteReveal`), wired together in a rewritten `SessionDetailPage.tsx`. Design tokens reuse the palette added during the dashboard redesign (`docs/superpowers/plans/2026-09-12-dashboard-editorial-redesign.md`); only one new color token (`learned-surface`) is needed.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Tailwind 3.4, react-router-dom 6, lucide-react, axios. No test framework — verification is `npm run build` (runs `tsc -b`) plus manual browser checks.

**Spec:** `frontend/docs/sessions/DESIGN (1).md` (design tokens + rules), `frontend/docs/sessions/code (1).html` (reference markup), `frontend/docs/sessions/screen (1).png` (visual target). Decisions made during brainstorming that diverge from the raw mock are listed under "Known Deviations from the Mock" at the end of this plan.

## Global Constraints

- **Existing colour tokens are frozen.** `primary` stays `#a83300` (already the value in `tailwind.config.js` — do not touch it), and every other token already present keeps its current value. Only **one** token is new: `learned-surface: '#ebf6f1'`.
- **No backend changes.** `GET /sessions/{id}` keeps returning the full card list in one call; bulk actions call the existing per-card endpoints (`PATCH /cards/{id}/learned`, `DELETE /cards/{id}`) once per selected card via `Promise.all`, not a new bulk endpoint.
- **No invented data.** The mock's "Auto-saved 2m ago" chip and the "Difficulty Level" sort option are dropped — there is no autosave feature and no difficulty field on `Card`. The `Card` type has no `created_at`, so "Recently added" sort approximates recency by reversing the array's existing `(position, created_at)` server order — it is not a true timestamp sort.
- **No card edit UI and no audio playback in this pass** (confirmed in brainstorming) — the mock's edit and volume icons are omitted; each card row keeps exactly two actions: the learned-toggle pill and delete.
- **Icons:** `lucide-react` only (already a dependency), matching the rest of the app.
- **Radii/depth:** interactive controls `rounded-lg`, cards `rounded-xl`, pills/badges `rounded-full`; depth via `border border-hairline` surfaces on `bg-canvas`/`bg-surface-card`, no drop shadows beyond what Tailwind's defaults already used elsewhere in the app (none added here).
- Verification gate for every task: `cd frontend && npm run build` must exit 0.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `frontend/tailwind.config.js` | Add `learned-surface` token | 1 |
| `frontend/src/hooks/useInfiniteReveal.ts` | **New.** Generic reveal-count-on-scroll hook | 2 |
| `frontend/src/components/session/CardsToolbar.tsx` | **New.** Search input, filter pills, sort dropdown | 3 |
| `frontend/src/components/session/BulkActionBar.tsx` | **New.** Select-all row + bulk mark-learned/delete | 4 |
| `frontend/src/components/session/CardRow.tsx` | **New.** Single card presentation (vocab/collocation) | 5 |
| `frontend/src/components/session/AddCardModal.tsx` | **New.** Modal replacing the inline add-card form | 6 |
| `frontend/src/pages/SessionDetailPage.tsx` | Rewritten: hero, toolbar, bulk bar, infinite list, modals | 7 |
| `frontend/src/index.css` | Remove CSS rules only `SessionDetailPage` used | 8 |

---

### Task 1: Add the `learned-surface` design token

**Files:**
- Modify: `frontend/tailwind.config.js:6-29`

**Interfaces:**
- Produces: Tailwind classes `bg-learned-surface` / `hover:bg-learned-surface`.

- [ ] **Step 1: Add the token**

In the `colors` object inside `extend`, add one line (anywhere in the object, e.g. after `'hairline-strong': '#cfcdc4',`):

```js
        'learned-surface': '#ebf6f1',
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0. `git diff frontend/tailwind.config.js` shows exactly one added line.

- [ ] **Step 3: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(design): add learned-surface token for session card mastery tint"
```

---

### Task 2: `useInfiniteReveal` hook

**Files:**
- Create: `frontend/src/hooks/useInfiniteReveal.ts`

**Interfaces:**
- Consumes: nothing (pure React hook, no project imports).
- Produces:

```ts
function useInfiniteReveal(
  resetKey: string,
  totalCount: number,
  batchSize: number,
): { visibleCount: number; sentinelRef: React.RefObject<HTMLDivElement> }
```

`resetKey` is a caller-computed string (e.g. `` `${filter}|${query}|${sort}` ``) that changes whenever the visible count should snap back to `batchSize`. `sentinelRef` must be attached to an element rendered directly after the last visible item; when that element enters the viewport, `visibleCount` grows by `batchSize` (capped at `totalCount`).

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useRef, useState } from 'react';

export function useInfiniteReveal(resetKey: string, totalCount: number, batchSize: number) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [resetKey, batchSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= totalCount) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + batchSize, totalCount));
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [batchSize, totalCount, visibleCount]);

  return { visibleCount, sentinelRef };
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0. Nothing imports this hook yet — Task 7 wires it in.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useInfiniteReveal.ts
git commit -m "feat(sessions): add useInfiniteReveal hook for client-side infinite scroll"
```

---

### Task 3: `CardsToolbar` component

**Files:**
- Create: `frontend/src/components/session/CardsToolbar.tsx`

**Interfaces:**
- Consumes: tokens (Task 1 not required here, uses existing tokens only).
- Produces:

```ts
export type FilterKey = 'all' | 'vocab' | 'collocation' | 'unlearned' | 'learned';
export type SortKey = 'position' | 'alphabetical' | 'recent';

type CardsToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  filter: FilterKey;
  onFilterChange: (value: FilterKey) => void;
  counts: Record<FilterKey, number>;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
};
```

`counts` is computed by the caller (Task 7) from the **full, unfiltered** card list — the pill counters reflect the whole session regardless of the active search text, matching the reference design.

- [ ] **Step 1: Write the component**

```tsx
import { Search, SlidersHorizontal } from 'lucide-react';

export type FilterKey = 'all' | 'vocab' | 'collocation' | 'unlearned' | 'learned';
export type SortKey = 'position' | 'alphabetical' | 'recent';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vocab', label: 'Vocab' },
  { key: 'collocation', label: 'Collocations' },
  { key: 'unlearned', label: 'Unlearned' },
  { key: 'learned', label: 'Learned' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'position', label: 'Position (Default)' },
  { key: 'alphabetical', label: 'Alphabetical (A-Z)' },
  { key: 'recent', label: 'Recently added' },
];

type CardsToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  filter: FilterKey;
  onFilterChange: (value: FilterKey) => void;
  counts: Record<FilterKey, number>;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
};

export default function CardsToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
}: CardsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative max-w-lg flex-1">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search word, phonetic or definition..."
          aria-label="Search cards"
          className="h-11 w-full rounded-lg border border-hairline bg-surface-card pl-11 pr-4 text-body-sm text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-ink"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilterChange(item.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-body-sm font-medium transition-colors ${
              filter === item.key
                ? 'bg-ink text-surface-card'
                : 'border border-hairline bg-surface-card text-body hover:text-ink'
            }`}
          >
            {item.label} <span className="ml-1 font-mono text-code-sm opacity-70">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto">
        <div className="flex h-10 items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 text-body-sm text-ink">
          <SlidersHorizontal size={16} className="text-muted" />
          <span className="text-muted">Sort:</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            className="cursor-pointer bg-transparent pr-1 font-medium text-ink outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/session/CardsToolbar.tsx
git commit -m "feat(sessions): add CardsToolbar with search, filter pills and sort"
```

---

### Task 4: `BulkActionBar` component

**Files:**
- Create: `frontend/src/components/session/BulkActionBar.tsx`

**Interfaces:**
- Produces:

```ts
type BulkActionBarProps = {
  totalVisible: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onMarkLearned: () => void;
  onDelete: () => void;
};
```

`totalVisible` is the count of cards matching the active filter (not just the currently-revealed batch) — "select all" selects every filtered card, even ones not yet scrolled into view.

- [ ] **Step 1: Write the component**

```tsx
import { CheckCircle2, Trash2 } from 'lucide-react';

type BulkActionBarProps = {
  totalVisible: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onMarkLearned: () => void;
  onDelete: () => void;
};

export default function BulkActionBar({
  totalVisible,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onMarkLearned,
  onDelete,
}: BulkActionBarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-container/60 px-4 py-2.5 text-body-sm">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            disabled={totalVisible === 0}
            className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-primary focus:ring-offset-0"
          />
          <span className="font-medium text-ink">Select all {totalVisible} items</span>
        </label>
        <span className="text-hairline-strong">|</span>
        <span className="text-muted">{selectedCount} cards selected</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMarkLearned}
          disabled={!hasSelection}
          className="inline-flex items-center gap-1.5 rounded bg-surface-card px-2.5 py-1 text-body-sm text-body transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={16} />
          Mark learned
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          className="inline-flex items-center gap-1.5 rounded bg-surface-card px-2.5 py-1 text-body-sm text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/session/BulkActionBar.tsx
git commit -m "feat(sessions): add BulkActionBar for select-all and bulk mark/delete"
```

---

### Task 5: `CardRow` component

**Files:**
- Create: `frontend/src/components/session/CardRow.tsx`

**Interfaces:**
- Consumes: `Card`, `Synonym` from `../../types`; `learned-surface` token (Task 1).
- Produces:

```ts
type CardRowProps = {
  card: Card;
  index: number;
  selected: boolean;
  onToggleSelect: (cardId: string) => void;
  onToggleLearned: (cardId: string, value: boolean) => void;
  onDelete: (cardId: string) => void;
};
```

`index` is the card's position within the currently sorted/filtered list (used only for the `#01` display counter, not the card's DB `position`).

- [ ] **Step 1: Write the component**

```tsx
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import type { Card } from '../../types';

type CardRowProps = {
  card: Card;
  index: number;
  selected: boolean;
  onToggleSelect: (cardId: string) => void;
  onToggleLearned: (cardId: string, value: boolean) => void;
  onDelete: (cardId: string) => void;
};

export default function CardRow({ card, index, selected, onToggleSelect, onToggleLearned, onDelete }: CardRowProps) {
  const isCollocation = card.card_type === 'collocation';

  return (
    <article
      className={`rounded-xl p-5 transition-colors sm:p-6 ${
        card.is_learned ? 'bg-learned-surface/70 hover:bg-learned-surface' : 'bg-surface-card hover:bg-canvas-soft'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(card.id)}
            className="h-4 w-4 cursor-pointer rounded text-primary focus:ring-0"
            aria-label={`Select ${card.front_text}`}
          />
          <span
            className={`inline-flex items-center rounded px-2.5 py-0.5 text-caption-uppercase font-bold uppercase tracking-wide text-surface-card ${
              isCollocation ? 'bg-tertiary' : 'bg-ink'
            }`}
          >
            {isCollocation ? 'Collocation' : 'Vocab'}
          </span>
          <span className="font-mono text-code-sm text-muted">#{String(index + 1).padStart(2, '0')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleLearned(card.id, !card.is_learned)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-body-sm font-semibold transition-colors ${
              card.is_learned
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-surface-card text-body hover:text-secondary'
            }`}
          >
            {card.is_learned ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-muted" />}
            {card.is_learned ? 'Learned' : 'Mark learned'}
          </button>

          <button
            type="button"
            onClick={() => onDelete(card.id)}
            title="Delete card"
            className="rounded-lg p-1.5 text-muted transition-colors hover:text-error"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-baseline gap-6 md:grid-cols-12">
        <div className="space-y-1 md:col-span-6">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {isCollocation ? 'Collocation phrase' : 'Front'}
          </span>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h3 className="text-title-md font-semibold text-ink">{card.front_text}</h3>
            {card.front_phonetic && (
              <span className="font-mono text-code-phonetic text-tertiary">{card.front_phonetic}</span>
            )}
          </div>

          {card.synonyms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-3">
              {card.synonyms.map((synonym) => (
                <span
                  key={synonym.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-canvas-soft px-2.5 py-1 text-body-sm"
                >
                  <span className="text-muted">syn:</span>
                  <strong className="font-medium text-ink">{synonym.word}</strong>
                  {synonym.phonetic && (
                    <span className="font-mono text-code-sm text-muted">/{synonym.phonetic}/</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1 md:col-span-6">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {isCollocation ? 'Vietnamese definition & context' : 'Back'}
          </span>
          <p className="text-title-md text-ink">{card.back_text}</p>
          {card.example &&
            (isCollocation ? (
              <div className="mt-2 rounded-lg bg-canvas p-3 text-body-sm text-ink">
                <span className="font-semibold text-primary">Example: </span>
                {card.example}
              </div>
            ) : (
              <p className="pt-1 text-body-sm italic text-muted">&ldquo;{card.example}&rdquo;</p>
            ))}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/session/CardRow.tsx
git commit -m "feat(sessions): add editorial CardRow with vocab/collocation layouts"
```

---

### Task 6: `AddCardModal` component

**Files:**
- Create: `frontend/src/components/session/AddCardModal.tsx`

**Interfaces:**
- Consumes: `CardType` from `../../types`.
- Produces:

```ts
export type CardDraftInput = {
  card_type: CardType;
  front_text: string;
  front_phonetic: string;
  back_text: string;
  example: string;
  synonyms: { word: string; phonetic: string }[];
};

type AddCardModalProps = {
  onSubmit: (draft: CardDraftInput) => Promise<void>;
  onClose: () => void;
};
```

The modal owns its own form state (mirroring the `ImportModal` pattern of `fixed inset-0 bg-ink/50` + `animate-fadeIn`/`animate-slideUp`). It validates `front_text`/`back_text` are non-empty before calling `onSubmit`, and closes itself only after `onSubmit` resolves without throwing.

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CardType } from '../../types';

export type CardDraftInput = {
  card_type: CardType;
  front_text: string;
  front_phonetic: string;
  back_text: string;
  example: string;
  synonyms: { word: string; phonetic: string }[];
};

const emptyDraft: CardDraftInput = {
  card_type: 'vocab',
  front_text: '',
  front_phonetic: '',
  back_text: '',
  example: '',
  synonyms: [{ word: '', phonetic: '' }],
};

type AddCardModalProps = {
  onSubmit: (draft: CardDraftInput) => Promise<void>;
  onClose: () => void;
};

export default function AddCardModal({ onSubmit, onClose }: AddCardModalProps) {
  const [draft, setDraft] = useState<CardDraftInput>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);

  const updateSynonym = (index: number, field: 'word' | 'phonetic', value: string) => {
    setDraft((current) => ({
      ...current,
      synonyms: current.synonyms.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addSynonymRow = () => {
    setDraft((current) => ({
      ...current,
      synonyms: [...current.synonyms, { word: '', phonetic: '' }],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.front_text.trim() || !draft.back_text.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(draft);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-[90vw] max-w-2xl flex-col rounded-3xl border border-hairline bg-canvas animate-slideUp"
      >
        <div className="flex items-center justify-between border-b border-hairline px-7 py-6">
          <h2 className="m-0 text-headline-md font-medium text-ink">Add card</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-ink transition-colors hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-7 py-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-body-sm text-ink">
              <span className="font-semibold">Front text</span>
              <input
                value={draft.front_text}
                onChange={(event) => setDraft({ ...draft, front_text: event.target.value })}
                placeholder="abundant"
                className="w-full rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="space-y-2 text-body-sm text-ink">
              <span className="font-semibold">Phonetic</span>
              <input
                value={draft.front_phonetic}
                onChange={(event) => setDraft({ ...draft, front_phonetic: event.target.value })}
                placeholder="/əˈbʌndənt/"
                className="w-full rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 font-mono text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="space-y-2 text-body-sm text-ink sm:col-span-2">
              <span className="font-semibold">Back text</span>
              <textarea
                value={draft.back_text}
                onChange={(event) => setDraft({ ...draft, back_text: event.target.value })}
                placeholder="dồi dào, phong phú"
                className="min-h-[72px] w-full resize-y rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="space-y-2 text-body-sm text-ink sm:col-span-2">
              <span className="font-semibold">Example</span>
              <textarea
                value={draft.example}
                onChange={(event) => setDraft({ ...draft, example: event.target.value })}
                placeholder="The region has abundant natural resources."
                className="min-h-[72px] w-full resize-y rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-hairline bg-surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-semibold text-ink">Synonyms</span>
              <button
                type="button"
                onClick={addSynonymRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-body-sm text-ink transition-colors hover:bg-canvas-soft"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {draft.synonyms.map((synonym, index) => (
              <div key={index} className="grid grid-cols-2 gap-3">
                <input
                  value={synonym.word}
                  onChange={(event) => updateSynonym(index, 'word', event.target.value)}
                  placeholder="Word"
                  className="w-full rounded-lg border border-hairline bg-canvas-soft px-3 py-2 text-ink outline-none focus:ring-1 focus:ring-ink"
                />
                <input
                  value={synonym.phonetic}
                  onChange={(event) => updateSynonym(index, 'phonetic', event.target.value)}
                  placeholder="Phonetic"
                  className="w-full rounded-lg border border-hairline bg-canvas-soft px-3 py-2 font-mono text-ink outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-hairline px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/session/AddCardModal.tsx
git commit -m "feat(sessions): replace inline add-card form with AddCardModal"
```

---

### Task 7: Rewrite `SessionDetailPage.tsx`

**Files:**
- Modify: `frontend/src/pages/SessionDetailPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CardsToolbar` + `FilterKey`/`SortKey` (Task 3), `BulkActionBar` (Task 4), `CardRow` (Task 5), `AddCardModal` + `CardDraftInput` (Task 6), `useInfiniteReveal` (Task 2), `useAuth` from `../contexts/AuthContext` (existing, used the same way as `SessionsPage.tsx`).
- Produces: no exported types — this is the page's terminal component.

**Behavioral notes:**
- Filter-pill counts (`counts`) are computed from the **full** `cards` array, independent of the active search text, matching the reference design's fixed "All 46 / Vocab 38 / …" counters.
- The card list shown to the user is `cards → filter → search → sort` (`sortedFilteredCards`), then sliced to `visibleCount` for infinite scroll (`visibleCards`).
- "Select all" (`BulkActionBar`) selects every id in `sortedFilteredCards`, not just the currently revealed slice.
- Bulk mark-learned/delete call the existing single-card endpoints once per selected id via `Promise.all` — there is no new backend bulk endpoint.

- [ ] **Step 1: Replace the whole file**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Download, Plus, ShieldCheck, Table, Upload } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ImportModal from '../components/ImportModal';
import PageHeader from '../components/PageHeader';
import CardsToolbar, { type FilterKey, type SortKey } from '../components/session/CardsToolbar';
import BulkActionBar from '../components/session/BulkActionBar';
import CardRow from '../components/session/CardRow';
import AddCardModal, { type CardDraftInput } from '../components/session/AddCardModal';
import { useInfiniteReveal } from '../hooks/useInfiniteReveal';
import type { Card, SessionDetailResponse } from '../types';

const CARD_BATCH_SIZE = 10;

const formatCreatedAt = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('position');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    const response = await api.get(`/sessions/${id}`);
    setDetail(response.data);
    setCards(response.data.cards || []);
    setLoading(false);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDetail();
  }, [id]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const learnedCount = useMemo(() => cards.filter((card) => card.is_learned).length, [cards]);
  const progressPercent = cards.length ? Math.round((learnedCount / cards.length) * 100) : 0;

  const counts = useMemo(
    () => ({
      all: cards.length,
      vocab: cards.filter((card) => card.card_type === 'vocab').length,
      collocation: cards.filter((card) => card.card_type === 'collocation').length,
      unlearned: cards.filter((card) => !card.is_learned).length,
      learned: cards.filter((card) => card.is_learned).length,
    }),
    [cards],
  );

  const sortedFilteredCards = useMemo(() => {
    let list = cards;

    if (filter === 'vocab') {
      list = list.filter((card) => card.card_type === 'vocab');
    } else if (filter === 'collocation') {
      list = list.filter((card) => card.card_type === 'collocation');
    } else if (filter === 'unlearned') {
      list = list.filter((card) => !card.is_learned);
    } else if (filter === 'learned') {
      list = list.filter((card) => card.is_learned);
    }

    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (card) =>
          card.front_text.toLowerCase().includes(needle) ||
          card.back_text.toLowerCase().includes(needle) ||
          (card.front_phonetic ?? '').toLowerCase().includes(needle),
      );
    }

    const sorted = [...list];
    if (sort === 'alphabetical') {
      sorted.sort((a, b) => a.front_text.localeCompare(b.front_text));
    } else if (sort === 'recent') {
      sorted.reverse();
    }

    return sorted;
  }, [cards, filter, query, sort]);

  const resetKey = `${filter}|${query}|${sort}`;
  const { visibleCount, sentinelRef } = useInfiniteReveal(resetKey, sortedFilteredCards.length, CARD_BATCH_SIZE);
  const visibleCards = sortedFilteredCards.slice(0, visibleCount);

  const allSelected =
    sortedFilteredCards.length > 0 && sortedFilteredCards.every((card) => selectedIds.has(card.id));

  const toggleSelectCard = (cardId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sortedFilteredCards.map((card) => card.id)));
  };

  const handleCreateCard = async (draftInput: CardDraftInput) => {
    if (!id) {
      return;
    }

    const payload = {
      card_type: draftInput.card_type,
      front_text: draftInput.front_text.trim(),
      back_text: draftInput.back_text.trim(),
      front_phonetic: draftInput.front_phonetic.trim() || null,
      example: draftInput.example.trim() || null,
      is_learned: false,
      position: 0,
      synonyms: draftInput.synonyms
        .filter((item) => item.word.trim())
        .map((item) => ({ word: item.word.trim(), phonetic: item.phonetic.trim() || null })),
    };

    const response = await api.post(`/sessions/${id}/cards`, payload);
    setCards((current) => [...current, response.data]);
    if (detail) {
      setDetail({ ...detail, cards: [...detail.cards, response.data] });
    }
  };

  const toggleLearned = async (cardId: string, value: boolean) => {
    const response = await api.patch(`/cards/${cardId}/learned`, { is_learned: value });
    setCards((current) => current.map((card) => (card.id === cardId ? response.data : card)));
  };

  const deleteCard = async (cardId: string) => {
    if (!confirm('Delete this card?')) {
      return;
    }

    await api.delete(`/cards/${cardId}`);
    setCards((current) => current.filter((card) => card.id !== cardId));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
  };

  const handleBulkMarkLearned = async () => {
    const ids = Array.from(selectedIds);
    const responses = await Promise.all(
      ids.map((cardId) => api.patch(`/cards/${cardId}/learned`, { is_learned: true })),
    );
    setCards((current) =>
      current.map((card) => {
        const updated = responses.find((response) => response.data.id === card.id);
        return updated ? updated.data : card;
      }),
    );
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected card(s)?`)) {
      return;
    }

    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((cardId) => api.delete(`/cards/${cardId}`)));
    setCards((current) => current.filter((card) => !selectedIds.has(card.id)));
    setSelectedIds(new Set());
  };

  if (loading) {
    return <div className="app-shell center-block">Loading session…</div>;
  }

  const createdLabel = detail ? formatCreatedAt(detail.session.created_at) : '';

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <div className="page-toolbar flex items-center border-b border-hairline">
        <Link to="/" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </div>

      <main className="page-container compact">
        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
                  Session detail
                </span>
                {detail && <span className="font-mono text-code-sm text-muted">Created {createdLabel}</span>}
              </div>

              <h1 className="m-0 text-headline-lg font-medium tracking-tight text-ink">
                {detail?.session.title || 'Session'}
              </h1>

              <div className="pt-2">
                <div className="mb-2 flex items-center justify-between text-body-sm">
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    <ShieldCheck size={18} className="text-secondary" />
                    Mastery progress
                  </span>
                  <span className="font-mono text-code-sm text-body">
                    <strong className="font-semibold text-primary">{learnedCount}</strong> of {cards.length} learned (
                    <span className="font-semibold text-ink">{progressPercent}%</span>)
                  </span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start pt-2 lg:pt-0">
              {cards.length > 0 && (
                <Link
                  to={`/sessions/${id}/study`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  <BookOpen size={18} />
                  Study deck
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
              >
                <Upload size={18} className="text-muted" />
                Import
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-3.5 text-body-sm font-medium text-surface-card transition-colors hover:bg-ink/85"
              >
                <Plus size={18} />
                Add card
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <CardsToolbar
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
            sort={sort}
            onSortChange={setSort}
          />

          {cards.length > 0 && (
            <BulkActionBar
              totalVisible={sortedFilteredCards.length}
              selectedCount={selectedIds.size}
              allSelected={allSelected}
              onToggleSelectAll={toggleSelectAll}
              onMarkLearned={handleBulkMarkLearned}
              onDelete={handleBulkDelete}
            />
          )}
        </section>

        <section className="space-y-4">
          {cards.length === 0 ? (
            <div className="empty-state sofa">
              <h3>No cards yet</h3>
              <p>Add your first flashcard to start studying this session.</p>
            </div>
          ) : sortedFilteredCards.length === 0 ? (
            <div className="empty-state sofa">
              <h3>No cards match your filters</h3>
              <p>Try a different search term or clear the active filter.</p>
            </div>
          ) : (
            <>
              {visibleCards.map((card, index) => (
                <CardRow
                  key={card.id}
                  card={card}
                  index={index}
                  selected={selectedIds.has(card.id)}
                  onToggleSelect={toggleSelectCard}
                  onToggleLearned={toggleLearned}
                  onDelete={deleteCard}
                />
              ))}
              {visibleCount < sortedFilteredCards.length && <div ref={sentinelRef} className="h-1" />}
            </>
          )}
        </section>

        <aside className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-container p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card text-primary">
              <Table size={22} />
            </span>
            <div>
              <h4 className="m-0 text-title-sm text-ink">Need to add many words at once?</h4>
              <p className="m-0 text-body-sm text-body">
                Use the bulk import tool with our standardized spreadsheet template to load 50+ definitions in seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/cards/template/download"
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink transition-colors hover:text-primary"
            >
              <Download size={16} />
              Download .xlsx template
            </a>
            <span className="text-hairline-strong">·</span>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="rounded-lg bg-surface-card px-3 py-1.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
            >
              Open Importer
            </button>
          </div>
        </aside>
      </main>

      {showAddModal && (
        <AddCardModal onSubmit={handleCreateCard} onClose={() => setShowAddModal(false)} />
      )}

      {showImport && id && (
        <ImportModal
          sessionId={id}
          onSuccess={() => {
            setShowImport(false);
            void fetchDetail();
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Manual browser verification**

Run `npm run dev`, open a session with cards (e.g. seed one with 15+ cards to exercise infinite scroll), and check:
- Header shows the user menu (previously missing on this page — now consistent with `/` and `/sessions`).
- Hero card shows title, created date, mastery progress bar, and the three action buttons (Study deck only appears when `cards.length > 0`).
- Typing in the search box narrows the list; the filter pill counts stay fixed while typing.
- Clicking each filter pill (All/Vocab/Collocations/Unlearned/Learned) narrows the list correctly and resets the visible batch back to 10 cards.
- Switching sort to "Alphabetical (A-Z)" reorders the list; switching back to "Position (Default)" restores original order.
- Checking individual card checkboxes updates "N cards selected"; "Select all N items" selects every filtered card (not just the visible batch); bulk "Mark learned" and "Delete" work and clear the selection afterward.
- Scrolling to the bottom of the card list loads 10 more cards at a time until all are shown; the sentinel div disappears once every card is visible.
- Clicking "Add card" opens the modal; submitting a valid card appends it to the list and closes the modal; the "Cancel"/X buttons close without submitting.
- "Import" and "Open Importer" both still open the existing `ImportModal` and refresh the card list on success.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SessionDetailPage.tsx
git commit -m "feat(sessions): rewrite session detail page with editorial toolbar, bulk actions and infinite scroll"
```

---

### Task 8: Remove now-unused CSS from `index.css`

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: no change in exported classes; this only deletes dead rules.

**Do not remove:** `.hero-card`, `.field-group` (+ its `input`/`textarea` rules), `.progress-box` — these are still used by `AttemptReviewPage.tsx`, `QuizDetailPage.tsx`, `QuizzesPage.tsx`, `QuizQuestionView.tsx`, `QuizCreateModal.tsx`, `SessionCreateModal.tsx`, and `AuthPage.tsx`. Only remove the selectors listed below, confirmed (via repo-wide grep during planning) to be referenced exclusively by the old `SessionDetailPage.tsx` JSX that Task 7 replaced.

- [ ] **Step 1: Delete the following rules**

Remove these selector blocks entirely from `frontend/src/index.css`:
- `.session-hero`
- `.editor-panel` (both occurrences — the `.stack-form, .editor-panel { display: grid; gap: 18px; }` combined rule and the standalone `.editor-panel { background: ...; }` rule; keep `.stack-form` by rewriting the combined rule to just `.stack-form { display: grid; gap: 18px; }`)
- `.editor-grid`
- `.full-width`
- `.synonym-block`
- `.synonym-row`
- `.card-list`
- `.card-row` and `.card-row.is-learned`
- `.learn-toggle` and `.learn-toggle.active`
- `.card-preview-grid`
- `.meta-label`
- `.meta-sub`
- `.synonym-list`
- `.synonym-tag`

- [ ] **Step 2: Verify nothing else references the removed classes**

Run: `grep -rn "session-hero\|editor-panel\|editor-grid\|full-width\|synonym-block\|synonym-row\|card-list\|card-row\|learn-toggle\|card-preview-grid\|meta-label\|meta-sub\|synonym-list\|synonym-tag" frontend/src --include=*.tsx`
Expected: no output (all removed from JSX in Task 7; if any line prints, stop and re-check before deleting the matching CSS rule).

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0 (Tailwind/PostCSS doesn't fail on removed custom CSS; this only catches TypeScript regressions from any accidental JSX edits).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "chore(css): remove index.css rules only the old session detail markup used"
```

---

## Verification Checklist

Run after the final task:

- [ ] `cd frontend && npm run build` — exits 0
- [ ] Visit `/sessions/:id` for a session with 0 cards — empty state renders, no toolbar/bulk bar crash on empty `counts`
- [ ] Visit `/sessions/:id` for a session with 20+ cards — infinite scroll reveals batches of 10 while scrolling
- [ ] Resize to 375px, 768px, 1440px — hero actions wrap, toolbar stacks, card grid (Front/Back) collapses to one column below `md`
- [ ] `git diff` on `tailwind.config.js` shows only the one added `learned-surface` line
- [ ] `/sessions/:id/study` link still navigates correctly from "Study deck"

## Known Deviations from the Mock

| Mock element | Decision | Reason |
|---|---|---|
| Numbered pagination (`1 2 3 4 5`) | Replaced with client-side infinite scroll (`IntersectionObserver`, batches of 10) | Explicit user requirement — "đừng chia trang mà load infinity" |
| "Auto-saved 2m ago" chip | Dropped | No autosave feature exists; do not fabricate status |
| Sort: "Difficulty Level" | Dropped | No difficulty field on `Card` |
| Edit icon per card | Dropped (confirmed in brainstorming) | Out of scope for this pass; backend `PUT /cards/{id}` exists but no UI wiring was requested |
| Audio pronunciation icon | Dropped (confirmed in brainstorming) | No TTS integration in scope |
| "Recently added" sort | Approximated by reversing the existing `(position, created_at)` server order | `Card` has no `created_at` field exposed to the frontend |
| Bulk mark-learned/delete | Implemented as `Promise.all` over existing single-card endpoints | No backend bulk endpoint exists; avoids a backend change for this frontend-only pass |
| Header user menu on session detail | Added (`PageHeader user={user} onLogout={handleLogout}`) | Brings this page in line with `/` and `/sessions`, which already show it; was inconsistently missing before this pass |
