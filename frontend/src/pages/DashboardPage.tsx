import { useEffect, useState } from 'react';
import { BookOpenText, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Session } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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
      await fetchSessions();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
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
          <div className="user-pill">{user?.display_name || user?.email}</div>
        </nav>
      </header>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="display-title">Study sessions built for focus.</h1>
          </div>

          <form onSubmit={handleCreateSession} className="session-create-form">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="New session name"
            />
            <button type="submit" className="btn btn-primary" disabled={creating}>
              <Plus size={16} />
              {creating ? 'Creating...' : 'New session'}
            </button>
          </form>
        </section>

        <section className="section-header">
          <h2>Your sessions</h2>
          <p>{sessions.length} total</p>
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
            {sessions.map((session) => (
              <article key={session.id} className="session-card">
                <div className="session-card-header">
                  <span className="badge">Session</span>
                  <button type="button" className="icon-button" onClick={() => handleDeleteSession(session.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>

                <Link to={`/sessions/${session.id}`} className="session-card-title">
                  {session.title}
                </Link>

                <div className="session-meta">
                  <span>{new Date(session.created_at).toLocaleDateString()}</span>
                  <span>Updated {new Date(session.updated_at).toLocaleDateString()}</span>
                </div>

                <div className="mini-progress">
                  <div className="mini-progress-bar" style={{ width: '42%' }} />
                </div>

                <div className="session-card-actions">
                  <span>42% mastered</span>
                  <Link to={`/sessions/${session.id}`} className="btn btn-secondary small">
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
