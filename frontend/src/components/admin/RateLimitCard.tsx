import { useEffect, useState } from 'react';
import type { AiUsage } from '../../types/admin';
import { formatResetsIn } from '../../lib/adminFormat';
import { MAX_AI_DAILY_LIMIT, isValidLimit } from '../../lib/adminDraft';

const PRESETS = [5, 10, 20, 50];

type RateLimitCardProps = {
  usage: AiUsage;
  value: number | null;
  systemDefault: number;
  aiEnabled: boolean;
  onChange: (value: number | null) => void;
};

function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-body-sm transition-colors ${
    active ? 'border-primary bg-primary-fixed font-semibold text-ink' : 'border-hairline text-body hover:text-ink'
  }`;
}

export default function RateLimitCard({ usage, value, systemDefault, aiEnabled, onChange }: RateLimitCardProps) {
  const [customText, setCustomText] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setCustomText(value === null ? '' : String(value));
  }, [value]);

  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 100;
  const resetsIn = formatResetsIn(usage.resets_at);
  const customInvalid = customText !== '' && !isValidLimit(customText);

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    if (isValidLimit(text)) onChange(Number(text));
  };

  return (
    <section className={`rounded-2xl border border-hairline bg-surface-card p-6 ${aiEnabled ? '' : 'opacity-60'}`}>
      <p className="text-caption-uppercase uppercase text-muted">Rate Limit</p>
      <h2 className="mt-1 text-title-md text-ink">AI quizzes per rolling 24 hours</h2>

      <div className="mt-5 rounded-xl border border-hairline-soft bg-canvas-soft p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-title-sm text-ink">
            {usage.used} / {usage.limit} used ({percent}%)
          </p>
          {resetsIn && <p className="font-mono text-code-sm text-muted">{resetsIn}</p>}
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-hairline-soft">
          <div
            className={`h-1.5 rounded-full ${percent >= 100 ? 'bg-error' : 'bg-ink'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-body-sm text-muted">Usage reflects the saved limit.</p>
      </div>

      <p className="mt-6 text-caption-uppercase uppercase text-muted">Daily limit</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => onChange(preset)} className={pillClass(value === preset)}>
            {preset} / day
          </button>
        ))}
        <label className="flex items-center gap-2 text-body-sm text-body">
          Custom
          <input
            type="number"
            min={0}
            max={MAX_AI_DAILY_LIMIT}
            inputMode="numeric"
            value={customText}
            onChange={(event) => handleCustomChange(event.target.value)}
            className="h-9 w-24 rounded-lg border border-hairline-strong bg-white px-3 font-mono text-code-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
        <button type="button" onClick={() => onChange(null)} className={pillClass(value === null)}>
          Use system default ({systemDefault})
        </button>
      </div>
      {customInvalid && (
        <p className="mt-2 text-body-sm text-error">Enter a whole number from 0 to {MAX_AI_DAILY_LIMIT}.</p>
      )}
      <p className="mt-3 text-body-sm text-muted">A limit of 0 blocks new AI quizzes while keeping AI access on.</p>
    </section>
  );
}
