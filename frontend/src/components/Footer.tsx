import { Link } from 'react-router-dom';

const LINKS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Sessions', path: '/sessions' },
  { label: 'Quizzes', path: '/quizzes' },
];

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-hairline bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-space-md px-margin py-space-xl text-body-sm text-muted max-sm:px-space-md md:flex-row">
        <div className="flex items-center gap-space-sm">
          <span className="text-title-sm text-ink">VocabFlash</span>
          <span>— Mindful vocabulary mastery.</span>
        </div>

        <nav className="flex items-center gap-space-lg text-body">
          {LINKS.map((link) => (
            <Link key={link.path} to={link.path} className="transition-colors hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
