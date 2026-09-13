# Task 1 Review Request

## Task Summary
Design tokens and fonts — add 9 new colour tokens, type scales, spacing scales, and font imports (Inter + JetBrains Mono) to Tailwind and CSS without modifying any existing frozen tokens.

## Brief
See: `.superpowers/sdd/2026-09-12-dashboard-editorial-redesign/task-1-brief.md`

## Implementer Report
See: `.superpowers/sdd/2026-09-12-dashboard-editorial-redesign/task-1-report.md`

## Diff Package
See: `.superpowers/sdd/2026-09-12-dashboard-editorial-redesign/task-1-review-package.diff`

## Global Constraints (from plan)
- **Existing colour tokens are frozen.** Do not change a single existing value. `primary` stays `#f54e00`, `primary-active` stays `#d04200`, and every other token already in `tailwind.config.js` / `index.css` keeps its current value.
- **Fonts:** Inter for all UI text; JetBrains Mono for counters, percentages, dates, keyboard hints.
- **Max content width: `max-w-6xl` (1152px)**.
- **No drop shadows beyond `shadow-sm`.** Depth comes from surfaces and hairlines.
- **Build verification:** `npm run build` (which runs `tsc -b`) must exit 0.

## Review Checklist

**Spec Compliance:**
- [ ] All 9 new colour tokens present and correct (secondary, tertiary, surface, surface-container, canvas-soft, hairline-soft, hairline-strong, on-secondary-container)
- [ ] All 10 type scales defined (display-hero, headline-lg, headline-md, title-md, title-sm, body-md, body-sm, caption-uppercase, code-phonetic, code-sm) with exact line-heights and letter-spacing
- [ ] All 7 spacing scales defined (gutter, margin, space-xs, space-sm, space-md, space-lg, space-xl)
- [ ] fontFamily for Inter and JetBrains Mono configured
- [ ] Google Fonts links added to index.html (preconnect + import for Inter 400/500/600 and JetBrains Mono 400/500)
- [ ] No existing colour tokens modified (frozen constraint respected)
- [ ] `body { font-family: 'Inter', system-ui, sans-serif; }` set in index.css
- [ ] `<body class="bg-slate-100">` changed to `<body>` (removed leftover class)

**Quality:**
- [ ] Code is clean, no syntax errors
- [ ] Commit message is clear and follows the project convention
- [ ] Build verifies successfully (`npm run build` exit 0)
- [ ] Fonts and background colour verified in running app

**Known deviations (acceptable):**
- Primary colour stays `#f54e00` (frozen); design spec contradicts itself on this, plan resolves to keep existing value

