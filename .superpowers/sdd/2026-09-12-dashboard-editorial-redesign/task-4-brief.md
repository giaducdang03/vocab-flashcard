# Task 4: Footer

**Files:**
- Modify: `frontend/src/components/Footer.tsx`

**Interfaces:**
- Consumes: tokens from Task 1, layout shell from Task 2
- Produces: `Footer()` — no props, exports default function. Current callers in PageShell and DashboardPage need no changes.

**Design reference:** `code.html` line 3, `<footer>` element.

## Implementation

Replace the entire file with this code:

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-hairline-strong bg-canvas py-space-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-space-lg px-margin max-sm:px-space-md">
        <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-space-sm">
            <h3 className="text-title-sm text-ink">Brand</h3>
            <p className="text-body-sm text-body">
              VocabFlash is a vocabulary learning platform built for mastery.
            </p>
          </div>

          <div className="flex flex-col gap-space-sm">
            <h3 className="text-title-sm text-ink">Product</h3>
            <ul className="flex flex-col gap-space-xs">
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/sessions" className="text-body-sm text-body hover:text-ink transition-colors">
                  Sessions
                </a>
              </li>
              <li>
                <a href="/quizzes" className="text-body-sm text-body hover:text-ink transition-colors">
                  Quizzes
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-space-sm">
            <h3 className="text-title-sm text-ink">Company</h3>
            <ul className="flex flex-col gap-space-xs">
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-space-sm">
            <h3 className="text-title-sm text-ink">Legal</h3>
            <ul className="flex flex-col gap-space-xs">
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="/" className="text-body-sm text-body hover:text-ink transition-colors">
                  Cookie Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-hairline-soft pt-space-lg">
          <p className="text-caption-uppercase text-muted">
            Copyright © 2026 Duc Dang. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

## Verification

Run: `cd frontend && npm run build`
Expected: exits 0, no TypeScript errors.

In the browser: footer spans full viewport width, is centred on max-w-6xl (1152px), displays four columns on desktop, stacks on mobile (grid-cols-1). Brand copy, nav links (Product, Company, Legal), and copyright line are all visible and readable.

## Commit

```bash
git add frontend/src/components/Footer.tsx
git commit -m "feat(footer): editorial footer with brand, nav links, and copyright"
```
