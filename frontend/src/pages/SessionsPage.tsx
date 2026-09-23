import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Session } from '../types';
import PageHeader from '../components/PageHeader';
import SessionCard from '../components/SessionCard';
import SessionCreateModal from '../components/SessionCreateModal';

export default function SessionsPage() {
  const { t } = useTranslation('session');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    if (!needle) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(needle));
  }, [sessions, query]);

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <main className="page-container">
        <section className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-center">
          <div className="space-y-space-xs">
            <span className="text-caption-uppercase uppercase tracking-wider text-muted">
              {t('list.eyebrow')}
            </span>
            <h1 className="m-0 text-headline-lg font-medium tracking-tight text-ink">
              {t('list.title')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="relative flex items-center">
              <Search size={18} className="absolute left-3 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('list.searchPlaceholder')}
                aria-label={t('list.searchAriaLabel')}
                className="h-10 w-44 rounded-lg border border-hairline bg-surface-card pl-9 pr-3 text-body-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink sm:w-56"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              <Plus size={18} />
              {t('list.addSession')}
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-hairline bg-surface-card p-space-xl text-center text-body-sm text-body">
            {t('list.loading')}
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-hairline-strong bg-surface-card p-space-xl text-center">
            <BookOpenText size={36} className="text-muted" />
            <h3 className="m-0 text-title-md text-ink">
              {sessions.length === 0 ? t('list.emptyTitle') : t('list.emptyTitleFiltered')}
            </h3>
            <p className="m-0 text-body-sm text-body">
              {sessions.length === 0 ? t('list.emptyBody') : t('list.emptyBodyFiltered')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-space-sm">
            {visibleSessions.map((session) => (
              <div key={session.id}>
                {/* Below sm: the compact card layout (same as Dashboard's recent sessions).
                    The "row" variant is a table-like row meant for wider screens — stacked
                    on mobile it reads as a broken table row rather than a card. */}
                <div className="sm:hidden">
                  <SessionCard session={session} onDelete={handleDeleteSession} variant="card" />
                </div>
                <div className="hidden sm:block">
                  <SessionCard session={session} onDelete={handleDeleteSession} variant="row" />
                </div>
              </div>
            ))}
          </div>
        )}
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
