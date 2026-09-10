import { useEffect, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { QuizDetail } from '../types';
import AttemptHistory from '../components/quiz/AttemptHistory';
import PageHeader from '../components/PageHeader';
import QuestionTypeBadges from '../components/QuestionTypeBadges';

export default function QuizDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    try {
      const response = await api.get(`/quizzes/${id}`);
      setDetail(response.data);
    } catch (err) {
      console.error('Failed to fetch quiz detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions');
      const sessionMap: Record<string, string> = {};
      response.data.forEach((session: { id: string; title: string }) => {
        sessionMap[session.title] = session.id;
      });
      setSessions(sessionMap);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDetail();
    void fetchSessions();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">Loading quiz…</div>;
  }

  if (!detail) {
    return (
      <div className="page-shell">
        <PageHeader />
        <div style={{ padding: '12px 20px' }}>
          <Link to="/quizzes" className="inline-link">
            <ArrowLeft size={16} />
            Back to quizzes
          </Link>
        </div>

        <main className="page-container">
          <div className="empty-state">
            <h3>Quiz not found</h3>
            <p>The quiz you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const { quiz, attempts } = detail;
  const sessionsList = quiz.source_session_titles.join(', ') || 'No sessions';
  const hasAttempts = attempts.length > 0;
  const buttonText = hasAttempts ? 'Retake quiz' : 'Start quiz';

  return (
    <div className="page-shell">
      <PageHeader />
      <div style={{ padding: '12px 20px' }}>
        <Link to="/quizzes" className="inline-link">
          <ArrowLeft size={16} />
          Back to quizzes
        </Link>
      </div>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Quiz</p>
            <h1 className="display-title font-bold">{quiz.title}</h1>
            <div className="mt-3">
              <p className="text-xs text-body mb-2">{quiz.question_count} questions</p>
              <QuestionTypeBadges types={quiz.question_types} />
              <p className="text-xs text-body mt-3">
                from{' '}
                {quiz.source_session_titles.map((title, idx) => (
                  <span key={title}>
                    {idx > 0 && ', '}
                    {sessions[title] ? (
                      <Link to={`/sessions/${sessions[title]}`} className="inline-link">
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <Link to={`/quizzes/${id}/take`} className="btn btn-primary">
            <Play size={16} />
            {buttonText}
          </Link>
        </section>

        <section className="section-header">
          <h2>Attempt history ({attempts.length})</h2>
        </section>

        <AttemptHistory attempts={attempts} />
      </main>
    </div>
  );
}
