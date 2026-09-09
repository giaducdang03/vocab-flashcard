import { useEffect, useState } from 'react';
import { BookOpenText, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Session } from '../types';
import StatsSection from '../components/dashboard/StatsSection';
import UserMenu from '../components/UserMenu';
import SessionCreateModal from '../components/SessionCreateModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
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
    if (!title.trim()) {
      return;
    }

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

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark small">VF</div>
          <span>VocabFlash</span>
        </div>

        <nav className="top-actions">
          <button type="button" className="btn btn-secondary">
            <Search size={16} />
            Browse
          </button>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </nav>
      </header>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="display-title">Study sessions built for focus.</h1>
          </div>
        </section>

        <section className="section-header">
          <h2>Dashboard</h2>
        </section>

        <StatsSection sessions={sessions} />

        <section className="section-header">
          <h2>Your sessions ({sessions.length})</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Add session
          </button>
        </section>

        {loading ? (
          <div className="empty-state">Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <BookOpenText size={36} />
            <h3>No sessions yet</h3>
            <p>Create your first study set to start reviewing vocabulary.</p>
          </div>
        ) : (
          <div className="session-grid">
            {sessions.map((session) => {
              const masteredPercent = session.total_cards > 0
                ? Math.round((session.learned_cards / session.total_cards) * 100)
                : 0;

              return (
              <article key={session.id} className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center justify-center px-2 py-1 bg-orange-100/20 text-ink text-xs font-bold uppercase rounded-full">
                    Session
                  </span>
                  <button
                    type="button"
                    className="w-9 h-9 border border-hairline rounded-xl bg-white text-ink hover:border-primary hover:text-primary transition-all flex items-center justify-center"
                    onClick={() => handleDeleteSession(session.id)}
                    title="Delete session"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <Link to={`/sessions/${session.id}`} className="text-xl font-light letter-spacing-tight text-ink hover:text-primary transition-colors">
                  {session.title}
                </Link>

                <div className="flex justify-between gap-2 text-sm text-body">
                  <span>{new Date(session.created_at).toLocaleDateString()}</span>
                  <span>Updated {new Date(session.updated_at).toLocaleDateString()}</span>
                </div>

                <div className="w-full h-2 bg-hairline rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full" style={{ width: `${masteredPercent}%` }} />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-body font-semibold">
                    {session.total_cards > 0 ? `${masteredPercent}% mastered` : 'No cards yet'}
                  </span>
                  <Link to={`/sessions/${session.id}`} className="px-4 py-2 bg-white text-ink border border-hairline rounded-lg hover:border-primary font-semibold text-sm transition-all">
                    Open
                  </Link>
                </div>
              </article>
              );
            })}
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
