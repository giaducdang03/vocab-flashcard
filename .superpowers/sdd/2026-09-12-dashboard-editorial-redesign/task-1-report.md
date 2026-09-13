# Task 1: Design tokens and fonts — Report

## 1. What was done

### Files modified
1. **frontend/tailwind.config.js** — Extended the Tailwind configuration with:
   - 9 new colour tokens added to the `colors` object (all existing tokens preserved unchanged):
     - `secondary: '#006c4c'`
     - `secondary-container: '#91f3c7'`
     - `on-secondary-container: '#007150'`
     - `tertiary: '#5e5c56'`
     - `surface: '#fef9ee'`
     - `surface-container: '#f2eee2'`
     - `canvas-soft: '#fafaf7'`
     - `hairline-soft: '#efeee8'`
     - `hairline-strong: '#cfcdc4'`
   - `fontFamily` configuration for `sans` (Inter) and `mono` (JetBrains Mono)
   - `fontSize` configuration for 10 type scales:
     - Display: `display-hero` (48px)
     - Headlines: `headline-lg` (32px), `headline-md` (22px)
     - Titles: `title-md` (18px), `title-sm` (15px)
     - Body: `body-md` (16px), `body-sm` (14px)
     - Caption: `caption-uppercase` (11px)
     - Code: `code-phonetic` (14px), `code-sm` (12px)
   - `spacing` configuration for 7 spacing scales:
     - `gutter: 1.25rem`, `margin: 2rem`, `space-xs: 0.25rem`, `space-sm: 0.5rem`, `space-md: 1rem`, `space-lg: 1.5rem`, `space-xl: 2rem`

2. **frontend/index.html** — Updated to:
   - Add Google Fonts preconnect links for `fonts.googleapis.com` and `fonts.gstatic.com`
   - Add font import link for Inter (weights 400, 500, 600) and JetBrains Mono (weights 400, 500)
   - Changed `<body class="bg-slate-100">` to `<body>` (removed conflicting Tailwind class)

3. **frontend/src/index.css** — Updated CSS variables and font stack:
   - Added 3 new CSS variables to `:root`:
     - `--hairline-soft: #efeee8`
     - `--hairline-strong: #cfcdc4`
     - `--secondary: #006c4c`
   - Changed body `font-family` from `'Segoe UI', system-ui, sans-serif` to `'Inter', system-ui, sans-serif`
   - This also fixes a live bug in `.empty-state:368` which referenced `--hairline-strong` (now defined)

## 2. Verification

### Build verification
```
cd frontend && npm run build
```
**Result**: ✓ Build succeeded with exit code 0

Output summary:
```
vite v5.4.21 building for production...
transforming...
✓ 1657 modules transformed.
rendering chunks...
computing gzip size...
✓ built in 13.44s
```

- TypeScript compilation: ✓ No errors
- Tailwind CSS generation: ✓ All new colour tokens compiled (verified: `#006c4c`, `#91f3c7`, `#efeee8`, `#cfcdc4` present in dist/assets/index-*.css)
- Font imports: ✓ Google Fonts links properly injected in HTML head

### Runtime verification
- Dev server started successfully on port 5175
- HTML source inspection confirms:
  - Font preconnect links present: `<link rel="preconnect" href="https://fonts.googleapis.com" />`
  - Font import link present: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />`
  - Body tag has no class attribute (bg-slate-100 removed)
  - Body font-family correctly set to `'Inter', system-ui, sans-serif`
  - Body background: `var(--canvas)` which resolves to `#f7f7f4`

### CSS inspection in source
- `frontend/src/index.css` body rule confirmed:
  ```css
  body {
    margin: 0;
    min-height: 100vh;
    background: var(--canvas);
    color: var(--ink);
    font-family: 'Inter', system-ui, sans-serif;
  }
  ```

## 3. Commits

**Commit created:**
- SHA: `8f29e0d`
- Message: `feat(design): add Editorial Focus tokens, Inter and JetBrains Mono`
- Co-authored: Claude Haiku 4.5
- Files changed: 3
  - `frontend/index.html`: 5 insertions, 1 deletion
  - `frontend/src/index.css`: 5 insertions, 1 deletion
  - `frontend/tailwind.config.js`: 34 insertions
- Total: 42 insertions, 2 deletions

### Constraint compliance
- ✓ Existing colour tokens frozen: No modifications to `primary`, `primary-active`, `primary-light`, `ink`, `body`, `muted`, `hairline`, `canvas`, `surface-card`, `surface-strong`, `on-primary`, `success`, `error`
- ✓ All 9 new tokens added without modifying existing ones
- ✓ Fonts: Inter (system UI) and JetBrains Mono (code) imported correctly
- ✓ Font weights: Inter (400, 500, 600), JetBrains Mono (400, 500)
- ✓ Build exits with code 0 (no TypeScript errors)

