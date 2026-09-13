# Task 1: Design tokens and fonts

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css:5-23`

**Interfaces:**
- Produces:
  - **Already available, unchanged:** `bg-canvas`, `bg-surface-card`, `border-hairline`, `text-ink`, `text-body`, `text-muted`, `text-primary`, `bg-primary`, `hover:bg-primary-active`, `text-on-primary`, `text-error`.
  - **Newly added colour classes:** `text-secondary` / `bg-secondary`, `bg-secondary-container`, `text-on-secondary-container`, `text-tertiary`, `bg-surface`, `bg-surface-container`, `bg-canvas-soft`, `bg-hairline-soft`, `border-hairline-strong`.
  - **Newly added type classes:** `text-display-hero`, `text-headline-lg`, `text-headline-md`, `text-title-md`, `text-title-sm`, `text-body-md`, `text-body-sm`, `text-caption-uppercase`, `text-code-sm`, `text-code-phonetic`, plus `font-sans` (Inter) / `font-mono` (JetBrains Mono).
  - **Newly added spacing classes:** `gutter`, `margin`, `space-xs`, `space-sm`, `space-md`, `space-lg`, `space-xl` (usable as `gap-gutter`, `px-margin`, `p-space-md`, …).

## Step 1: Append nine colour tokens in `frontend/tailwind.config.js`

Leave every existing entry in the `colors` object exactly as it is (`primary: '#f54e00'` included). Add these nine lines inside the same `colors` object — these are the tokens later tasks reference that do not exist yet:

```js
  secondary: '#006c4c',
  'secondary-container': '#91f3c7',
  'on-secondary-container': '#007150',
  tertiary: '#5e5c56',
  surface: '#fef9ee',
  'surface-container': '#f2eee2',
  'canvas-soft': '#fafaf7',
  'hairline-soft': '#efeee8',
  'hairline-strong': '#cfcdc4',
```

Nothing else in `colors` changes. After editing, `git diff frontend/tailwind.config.js` must show nine added lines and zero modified lines in the `colors` block — if it shows a modification, you changed a frozen token and must revert it.

## Step 2: Add `fontSize`, `fontFamily`, `spacing`, `borderRadius` to the same `extend` block

Insert alongside `colors`, before the existing `keyframes`:

```js
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
},
fontSize: {
  'display-hero': ['48px', { lineHeight: '54px', letterSpacing: '-0.03em', fontWeight: '400' }],
  'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.015em', fontWeight: '400' }],
  'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '500' }],
  'title-md': ['18px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
  'title-sm': ['15px', { lineHeight: '22px', fontWeight: '600' }],
  'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
  'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
  'caption-uppercase': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
  'code-phonetic': ['14px', { lineHeight: '20px', fontWeight: '400' }],
  'code-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
},
spacing: {
  gutter: '1.25rem',
  margin: '2rem',
  'space-xs': '0.25rem',
  'space-sm': '0.5rem',
  'space-md': '1rem',
  'space-lg': '1.5rem',
  'space-xl': '2rem',
},
```

## Step 3: Add font links to `frontend/index.html`

Inside `<head>`, after the `theme-color` meta:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

Then change `<body class="bg-slate-100">` to `<body>` — that class is a leftover that fights the canvas background.

## Step 4: Add the missing CSS variables in `frontend/src/index.css`

Leave `--primary: #f54e00;` and every other existing variable untouched. Add these three lines to the `:root` block — `.empty-state:368` already references `--hairline-strong`, which is currently undefined, so this also fixes a live bug:

```css
  --hairline-soft: #efeee8;
  --hairline-strong: #cfcdc4;
  --secondary: #006c4c;
```

In the `body` rule, change the font stack to:

```css
  font-family: 'Inter', system-ui, sans-serif;
```

## Step 5: Verify the build and the font load

Run: `cd frontend && npm run build`
Expected: exits 0, no TS errors.

Then `npm run dev`, open the app, and confirm in DevTools that body computed `font-family` resolves to Inter and the page background is `#f7f7f4` (not slate).

## Step 6: Commit

```bash
git add frontend/tailwind.config.js frontend/index.html frontend/src/index.css
git commit -m "feat(design): add Editorial Focus tokens, Inter and JetBrains Mono"
```
