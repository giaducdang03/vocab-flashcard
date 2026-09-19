import { ArrowRight } from 'lucide-react';
import { scrollToSection } from './scrollToSection';

export default function AnnouncementBar() {
  return (
    <section className="w-full border-b border-hairline bg-surface-container-low px-space-md py-2.5">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between text-body-sm">
        <div className="flex items-center gap-space-sm text-body">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-caption-uppercase text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Lexical Engine v2.4
          </span>
          <span className="hidden font-medium text-ink sm:inline">IELTS &amp; Academic Collocation Packs</span>
          <span className="hidden text-muted-soft sm:inline">·</span>
          <span className="hidden text-muted md:inline">
            Real-time phonetic IPA synthesis with dynamic zero-latency quizzes.
          </span>
        </div>
        <a
          href="#features"
          onClick={(event) => scrollToSection(event, 'features')}
          className="inline-flex shrink-0 items-center gap-1 text-button text-primary transition-colors hover:text-primary-active"
        >
          Read Colophon <ArrowRight size={15} />
        </a>
      </div>
    </section>
  );
}
