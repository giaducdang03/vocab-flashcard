# Task 9: DailyLearnedChart restyle

**Files:**
- Modify: `frontend/src/components/dashboard/DailyLearnedChart.tsx`

**Interfaces:**
- Consumes: `DailyPoint[]`, `days`, `onDaysChange` — signature stays the same
- Produces: unchanged default export

**Note:** This file is complex but the actual changes are surgical: update the card chrome (title, description, toggle), swap the grid colour to match the mock, set axis fonts to JetBrains Mono, and compute the daily average.

## Implementation

### Step 1: Update card chrome and toggle (lines 55-86)

Replace the returned JSX with:

```tsx
  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-space-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-title-md text-ink">Words learned per day</h2>
          <p className="m-0 text-body-sm text-muted">Daily pace tracked across active SRS intervals</p>
        </div>

        <div className="inline-flex shrink-0 rounded-lg bg-hairline-soft p-0.5 text-body-sm">
          {[7, 30].map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded px-2.5 py-1 transition-all ${
                days === option
                  ? 'bg-surface-card font-medium text-ink'
                  : 'text-muted hover:text-ink'
              }`}
              onClick={() => onDaysChange(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="h-44">
        <Bar data={data} options={options} />
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 font-mono text-code-sm text-muted">
        <span>
          {isEmpty
            ? `No words marked as learned in the last ${days} days.`
            : 'Consistent learning improves retention by 4x.'}
        </span>
        <span>Avg: {average} words/day</span>
      </div>
    </div>
  );
```

### Step 2: Add average calculation and update chart options

After the `isEmpty` line, add:

```tsx
  const average =
    daily.length > 0
      ? (daily.reduce((sum, point) => sum + point.learned_count, 0) / daily.length).toFixed(1)
      : '0.0';
```

In the `options` object, update:
- `options.scales.y.grid.color`: change from `'#e6e5e0'` to `'#efeee8'` (hairline-soft)
- `options.scales.x.ticks.font`: set to `{ family: 'JetBrains Mono', size: 11 }`
- `options.scales.y.ticks.font`: set to `{ family: 'JetBrains Mono', size: 11 }`

Leave `backgroundColor: '#f54e00'` and `borderRadius: 4` in the `data` object exactly as they are — that is the frozen primary token.

## Verification

Run: `cd frontend && npm run build`
Expected: exits 0.

In the browser, toggling 7/30 days refetches and the average updates with it.

## Commit

```bash
git add frontend/src/components/dashboard/DailyLearnedChart.tsx
git commit -m "feat(dashboard): restyle daily chart to editorial card with mono axes"
```
