import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
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
  onValidityChange?: (valid: boolean) => void;
};

function pillClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-body-sm transition-colors ${
    active ? 'border-primary bg-primary-fixed font-semibold text-ink' : 'border-hairline text-body hover:text-ink'
  }`;
}

export default function RateLimitCard({
  usage,
  value,
  systemDefault,
  aiEnabled,
  onChange,
  onValidityChange,
}: RateLimitCardProps) {
  const [customText, setCustomText] = useState(value === null ? '' : String(value));

  useEffect(() => {
    setCustomText(value === null ? '' : String(value));
  }, [value]);

  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 100;
  const resetsIn = formatResetsIn(usage.resets_at);
  const customInvalid = customText !== '' && !isValidLimit(customText);

  useEffect(() => {
    onValidityChange?.(!customInvalid);
  }, [customInvalid, onValidityChange]);

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    if (isValidLimit(text)) onChange(Number(text));
  };

  return (
    <section className={`rounded-xl border border-hairline bg-surface-card p-6 shadow-sm ${aiEnabled ? '' : 'opacity-60'}`}>
      <div className="mb-4 flex items-center gap-2 border-b border-hairline pb-3">
        <SlidersHorizontal size={20} className="text-primary" />
        <h2 className="text-title-sm text-ink">Rate Limit</h2>
      </div>

      <div className="rounded-lg border border-hairline bg-canvas-soft p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-body-sm">
          <span className="font-medium text-ink">Daily quota status</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-code-sm font-semibold text-primary">
              {usage.used} / {usage.limit} used ({percent}%)
            </span>
            {resetsIn && (
              <>
                <span className="text-muted-soft">•</span>
                <span className="font-mono text-code-sm text-muted">{resetsIn}</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-hairline-soft">
          <div
            className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-error' : 'bg-primary'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p className="mb-2 mt-6 text-caption-uppercase uppercase text-muted">Set daily limit</p>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button key={preset} type="button" onClick={() => onChange(preset)} className={pillClass(value === preset)}>
            {preset} / day
          </button>
        ))}
        <button type="button" onClick={() => onChange(null)} className={pillClass(value === null)}>
          Use system default ({systemDefault})
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-body-sm text-muted">
          Custom
          <input
            type="number"
            min={0}
            max={MAX_AI_DAILY_LIMIT}
            inputMode="numeric"
            value={customText}
            onChange={(event) => handleCustomChange(event.target.value)}
            className="h-9 w-20 rounded-lg border border-hairline-strong bg-white px-2 text-center font-mono text-code-sm font-medium text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
      </div>
      {customInvalid && (
        <p className="mt-2 text-body-sm text-error">Enter a whole number from 0 to {MAX_AI_DAILY_LIMIT}.</p>
      )}
      <p className="mt-3 text-body-sm text-muted">A limit of 0 blocks new AI quizzes while keeping AI access on.</p>
    </section>
  );
}
