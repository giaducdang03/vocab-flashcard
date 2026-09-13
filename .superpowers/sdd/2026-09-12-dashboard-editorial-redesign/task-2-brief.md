# Task 2: Full-width shell without touching seven page files

**Files:**
- Modify: `frontend/src/index.css:68-82`
- Modify: `frontend/src/pages/SessionDetailPage.tsx:109`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `.page-shell` = full-bleed column; `.page-container` = centred 1152px content well; `.page-toolbar` = centred sub-toolbar row. Every page that already renders `<div className="page-shell"><PageHeader/>…<main className="page-container">` gets a sticky full-width header for free.

**Context:** `PageHeader` is rendered by six pages from inside `.page-shell`, which currently caps width at 1200px and adds padding. Moving the width cap from the shell down to the container makes the header span the viewport in all six at once — **without touching those six page files**.

## Step 1: Rewrite the shell rules in `frontend/src/index.css`

Replace the existing `.page-shell`, `.page-container`, and `.page-container.compact` rules with:

```css
.page-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-container {
  width: 100%;
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 32px 80px;
  display: grid;
  gap: 32px;
}

.page-container.compact {
  gap: 24px;
}

.page-toolbar {
  width: 100%;
  max-width: 1152px;
  margin: 0 auto;
  padding: 12px 32px;
}

@media (max-width: 640px) {
  .page-container {
    padding: 20px 16px 64px;
    gap: 24px;
  }

  .page-toolbar {
    padding: 12px 16px;
  }
}
```

## Step 2: Centre the SessionDetail sub-toolbar

`frontend/src/pages/SessionDetailPage.tsx:109` is a `<div>` with inline styles that sits between the header and `<main>`. With the header now full-width, this row should also be centred. Change:

```tsx
<div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--hairline)' }}>
```

to:

```tsx
<div className="page-toolbar flex items-center justify-between border-b border-hairline">
```

## Step 3: Verify every page still lays out

Run `npm run dev` and visit each route, checking that content is centred and nothing is edge-to-edge except the header border: `/`, `/sessions/:id` (open a session), `/sessions/:id/study`, `/quizzes`, `/quizzes/:id`, `/quizzes/:id/take`, `/attempts/:id`.

## Step 4: Commit

```bash
git add frontend/src/index.css frontend/src/pages/SessionDetailPage.tsx
git commit -m "refactor(layout): move width cap from page shell to page container"
```
