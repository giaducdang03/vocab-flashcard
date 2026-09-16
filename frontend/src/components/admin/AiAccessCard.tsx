import { Sparkles } from 'lucide-react';

type AiAccessCardProps = {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
};

export default function AiAccessCard({ enabled, disabled = false, onChange }: AiAccessCardProps) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-hairline pb-3">
        <Sparkles size={20} className="text-primary" />
        <h2 className="text-title-sm text-ink">AI Capabilities</h2>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-hairline bg-canvas-soft p-4">
        <div>
          <h3 className="text-title-sm text-ink">Enable AI quiz generation</h3>
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
