import { Sparkles } from 'lucide-react';

type AiAccessCardProps = {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
};

export default function AiAccessCard({ enabled, disabled = false, onChange }: AiAccessCardProps) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-6">
      <p className="flex items-center gap-2 text-caption-uppercase uppercase text-muted">
        <Sparkles size={14} />
        AI Access
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-title-md text-ink">Enable AI quiz generation</h2>
          <p className="mt-1 text-body-sm text-body">
            Lets this user create quizzes with AI question types (fill in the blank, word in context).
            Turning it off does not cancel quizzes that are already being generated.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable AI quiz generation"
          disabled={disabled}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            enabled ? 'bg-success' : 'bg-hairline-strong'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </section>
  );
}
