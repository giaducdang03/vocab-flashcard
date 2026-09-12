import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, History, Lightbulb, Play, Plus, Search, ClipboardList } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Session } from '../types';
import StatsSection from '../components/dashboard/StatsSection';
import PageHeader from '../components/PageHeader';
import SessionCard from '../components/SessionCard';
import SessionCreateModal from '../components/SessionCreateModal';

type FilterKey = 'all' | 'in-progress' | 'mastered';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Sessions' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'mastered', label: 'Mastered' },
];

const percentOf = (session: Session) =>
  session.total_cards > 0 ? Math.round((session.learned_cards / session.total_cards) * 100) : 0;

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [streakDays, setStreakDays] = useState<number | undefined>(undefined);

  const fetchSessions = async () => {
    setLoading(true);
    const response = await api.get('/sessions');
    setSessions(response.data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchSessions();
  }, []);

  const handleCreateSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      await api.post('/sessions', { title: title.trim() });
      setTitle('');
      setShowCreateModal(false);
      await fetchSessions();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const visibleSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sessions.filter((session) => {
      if (needle && !session.title.toLowerCase().includes(needle)) return false;

      const percent = percentOf(session);
      if (filter === 'in-progress') return percent < 100;
      if (filter === 'mastered') return session.total_cards > 0 && percent >= 100;
      return true;
    });
  }, [sessions, filter, query]);

  const resumeTarget = useMemo(
    () =>
      sessions
        .filter((session) => session.total_cards > 0 && percentOf(session) < 100)
        .sort((a, b) => percentOf(b) - percentOf(a))[0],
    [sessions],
  );

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} streakDays={streakDays} />

      <main className="page-container">
        <section className="rounded-xl border border-hairline bg-surface-card p-space-lg">
          <div className="flex flex-col justify-between gap-space-lg lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-space-xs">
              <span className="text-caption-uppercase uppercase tracking-wider text-muted">
                Welcome back
              </span>
              <h1 className="m-0 text-headline-lg font-medium tracking-tight text-ink">
                Great to see you, {user?.display_name}! Let's master something new today.
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-space-sm self-start lg:self-center">
              <Link
                to="/quizzes"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface px-4 text-body-sm font-medium text-ink transition-colors hover:bg-surface-container"
              >
                <History size={18} className="text-muted" />
                Review History
              </Link>

              {resumeTarget ? (
                <Link
                  to={`/sessions/${resumeTarget.id}/study`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  <Play size={18} />
                  Continue {resumeTarget.title}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  <Plus size={18} />
                  Add session
                </button>
              )}
            </div>
          </div>
        </section>

        <StatsSection sessions={sessions} onStreakChange={setStreakDays} />

        <section className="space-y-space-md">
          <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <h2 className="m-0 text-headline-md font-semibold text-ink">Your sessions</h2>
              <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-code-sm font-medium text-muted">
                {sessions.length} total
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="relative flex items-center">
                <Search size={18} className="absolute left-3 text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter decks..."
                  aria-label="Filter sessions by title"
                  className="h-10 w-44 rounded-lg border border-hairline bg-surface-card pl-9 pr-3 text-body-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink sm:w-56"
                />
              </div>

              <Link
                to="/quizzes"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-surface-container"
              >
                <ClipboardList size={18} className="text-muted" />
                Quizzes
                <span className="rounded bg-secondary-container px-1 py-0.5 text-caption-uppercase uppercase text-on-secondary-container">
                  New
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
              >
                <Plus size={18} />
                Add session
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
                  filter === item.key
                    ? 'bg-ink text-on-primary'
                    : 'border border-hairline bg-surface-card text-body hover:bg-surface-container'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-xl border border-hairline bg-surface-card p-space-xl text-center text-body-sm text-body">
              Loading sessions…
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline-strong bg-surface-card p-space-xl text-center">
              <BookOpenText size={36} className="text-muted" />
              <h3 className="m-0 text-title-md text-ink">
                {sessions.length === 0 ? 'No sessions yet' : 'No sessions match this filter'}
              </h3>
              <p className="m-0 text-body-sm text-body">
                {sessions.length === 0
                  ? 'Create your first study set to start reviewing vocabulary.'
                  : 'Try a different filter or clear the search box.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
              {visibleSessions.map((session) => (
                <SessionCard key={session.id} session={session} onDelete={handleDeleteSession} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col items-center justify-between gap-space-md rounded-xl bg-surface-container p-space-md sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-card text-primary">
              <Lightbulb size={20} />
            </span>
            <p className="m-0 text-body-sm text-ink">
              <strong className="font-semibold">Spaced Repetition Tip:</strong> Spacing intervals by
              24h then 72h cements memory permanence twice as fast as cramming.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 font-mono text-code-sm text-muted">
            <span>Quick action:</span>
            <kbd className="rounded bg-surface-card px-2 py-0.5 text-ink">Space</kbd>
            <span>to flip</span>
            <kbd className="rounded bg-surface-card px-2 py-0.5 text-ink">←</kbd>
            <kbd className="rounded bg-surface-card px-2 py-0.5 text-ink">→</kbd>
            <span>to navigate</span>
          </div>
        </section>
      </main>

      <SessionCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={title}
        onTitleChange={setTitle}
        onSubmit={handleCreateSession}
        isCreating={creating}
      />
    </div>
  );
}
