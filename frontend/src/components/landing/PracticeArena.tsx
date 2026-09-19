import { useState } from 'react';
import { BadgeCheck, Check, CheckCircle2, Terminal } from 'lucide-react';

const OPTIONS = [
  { text: 'đông đúc, tắc nghẽn', correct: false },
  { text: 'về mặt tài chính', correct: true },
  { text: 'sự áp đặt, gánh nặng', correct: false },
  { text: 'tắc nghẽn giao thông', correct: false },
];

const FEATURES = [
  {
    title: 'Directional testing:',
    body: 'Toggle between English-to-Vietnamese, Vietnamese-to-English, or nuance synonym matching.',
  },
  {
    title: 'Keyboard-first speed:',
    body: 'Press keys 1, 2, 3, or 4 for instantaneous, fluid testing workflows.',
  },
  {
    title: 'Mistake-driven recycling:',
    body: 'Incorrect selections are queued back into the active review box.',
  },
];

export default function PracticeArena() {
  const [selected, setSelected] = useState<number | null>(null);
  const answeredCorrectly = selected !== null && OPTIONS[selected].correct;

  return (
    <section
      id="quizzes"
      className="w-full scroll-mt-16 border-y border-hairline bg-surface-container-low px-space-md py-20 lg:px-space-xl"
    >
      <div className="mx-auto max-w-[1120px]">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="mb-2 block text-caption-uppercase font-semibold tracking-wider text-primary">
              PRACTICE ARENA
            </span>
            <h2 className="mb-4 text-headline-lg tracking-tight text-ink">
              Zero friction, 4-option verification.
            </h2>
            <p className="mb-6 text-body-md leading-relaxed text-body">
              Test yourself with precision. Answers are verified in milliseconds, providing the phonetic
              transcription alongside contextual feedback so you learn the nuance, not just the
              translation.
            </p>
            <ul className="mb-8 space-y-3 text-body-sm text-ink">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-secondary" />
                  <span>
                    <strong>{feature.title}</strong> {feature.body}
                  </span>
                </li>
              ))}
            </ul>
            <div className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3 py-2 font-mono text-code-sm text-body">
              <Terminal size={16} className="text-muted" />
              <span>Try selecting the correct meaning in the live card →</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-[0_4px_24px_rgba(38,37,30,0.03)] sm:p-8">
              <div className="mb-6 flex items-center justify-between border-b border-hairline pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface-container px-2 py-1 text-caption-uppercase font-medium text-ink">
                    MODE: EN → VI
                  </span>
                  <span className="hidden font-mono text-code-sm text-muted sm:inline">Question 1 of 5</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-code-sm font-medium text-secondary">Score: 4/4</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-button text-muted transition-colors hover:text-ink"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-baseline">
                  <span className="text-headline-lg font-medium text-ink">financially</span>
                  <span className="font-mono text-code-phonetic text-muted">/faɪˈnæn.ʃəl.i/</span>
                  <span className="text-caption-uppercase text-muted-soft">(adv)</span>
                </div>
                <p className="text-body-sm text-body">
                  Select the most accurate Vietnamese contextual translation for this word:
                </p>
              </div>

              <div className="space-y-2.5">
                {OPTIONS.map((option, index) => {
                  const isSelected = selected === index;
                  const stateClass = isSelected
                    ? option.correct
                      ? 'border-secondary bg-learned-surface'
                      : 'border-error bg-error-container/20'
                    : 'border-hairline bg-surface-card hover:bg-canvas-soft';

                  return (
                    <button
                      key={option.text}
                      type="button"
                      onClick={() => setSelected(index)}
                      className={`group flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${stateClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface-container font-mono text-code-sm text-ink group-hover:bg-surface-container-high">
                          {index + 1}
                        </span>
                        <span className="text-body-md text-ink">{option.text}</span>
                      </div>
                      {isSelected &&
                        (option.correct ? (
                          <span className="flex items-center gap-1 text-body-sm font-medium text-secondary">
                            <Check size={16} /> Correct
                          </span>
                        ) : (
                          <span className="text-body-sm font-medium text-error">Incorrect</span>
                        ))}
                    </button>
                  );
                })}
              </div>

              {answeredCorrectly && (
                <div className="mt-4 rounded-xl border border-secondary/20 bg-learned-surface p-4">
                  <div className="mb-1 flex items-center gap-2 text-title-sm text-secondary">
                    <BadgeCheck size={18} />
                    <span>Spot on. Mastered collocation:</span>
                  </div>
                  <p className="text-body-sm text-ink">
                    “The startup became <strong>financially viable</strong> after their series A expansion.”
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
