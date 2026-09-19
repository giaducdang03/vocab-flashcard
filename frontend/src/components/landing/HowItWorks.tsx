import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  title: string;
  description: string;
  detail: ReactNode;
}

const STEPS: Step[] = [
  {
    label: 'STEP 01',
    title: 'Capture & Import',
    description:
      'Drag and drop your spreadsheet or input words directly. VocabFlash automatically supplements missing IPA phonetics, parts of speech, and nuance synonyms via lexical intelligence.',
    detail: (
      <>
        <div className="flex items-center gap-1 font-semibold text-ink">
          <Check size={14} className="text-secondary" /> CSV Parsed: 120 rows
        </div>
        <div className="truncate text-body-sm text-muted-soft">
          Column mapping: [Word, Part of Speech, Context, Meaning]
        </div>
      </>
    ),
  },
  {
    label: 'STEP 02',
    title: 'Spaced Card Review',
    description:
      'Enter distraction-free study mode. Utilize keyboard shortcuts to flip, pronounce, and rate difficulty. Leitner intervals automatically space upcoming reviews to peak retention curves.',
    detail: (
      <>
        <div className="flex items-center justify-between font-semibold text-ink">
          <span>Shortcuts Active</span>
          <span className="text-secondary">Ready</span>
        </div>
        <div className="text-body-sm text-muted-soft">Space = Flip · 1 = Again · 2 = Hard · 3 = Good</div>
      </>
    ),
  },
  {
    label: 'STEP 03',
    title: 'Challenge & Verify',
    description:
      'End each review block with a calibrated quiz session. Snapshot your historical velocity and witness active vocabulary transition into permanent natural intuition.',
    detail: (
      <>
        <div className="flex items-center justify-between font-semibold text-ink">
          <span>Deck Mastery</span>
          <span className="font-bold text-secondary">88.4%</span>
        </div>
        <div className="text-body-sm text-muted-soft">42 Mastered · 4 In Review · 0 New</div>
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="method" className="w-full scroll-mt-16 px-space-md py-20 md:py-28 lg:px-space-xl">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="mb-2 block text-caption-uppercase font-semibold tracking-wider text-primary">
              THREE-STEP DISCIPLINE
            </span>
            <h2 className="text-headline-lg tracking-tight text-ink">
              How serious learners study with VocabFlash.
            </h2>
          </div>
          <p className="max-w-md text-body-sm text-body">
            A seamless flow designed to minimize friction between discovering a new academic word and
            locking it into long-term recall.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.label} className="flex flex-col space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded bg-primary-fixed/40 px-2 py-1 font-mono text-code-sm font-bold text-primary">
                  {step.label}
                </span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <h3 className="text-title-md text-ink">{step.title}</h3>
              <p className="text-body-sm leading-relaxed text-body">{step.description}</p>
              <div className="space-y-1.5 rounded-xl border border-hairline bg-surface-card p-4 font-mono text-[12px] text-muted">
                {step.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
