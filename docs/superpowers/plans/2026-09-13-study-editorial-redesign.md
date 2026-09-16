# Study Screen "Editorial Focus" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the study/flashcard screen (`/sessions/:id/study`) to the "Editorial Focus" design system so it matches the dashboard, session detail, quiz list and quiz detail pages, without changing a single line of behaviour.

**Architecture:** This is a presentation-only rewrite of one file, `frontend/src/pages/StudyPage.tsx`. Every piece of state, every handler, every `localStorage` key, every API call and the keyboard bindings are preserved byte-for-byte; only JSX structure and Tailwind classes change. The page gains the shared `PageHeader` (the shared `Footer` is already rendered globally in `App.tsx`), so it stops being a 100vh-locked arena and becomes a normal scrolling page. Because the 3D `rotateY` flip is kept, both card faces stay absolutely positioned and the stage therefore needs an explicit height (`min-h-[440px]`, per the spec's "Flashcard Stage: minimum height 440px") instead of the old `flex-1` viewport stretch.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Tailwind 3.4, react-router-dom 6, lucide-react, axios. No test framework in this repo — verification for every task is `cd frontend && npm run build` (which runs `tsc -b`) plus a manual browser check.

**Spec:** `frontend/docs/study_mode/DESIGN (3).md` (tokens + component rules), `frontend/docs/study_mode/code (3).html` (reference markup), `frontend/docs/study_mode/screen (3).png` (visual target). Decisions taken during brainstorming that deliberately diverge from the raw mock are listed under "Known Deviations from the Mock" at the end.

## Global Constraints

- **Zero behaviour change.** Do not add, remove, or rename any `useState`, `useEffect`, `useCallback`, `useMemo`, handler, API call, or `localStorage` key. `DISPLAY_CONFIG_KEY`, `VOICE_GENDER_KEY`, `VOICE_ACCENT_KEY`, `pickVoice`, `FEMALE_VOICE_HINTS`, `MALE_VOICE_HINTS` all stay exactly as they are. If a task's diff touches logic, the task is wrong.
- **All existing features survive:** Start (reset to first card), Shuffle, Speaker settings (Nữ/Nam × US/UK), Display settings (Phonetic/Synonyms/Example), the per-card pronunciation button, the learned toggle, the voice-fallback toast, and the `←` / `→` / `Space` keyboard bindings.
- **No new design tokens.** `frontend/tailwind.config.js` already carries every colour, font size and spacing value this plan uses (`canvas`, `canvas-soft`, `surface-card`, `hairline`, `hairline-soft`, `hairline-strong`, `ink`, `body`, `muted`, `muted-soft`, `primary`, `primary-active`, `on-primary`, `secondary`, `learned-surface`, and the `display-hero`/`headline-lg`/`title-md`/`title-sm`/`body-md`/`body-sm`/`caption-uppercase`/`code-phonetic`/`code-sm` sizes). **Do not edit `tailwind.config.js` in any task.**
- **Single Voltage Rule.** `primary` (`#a83300`) / `primary-active` (`#d04200`) appear in exactly two places on this screen: the `Next` button and the progress-bar fill. Nothing else — not hover borders, not active toggles, not icons. Active/toggled controls use `border-hairline-strong bg-canvas-soft text-ink` instead.
- **Geometry:** interactive controls `rounded-lg`, the card stage `rounded-2xl`, inner panels `rounded-xl`, pills/badges `rounded-full`.
- **Depth:** surfaces are `bg-surface-card` or `bg-canvas-soft` over `bg-canvas`, bounded by `border border-hairline`. No gradients anywhere on this page. No shadows except the existing `shadow-lg` on popovers and the toast.
- **Icons:** `lucide-react` only (the reference HTML's Material Symbols are not a dependency and must not be added).
- **Fonts:** phonetics, counters and keyboard hints use `font-mono` (JetBrains Mono, already configured) — never `font-sans`.
- Verification gate for every task: `cd frontend && npm run build` exits 0.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `frontend/src/pages/StudyPage.tsx` | The whole redesign — shell, toolbar, popovers, progress, stage, nav dock | 1–7 |

No new files, no new components, no deleted files. `PageHeader` and `Footer` are consumed as-is.

The rewrite is sequenced region by region so each task leaves the app building and visually inspectable. Tasks 1–7 all modify the same file; run them in order.

---

### Task 1: Page shell, `PageHeader`, and shared class constants

Replaces the 100vh gradient arena with the standard page shell used by every other redesigned page, and introduces the class constants that Tasks 2–7 reuse.

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (imports at the top, and the outermost JSX at lines 323–331 / 738–740)

**Interfaces:**
- Produces: three module-level string constants that later tasks consume verbatim — `TOOL_BUTTON_CLASS`, `TOOL_BUTTON_ACTIVE_CLASS`, `EYEBROW_CLASS`.
- Produces: `user` and `handleLogout` in component scope, consumed by `<PageHeader>`.

- [ ] **Step 1: Add the new imports**

At the top of the file, add `useAuth` and `PageHeader` to the existing import block. The final import section must read:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Circle, RotateCcw, Settings, Shuffle, Volume2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import type { Card, SessionDetailResponse } from '../types';
```

Note the lucide changes: `Filter` is dropped (the mock's filter pills carry no icon), and `Circle` + `RotateCcw` are added (`Circle` for the not-learned state of the learned pill, `RotateCcw` for the Start button which currently uses a bare `↻` character).

- [ ] **Step 2: Add the shared class constants**

Immediately after the `pickVoice` function (currently ending at line 90) and before `export default function StudyPage()`, add:

```tsx
const TOOL_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 py-1.5 text-body-sm text-body transition-colors hover:bg-canvas-soft hover:text-ink';

const TOOL_BUTTON_ACTIVE_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-hairline-strong bg-canvas-soft px-3 py-1.5 text-body-sm font-semibold text-ink transition-colors';

const EYEBROW_CLASS = 'text-caption-uppercase uppercase text-muted';
```

- [ ] **Step 3: Pull `user` and `handleLogout` into the component**

Directly under `const navigate = useNavigate();` (line 94), add:

```tsx
  const { user, logout } = useAuth();
```

And directly above the `if (loading)` early return (currently line 315), add:

```tsx
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
```

This mirrors `SessionDetailPage.tsx` and `QuizDetailPage.tsx` exactly.

- [ ] **Step 4: Replace the outer shell**

Replace the opening wrapper (lines 324 and 331) — i.e. the `<div className="min-h-screen bg-gradient-to-b …">` and the `<div className="max-w-4xl mx-auto flex flex-col gap-4 h-[calc(100vh-48px)]">` — with:

```tsx
    <div className="page-shell bg-canvas">
      <PageHeader user={user} onLogout={handleLogout} />

      {voiceToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fadeIn rounded-xl bg-ink px-4 py-3 text-body-sm font-semibold text-white shadow-lg">
          {voiceToast}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-margin py-space-xl max-sm:px-space-md">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-space-md">
```

The `voiceToast` block moves inside the new shell and loses its ad-hoc `text-sm` in favour of the `text-body-sm` token; it is otherwise unchanged.

Close it at the bottom of the component (replacing lines 737–739) with:

```tsx
        </div>
      </main>
    </div>
```

The old `<main className="flex-1 overflow-hidden flex flex-col gap-4">` wrapper (line 537) is removed — the new `<main>` is the page-level one, and its inner `<div>` handles the vertical rhythm. Its closing `</main>` on line 737 becomes part of the block above.

- [ ] **Step 5: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 6: Verify in the browser**

Run: `cd frontend && npm run dev`, open a session's study screen.
Expected: the VocabFlash header bar is visible and sticky at the top, the page background is flat cream (`#f7f7f4`) with no amber gradient, the footer sits below the content, and the page scrolls normally instead of being locked to the viewport. The screen will look unstyled in the middle — that is expected until Tasks 2–7 land.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): move study screen onto the shared page shell"
```

---

### Task 2: Toolbar — back link, filter pills with counts, tool buttons, progress counter

Replaces the cramped single-row `<header>` (lines 333–534 of the original) with the reference's three-cluster wrapping toolbar. The popovers inside the Speaker and Display buttons are restyled separately in Task 3 — in this task, keep their existing popover JSX untouched and only change the trigger buttons around them.

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (the `<header>` element)

**Interfaces:**
- Consumes: `TOOL_BUTTON_CLASS`, `TOOL_BUTTON_ACTIVE_CLASS` from Task 1.
- Consumes existing values: `filter`, `setFilter`, `cards`, `learnedCount`, `shuffleEnabled`, `handleToggleShuffle`, `speechSupported`, `showSpeakerSettings`, `setShowSpeakerSettings`, `speakerSettingsRef`, `showDisplaySettings`, `setShowDisplaySettings`, `displaySettingsRef`, `setCurrentIndex`, `setIsFlipped`, `id`.
- Produces: a `filterCounts` memo (`{ all: number; unlearned: number; learned: number }`) used only by this toolbar.

- [ ] **Step 1: Add the filter-count derivation**

Next to the existing `learnedCount` memo (line 272), add:

```tsx
  const filterCounts = useMemo(
    () => ({
      all: cards.length,
      unlearned: cards.length - learnedCount,
      learned: learnedCount,
    }),
    [cards.length, learnedCount],
  );
```

This is derived display data only — no behaviour change.

- [ ] **Step 2: Replace the `<header>` opening and the back link**

Replace lines 333–337 with:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Link
          to={`/sessions/${id}`}
          className="group inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 py-1.5 text-body-sm text-body transition-colors hover:bg-canvas-soft hover:text-ink"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          Session detail
        </Link>
```

- [ ] **Step 3: Replace the three filter buttons with a mapped pill group**

Replace lines 339–386 (the whole `bg-surface-strong rounded-xl p-1` block and its three buttons) with:

```tsx
        <div className="inline-flex items-center gap-space-xs rounded-xl bg-hairline-soft p-1">
          {(['all', 'unlearned', 'learned'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={filter === mode}
              className={`rounded-lg px-3 py-1.5 text-body-sm capitalize transition-colors ${
                filter === mode
                  ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                  : 'text-body hover:text-ink'
              }`}
              onClick={() => {
                setFilter(mode);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
            >
              {mode}
              <span
                className={`ml-1.5 font-mono text-code-sm ${
                  mode === 'learned' ? 'text-secondary' : 'text-muted-soft'
                }`}
              >
                {filterCounts[mode]}
              </span>
            </button>
          ))}
        </div>
```

The `onClick` body is character-for-character the same three statements the three original buttons each ran; only the literal mode differs, which the `map` supplies. `capitalize` renders `all` / `unlearned` / `learned` as "All" / "Unlearned" / "Learned" without changing the state values.

- [ ] **Step 4: Replace the Start and Shuffle buttons**

Replace lines 388–410 with:

```tsx
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={TOOL_BUTTON_CLASS}
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            title="Back to first card"
          >
            <RotateCcw size={16} />
            <span className="max-sm:hidden">Start</span>
          </button>

          <button
            type="button"
            className={shuffleEnabled ? TOOL_BUTTON_ACTIVE_CLASS : TOOL_BUTTON_CLASS}
            onClick={handleToggleShuffle}
            title={shuffleEnabled ? 'Turn off shuffle' : 'Shuffle card order'}
          >
            <Shuffle size={16} />
            <span className="max-sm:hidden">Shuffle</span>
          </button>
```

Note the opening `<div className="flex flex-wrap items-center gap-1.5">` — it now wraps Start, Shuffle, Speaker, Display and the counter pill as one cluster, and is closed in Step 7.

- [ ] **Step 5: Restyle the Speaker trigger button**

Replace the Speaker trigger (lines 413–424) — keeping its `<div className="relative …" ref={speakerSettingsRef}>` wrapper and leaving the popover body below it untouched — with:

```tsx
          {speechSupported && (
            <div className="relative" ref={speakerSettingsRef}>
              <button
                type="button"
                className={showSpeakerSettings ? TOOL_BUTTON_ACTIVE_CLASS : TOOL_BUTTON_CLASS}
                onClick={() => setShowSpeakerSettings((current) => !current)}
                title="Configure pronunciation voice"
              >
                <Volume2 size={16} />
                <span className="max-sm:hidden">Speaker</span>
              </button>
```

- [ ] **Step 6: Restyle the Display trigger button**

Replace the Display trigger (lines 484–495) — again keeping the `<div className="relative …" ref={displaySettingsRef}>` wrapper and leaving the popover body for Task 3 — with:

```tsx
          <div className="relative" ref={displaySettingsRef}>
            <button
              type="button"
              className={showDisplaySettings ? TOOL_BUTTON_ACTIVE_CLASS : TOOL_BUTTON_CLASS}
              onClick={() => setShowDisplaySettings((current) => !current)}
              title="Configure card fields"
            >
              <Settings size={16} />
              <span className="max-sm:hidden">Display</span>
            </button>
```

- [ ] **Step 7: Replace the learned counter and close the toolbar**

Replace lines 531–534 (the `text-xs font-semibold text-body` counter and the closing `</header>`) with:

```tsx
          <span className="rounded-lg bg-hairline-soft px-3 py-1.5 font-mono text-code-sm font-semibold text-ink">
            {learnedCount} / {cards.length}
          </span>
        </div>
      </div>
```

The first `</div>` closes the tool cluster opened in Step 4; the second closes the toolbar row opened in Step 2.

- [ ] **Step 8: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 9: Verify in the browser**

Expected: the toolbar wraps gracefully instead of squeezing; filter pills sit in a soft inset tray with a white raised active pill and a monospace count next to each label (the Learned count in green); Start/Shuffle/Speaker/Display are four identical white hairline buttons whose labels collapse to icons below 640px; toggling Shuffle darkens its border to `hairline-strong` rather than turning it orange; the learned counter is a mono pill on the right. Clicking each filter still resets to card 1 unflipped; Shuffle, Speaker and Display popovers still open and work.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): rebuild session toolbar in editorial focus system"
```

---

### Task 3: Speaker and Display popovers

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (the two popover bodies inside the toolbar)

**Interfaces:**
- Consumes: `EYEBROW_CLASS` from Task 1.
- Consumes existing values: `voiceGender`, `setVoiceGender`, `voiceAccent`, `setVoiceAccent`, `displayConfig`, `toggleDisplayField`.

- [ ] **Step 1: Replace the Speaker popover body**

Replace the `{showSpeakerSettings && ( … )}` block (originally lines 426–480) with:

```tsx
              {showSpeakerSettings && (
                <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col gap-space-md rounded-xl border border-hairline bg-surface-card p-space-md shadow-lg">
                  <div>
                    <p className={`${EYEBROW_CLASS} mb-2`}>Voice</p>
                    <div className="flex items-center gap-space-xs rounded-lg bg-hairline-soft p-1">
                      {(['female', 'male'] as const).map((gender) => (
                        <button
                          key={gender}
                          type="button"
                          aria-pressed={voiceGender === gender}
                          className={`flex-1 rounded px-3 py-1.5 text-body-sm transition-colors ${
                            voiceGender === gender
                              ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                              : 'text-body hover:text-ink'
                          }`}
                          onClick={() => setVoiceGender(gender)}
                          title={gender === 'female' ? 'Female voice' : 'Male voice'}
                        >
                          {gender === 'female' ? 'Nữ' : 'Nam'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className={`${EYEBROW_CLASS} mb-2`}>Accent</p>
                    <div className="flex items-center gap-space-xs rounded-lg bg-hairline-soft p-1">
                      {(['en-US', 'en-GB'] as const).map((accent) => (
                        <button
                          key={accent}
                          type="button"
                          aria-pressed={voiceAccent === accent}
                          className={`flex-1 rounded px-3 py-1.5 font-mono text-code-sm transition-colors ${
                            voiceAccent === accent
                              ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                              : 'text-body hover:text-ink'
                          }`}
                          onClick={() => setVoiceAccent(accent)}
                          title={accent === 'en-US' ? 'US pronunciation' : 'UK pronunciation'}
                        >
                          {accent === 'en-US' ? 'US' : 'UK'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
```

The trailing `</div>` and `)}` close the `relative` wrapper and the `{speechSupported && (` guard from Task 2 Step 5.

- [ ] **Step 2: Replace the Display popover body**

Replace the `{showDisplaySettings && ( … )}` block (originally lines 497–528) with:

```tsx
            {showDisplaySettings && (
              <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col gap-space-sm rounded-xl border border-hairline bg-surface-card p-space-md shadow-lg">
                <p className={EYEBROW_CLASS}>Show on card</p>
                {(
                  [
                    ['phonetic', 'Phonetic'],
                    ['synonyms', 'Synonyms'],
                    ['example', 'Example'],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className="flex cursor-pointer select-none items-center gap-space-sm text-body-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={displayConfig[field]}
                      onChange={() => toggleDisplayField(field)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
```

The trailing `</div>` closes the `relative` wrapper from Task 2 Step 6.

The checkbox keeps `accent-primary` — a native form control's check mark is the one place orange stays, because Tailwind's `accent-*` is the only way to colour it and leaving it browser-blue would break the palette harder than the Single Voltage Rule does.

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 4: Verify in the browser**

Expected: both popovers are white cards with a 1px hairline border and a small uppercase muted eyebrow; the Nữ/Nam and US/UK toggles use the same inset-tray pill language as the filter group; US/UK labels are monospace. Switching voice gender/accent still persists across a page reload (check `studyVoiceGender` / `studyVoiceAccent` in DevTools → Application → Local Storage); toggling the three display checkboxes still shows/hides the matching card regions and persists under `studyCardDisplayConfig`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): restyle speaker and display popovers"
```

---

### Task 4: Progress strip

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (the progress block, originally lines 539–554)

**Interfaces:**
- Consumes existing values: `filteredCards`, `currentIndex`, `detail.session.title`.

- [ ] **Step 1: Replace the progress block**

Replace lines 539–554 with:

```tsx
        <div className="flex flex-col gap-space-sm">
          <div className="flex items-baseline gap-space-sm">
            <span className="font-mono text-title-sm text-ink">
              {filteredCards.length === 0 ? 0 : currentIndex + 1} / {filteredCards.length}
            </span>
            <span className="text-body-sm text-muted">{detail.session.title}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width:
                  filteredCards.length === 0
                    ? '0%'
                    : `${((currentIndex + 1) / filteredCards.length) * 100}%`,
              }}
            />
          </div>
        </div>
```

Three changes only: the counter becomes monospace at the `title-sm` token, the track drops from `h-3 bg-hairline` to the spec's `h-1.5 bg-hairline-soft`, and the fill drops the `bg-gradient-to-r from-primary to-primary-light` for a flat `bg-primary`. The width expression is unchanged.

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Verify in the browser**

Expected: a thin 6px cream track with a flat orange fill; the counter reads e.g. `3 / 46` in JetBrains Mono with the session title beside it in muted grey. Pressing `→` advances the fill.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): flatten progress strip to editorial tokens"
```

---

### Task 5: Flashcard stage — container and front face

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (empty state at lines 557–560, and the flip container + front face at lines 562–628)

**Interfaces:**
- Consumes existing values: `filteredCards`, `currentCard`, `isFlipped`, `setIsFlipped`, `toggleLearned`, `displayConfig`, `speechSupported`, `handleSpeak`.
- Produces: the `min-h-[440px] md:min-h-[480px]` stage height that the back face in Task 6 must match.

- [ ] **Step 1: Replace the empty state**

Replace lines 557–560 with:

```tsx
        {filteredCards.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center rounded-2xl border border-hairline bg-surface-card">
            <p className="text-body-md text-muted">No cards to study in this filter.</p>
          </div>
        ) : currentCard ? (
```

The hardcoded hex `text-[#5a5852]` is replaced by the `text-muted` token, and the empty state now sits in a card so it occupies the same footprint as the stage.

- [ ] **Step 2: Replace the flip container wrapper**

Replace lines 562–572 with:

```tsx
          <div className="flex flex-col gap-space-md">
            <div
              className="perspective min-h-[440px] cursor-pointer transition-transform duration-500 md:min-h-[480px]"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
              onClick={() => setIsFlipped((current) => !current)}
            >
              <div className="relative h-full min-h-[440px] w-full md:min-h-[480px]" style={{ transformStyle: 'preserve-3d' }}>
```

`flex-1` / `min-h-0` are gone because the page no longer stretches to the viewport; the explicit minimum height is what gives the absolutely-positioned faces something to fill. `duration-600` is not a real Tailwind class (it silently did nothing) and is corrected to `duration-500`.

- [ ] **Step 3: Replace the front face**

Replace lines 574–628 with:

```tsx
                {/* Front */}
                <div
                  className="absolute inset-0 flex flex-col rounded-2xl border border-hairline bg-surface-card p-space-lg sm:p-10"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-sm transition-colors ${
                        currentCard.is_learned
                          ? 'bg-learned-surface text-secondary'
                          : 'bg-hairline-soft text-muted hover:text-ink'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleLearned(currentCard.id, !currentCard.is_learned);
                      }}
                    >
                      {currentCard.is_learned ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      {currentCard.is_learned ? 'Learned' : 'Mark learned'}
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-hairline bg-canvas-soft px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-hairline-soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(true);
                      }}
                    >
                      Flip
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center gap-space-sm text-center">
                    <div className="flex items-center gap-space-sm">
                      <h2 className="break-words text-headline-lg text-ink sm:text-display-hero">
                        {currentCard.front_text}
                      </h2>
                      {speechSupported && (
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas-soft text-body transition-colors hover:bg-hairline-soft hover:text-ink"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(currentCard.front_text);
                          }}
                          title="Play pronunciation"
                        >
                          <Volume2 size={18} />
                        </button>
                      )}
                    </div>
                    {displayConfig.phonetic && currentCard.front_phonetic && (
                      <p className="font-mono text-code-phonetic text-muted">{currentCard.front_phonetic}</p>
                    )}
                  </div>
                </div>
```

What changed: the `bg-gradient-to-br from-white/98 to-amber-50/95` and `border-2` become a flat `bg-surface-card border border-hairline`; the utility bar stops being `absolute top-6 left-6 right-6` and becomes a normal flex row at the top of a `flex-col` face, with the word block taking `flex-1` beneath it (this is what stops long words colliding with the buttons); the learned pill becomes a capsule using `learned-surface`/`secondary` per the spec's "Learned / Mastered" badge rule and gains a distinct `Circle` icon for the off state; the word uses the `display-hero` token instead of ad-hoc `text-4xl md:text-5xl font-light`; the phonetic uses `code-phonetic` instead of `text-lg font-mono`.

- [ ] **Step 4: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 5: Verify in the browser**

Expected: a white card roughly 480px tall with a crisp hairline border and no gradient; the word is centred at 48px in a light weight with the IPA beneath in JetBrains Mono grey; a mint "Learned" capsule top-left (grey "Mark learned" when not learned) and a "Flip" button top-right. Clicking the learned pill still toggles and persists (reload the page to confirm the API write); clicking the speaker still speaks; clicking anywhere else on the card still flips it; `Space` still flips it.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): rebuild flashcard front face in editorial focus system"
```

---

### Task 6: Flashcard stage — back face

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (the back face, originally lines 631–693)

**Interfaces:**
- Consumes: `EYEBROW_CLASS` from Task 1, and the `min-h-[440px] md:min-h-[480px]` stage height from Task 5.
- Consumes existing values: `currentCard`, `isFlipped`, `setIsFlipped`, `toggleLearned`, `displayConfig`.

- [ ] **Step 1: Replace the back face**

Replace lines 631–693 with:

```tsx
                {/* Back */}
                <div
                  className="absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-hairline bg-surface-card p-space-lg sm:p-10"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-sm transition-colors ${
                        currentCard.is_learned
                          ? 'bg-learned-surface text-secondary'
                          : 'bg-hairline-soft text-muted hover:text-ink'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleLearned(currentCard.id, !currentCard.is_learned);
                      }}
                    >
                      {currentCard.is_learned ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      {currentCard.is_learned ? 'Learned' : 'Mark learned'}
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-hairline bg-canvas-soft px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-hairline-soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(false);
                      }}
                    >
                      Flip back
                    </button>
                  </div>

                  <div className="mt-space-lg flex w-full flex-col gap-space-lg">
                    <h2 className="break-words text-center text-headline-lg text-ink">
                      {currentCard.back_text}
                    </h2>

                    {displayConfig.synonyms && currentCard.synonyms.length > 0 && (
                      <div>
                        <p className={`${EYEBROW_CLASS} mb-2`}>Synonyms</p>
                        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
                          {currentCard.synonyms.map((synonym) => (
                            <div key={synonym.id} className="rounded-xl bg-canvas-soft p-3">
                              <p className="text-title-sm text-ink">{synonym.word}</p>
                              {synonym.phonetic && (
                                <p className="mt-1 font-mono text-code-sm text-muted-soft" title={synonym.phonetic}>
                                  {synonym.phonetic}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {displayConfig.example && currentCard.example && (
                      <div className="rounded-xl bg-canvas-soft p-space-md">
                        <p className={`${EYEBROW_CLASS} mb-2`}>Example</p>
                        <p className="text-body-md leading-relaxed text-ink">{currentCard.example}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
```

The two trailing closing tags end the `preserve-3d` inner wrapper and the flip container from Task 5 Step 2.

What changed: the orange gradient and `border-2` go; the meaning drops to the `headline-lg` token; synonym tiles lose their blue tint (`bg-blue-100/8 border-blue-300/20`) for the spec's ghost-inset `bg-canvas-soft` with no border; the section labels become real `caption-uppercase` eyebrows instead of `text-xs font-bold uppercase tracking-widest`; the example loses its italic and its nested white card, becoming a single ghost-inset panel; the old `pt-12` hack is replaced by real flex spacing. `overflow-y-auto` moves onto the face itself so long synonym lists scroll within the fixed stage height.

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 3: Verify in the browser**

Expected: after flipping, a white card showing the meaning at 32px centred, then a "SYNONYMS" eyebrow above a 2-column grid of soft cream tiles (word in 15px semibold, IPA in mono grey), then an "EXAMPLE" eyebrow above a cream panel of upright (non-italic) body text. Find a card with many synonyms and confirm the content scrolls inside the card rather than overflowing it. Toggling Synonyms/Example in the Display popover still hides the matching block.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): rebuild flashcard back face in editorial focus system"
```

---

### Task 7: Navigation dock and keyboard hint

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (the nav row and hint, originally lines 697–734)

**Interfaces:**
- Consumes existing values: `currentIndex`, `filteredCards`, `handlePrev`, `handleNext`.

- [ ] **Step 1: Replace the navigation row**

Replace lines 697–729 with:

```tsx
            <div className="flex items-center justify-between gap-space-md">
              <button
                type="button"
                className="inline-flex items-center gap-space-sm rounded-lg border border-hairline-strong bg-surface-card px-4 py-2.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-card"
                disabled={currentIndex === 0}
                onClick={handlePrev}
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              <span className="font-mono text-code-sm text-muted">
                {currentIndex + 1} of {filteredCards.length}
              </span>

              <button
                type="button"
                className="inline-flex items-center gap-space-sm rounded-lg bg-primary px-5 py-2.5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
                disabled={currentIndex >= filteredCards.length - 1}
                onClick={handleNext}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
```

`Previous` becomes the spec's secondary/ghost button and `Next` becomes the primary orange CTA — the only orange control on the page. The disabled styling moves from a ternary into `disabled:` variants, so both buttons declare one class string. The `-translate-y-0.5` hover lift is dropped: the design system builds depth from surfaces and hairlines, not motion.

- [ ] **Step 2: Replace the keyboard hint**

Replace lines 731–734 with:

```tsx
            <div className="flex justify-center">
              <p className="inline-flex flex-wrap items-center justify-center gap-space-sm rounded-full bg-canvas-soft px-4 py-2 text-body-sm text-muted">
                <span>💡</span>
                <span>
                  <span className="font-mono text-code-sm text-body">Space</span> to flip
                </span>
                <span aria-hidden="true">•</span>
                <span>
                  <span className="font-mono text-code-sm text-body">← →</span> arrow keys to navigate
                </span>
              </p>
            </div>
          </div>
        ) : null}
```

The trailing `</div>` closes the `flex flex-col gap-space-md` wrapper from Task 5 Step 2, and `) : null}` closes the existing empty-state ternary unchanged. The hint becomes the reference's capsule; the `bg-black/8` key chips are dropped in favour of plain monospace, since the spec builds emphasis from typeface rather than fills.

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: exits 0.

- [ ] **Step 4: Verify in the browser**

Expected: `Previous` on the left as a white button with a darker hairline, a monospace `4 of 46` centred, and an orange `Next` on the right. On card 1 `Previous` is at 40% opacity and unclickable; on the last card `Next` is. Below, a single cream capsule with the keyboard hints. `←` and `→` still navigate and `Space` still flips.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "style(study): restyle navigation dock and keyboard hint"
```

---

### Task 8: Full-screen regression pass

No code is expected in this task. If any step fails, fix it in `StudyPage.tsx` and re-run the whole checklist.

**Files:**
- Modify: `frontend/src/pages/StudyPage.tsx` (only if a check fails)

- [ ] **Step 1: Confirm no logic drifted**

Run: `git diff <commit-before-task-1>..HEAD -- frontend/src/pages/StudyPage.tsx`
Expected: the only additions outside JSX are the `useAuth`/`PageHeader` imports, the `Circle`/`RotateCcw` icon imports and the `Filter` removal, the three class constants, the `filterCounts` memo, the `const { user, logout } = useAuth();` line and the `handleLogout` function. Confirm that `DISPLAY_CONFIG_KEY`, `VOICE_GENDER_KEY`, `VOICE_ACCENT_KEY`, `pickVoice`, `handleSpeak`, `toggleLearned`, `handlePrev`, `handleNext`, `handleToggleShuffle`, `displayedCards`, `filteredCards` and the two click-outside effects are byte-identical to before.

- [ ] **Step 2: Confirm no forbidden colours remain**

Run: `cd frontend && grep -nE "gradient|amber|blue-|green-|#5a5852|border-2|text-4xl|text-5xl|font-light|bg-black/" src/pages/StudyPage.tsx`
Expected: no output.

- [ ] **Step 3: Confirm the voltage rule**

Run: `cd frontend && grep -n "primary" src/pages/StudyPage.tsx`
Expected: matches on exactly three lines — the Next button's className (`bg-primary`, `hover:bg-primary-active`, `disabled:hover:bg-primary`), the progress fill's `bg-primary`, and the display checkbox's `accent-primary`. Any other line is a Single Voltage Rule violation; fix it.

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 5: Responsive check**

Run the dev server and check the study screen at 375px, 768px and 1440px widths.
Expected: at 375px the tool buttons collapse to icons, the filter tray and tool cluster wrap onto separate lines, the word renders at the 32px `headline-lg` size, and the synonym grid is a single column. At every width the page has no horizontal scrollbar.

- [ ] **Step 6: Full feature sweep**

Walk the screen once and confirm each of these still works: filter All/Unlearned/Learned (including that each resets to card 1 unflipped), Start, Shuffle on and off, Speaker gender + accent (and that the Vietnamese fallback toast still appears at the bottom when a requested voice is unavailable), all three Display toggles, the per-card speaker button, the learned toggle on both faces, click-to-flip, `Space`, `←`, `→`, the back link to session detail, and the header's nav + user menu.

- [ ] **Step 7: Commit any fixes**

```bash
git add frontend/src/pages/StudyPage.tsx
git commit -m "fix(study): address regressions from editorial focus redesign"
```

If nothing needed fixing, skip this step.

---

## Known Deviations from the Mock

- **The mock's Material Symbols icon font is not used.** `lucide-react` is already a dependency and is what every other page uses; adding a second icon system for one screen is not worth it. `arrow_back` → `ArrowLeft`, `restart_alt` → `RotateCcw`, `shuffle` → `Shuffle`, `volume_up` → `Volume2`, `settings` → `Settings`, `check_circle` → `CheckCircle2`, `radio_button_unchecked` → `Circle`, `sync` → dropped (the Flip button is text-only).
- **`primary` stays `#a83300`, not the `#f54e00` quoted in the design doc's prose.** The doc's own front-matter says `primary: '#a83300'`, which is the value already frozen in `tailwind.config.js` and shipped across the rest of the app. The prose figure is treated as stale.
- **The mock's hardcoded numbers are not reproduced.** `46` / `28` / `18` on the filter pills and `5 / 46` in the toolbar come from live state (`cards.length`, `learnedCount`).
- **The 3D flip is kept** (decided in brainstorming) rather than the mock's flat single-stage reveal. The cost is that the stage has a fixed `min-h-[440px]` instead of hugging its content, and very long back content scrolls inside the face.
- **The mock's `shadow-md` on the card and `shadow-sm` on the toolbar buttons are dropped.** The design doc is explicit that "this design system dismisses synthetic drop shadows" and that depth comes from surfaces plus 1px hairlines; the two rules contradict each other and the written rule wins. Shadows survive only on the popovers and the toast, which float above the page.
- **No new features from the mock.** The reference's "Session Progress Indicator Strip" duplicating the counter, and its separate `5 / 46` vs `1 / 46` readouts, are consolidated into the one progress strip plus the one learned-count pill.
