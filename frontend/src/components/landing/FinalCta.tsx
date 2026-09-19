import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function FinalCta() {
  return (
    <section id="pricing" className="w-full scroll-mt-16 px-space-md py-20 md:py-24 lg:px-space-xl">
      <div className="mx-auto max-w-[1120px]">
        <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-hairline bg-surface-card p-8 text-center shadow-[0_8px_30px_rgba(38,37,30,0.03)] md:p-14">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <span className="relative mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-caption-uppercase text-body">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            GET STARTED IN SECONDS
          </span>
          <h2 className="relative mb-4 max-w-2xl text-headline-lg tracking-tight text-ink md:text-display-hero">
            Ready to transform your English vocabulary?
          </h2>
          <p className="relative mb-8 max-w-xl text-body-md leading-relaxed text-body">
            Create your first personalized study session in under 30 seconds. No bloated setup, no
            distracting ads.
          </p>
          <div className="relative mb-4 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-button text-on-primary shadow-sm transition-colors hover:bg-primary-active"
            >
              <span>Get started for free</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="flex h-12 items-center justify-center rounded-lg border border-hairline bg-surface-card px-6 text-button text-ink transition-colors hover:bg-surface-container"
            >
              Browse Academic Decks
            </Link>
          </div>
          <p className="relative font-mono text-code-sm text-muted">
            Free tier includes unlimited custom flashcard decks and 50 AI enrichment requests/day.
          </p>
        </div>
      </div>
    </section>
  );
}
