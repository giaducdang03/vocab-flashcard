import { useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Quiz, Session } from '../types';
import QuizCard from '../components/quiz/QuizCard';
import QuizCreateModal from '../components/quiz/QuizCreateModal';
import UserMenu from '../components/UserMenu';
import { useNavigate } from 'react-router-dom';

export default function QuizzesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes');
      setQuizzes(response.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions');
      setSessions(response.data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  useEffect(() => {
    void fetchQuizzes();
    void fetchSessions();
  }, []);

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      await api.delete(`/quizzes/${quizId}`);
      setQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
    } catch (err) {
      console.error('Failed to delete quiz:', err);
    }
  };

  const handleQuizCreated = (quiz: Quiz) => {
    setQuizzes((current) => [quiz, ...current]);
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
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </nav>
      </header>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Quiz Center</p>
            <h1 className="text-2xl font-light letter-spacing-tight">
              Challenge yourself with curated quizzes
            </h1>
          </div>
        </section>

        <section className="section-header">
          <h2>Quizzes ({quizzes.length})</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create quiz
          </button>
        </section>

        {loading ? (
          <div className="empty-state">Loading quizzes…</div>
        ) : quizzes.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={36} />
            <h3>No quizzes yet</h3>
            <p>Create your first quiz to start testing your vocabulary knowledge.</p>
          </div>
        ) : (
          <div className="session-grid">
            {quizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onOpen={() => navigate(`/quizzes/${quiz.id}`)}
                onDelete={() => handleDeleteQuiz(quiz.id)}
              />
            ))}
          </div>
        )}
      </main>

      <QuizCreateModal
        isOpen={showCreateModal}
        sessions={sessions}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleQuizCreated}
      />
    </div>
  );
}
