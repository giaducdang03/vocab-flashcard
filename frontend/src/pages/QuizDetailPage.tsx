import { useEffect, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { QuizDetail } from '../types';
import AttemptHistory from '../components/quiz/AttemptHistory';
import { QUESTION_TYPE_LABELS } from '../types';

export default function QuizDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<QuizDetail | null>(null);
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

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDetail();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">Loading quiz…</div>;
  }

  if (!detail) {
    return (
      <div className="page-shell">
        <header className="topbar">
          <div className="brand-row">
            <Link to="/quizzes" className="inline-link">
              <ArrowLeft size={16} />
              Back to quizzes
            </Link>
          </div>
        </header>

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
  const questionTypesList = quiz.question_types
    .map((type) => QUESTION_TYPE_LABELS[type])
    .join(', ');
  const sessionsList = quiz.source_session_titles.join(', ') || 'No sessions';
  const hasAttempts = attempts.length > 0;
  const buttonText = hasAttempts ? 'Retake quiz' : 'Start quiz';

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-row">
          <Link to="/quizzes" className="inline-link">
            <ArrowLeft size={16} />
            Back to quizzes
          </Link>
        </div>
      </header>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Quiz</p>
            <h1 className="display-title">{quiz.title}</h1>
            <p className="text-sm text-body mt-2">
              {quiz.question_count} questions · {questionTypesList} · from {sessionsList}
            </p>
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
