import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useFormatters } from '../lib/format';
import PageHeader from '../components/PageHeader';
import type { AttemptReview } from '../types';

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
};

export default function AttemptReviewPage() {
  const { t } = useTranslation('quiz');
  const { dateTime } = useFormatters();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { id } = useParams();
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchReview = async () => {
      if (!id) {
        return;
      }

      try {
        const response = await api.get<AttemptReview>(`/attempts/${id}`);
        setReview(response.data);
      } catch (err) {
        console.error('Failed to fetch attempt review:', err);
        setError(t('review.loadError'));
      } finally {
        setLoading(false);
      }
    };

    void fetchReview();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">{t('review.loading')}</div>;
  }

  if (!review || error) {
    return (
      <div className="page-shell">
        <PageHeader user={user} onLogout={handleLogout} />

        <main className="page-container">
          <Link to="/quizzes" className="inline-link">
            <ArrowLeft size={16} />
            {t('review.backToQuizzes')}
          </Link>
          <div className="empty-state">
            <h3>{error ? t('review.errorTitle') : t('review.notFoundTitle')}</h3>
            <p>{error ? error : t('review.notFoundBody')}</p>
          </div>
        </main>
      </div>
    );
  }

  const percent = review.total_questions > 0
    ? Math.round((review.score / review.total_questions) * 100)
    : 0;
  const submittedDate = dateTime(review.submitted_at);

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <main className="page-container">
        <Link to={`/quizzes/${review.quiz_id}`} className="inline-link">
          <ArrowLeft size={16} />
          {t('review.backToQuiz')}
        </Link>
        <section className="hero-card">
          <div>
            <p className="eyebrow">{review.quiz_title}</p>
            <div className="mt-3">
              <p className="text-lg font-semibold">
                {t('review.scoreLine', {
                  score: review.score,
                  total: review.total_questions,
                  percent,
                })}
              </p>
              <div style={{ marginTop: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    height: '8px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--hairline)',
                  }}
                >
                  <div
                    style={{
                      width: `${percent}%`,
                      backgroundColor: '#10b981',
                      transition: 'width 0.3s ease',
                    }}
                  />
                  <div
                    style={{
                      width: `${100 - percent}%`,
                      backgroundColor: '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-body mt-3">
              {t('review.finishedIn', {
                duration: formatDuration(review.duration_seconds),
                date: submittedDate,
              })}
            </p>
          </div>

          <Link to={`/quizzes/${review.quiz_id}`} className="btn btn-primary">
            <RotateCcw size={16} />
            {t('review.backToQuiz')}
          </Link>
        </section>

        <section className="section-header">
          <h2>{t('review.heading', { count: review.questions.length })}</h2>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {review.questions.map((question, index) => {
            const isCorrect = question.is_correct;
            const correctAnswer = question.options[question.correct_index];
            const selectedAnswer =
              question.selected_index !== null
                ? question.options[question.selected_index]
                : t('review.notAnswered');

            return (
              <div
                key={question.id}
                className="review-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: '1px solid var(--hairline)',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: 'var(--surface-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isCorrect ? (
                    <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
                  ) : (
                    <XCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      padding: '4px 8px',
                      backgroundColor: isCorrect ? '#d1fae5' : '#fee2e2',
                      color: isCorrect ? '#065f46' : '#7f1d1d',
                      borderRadius: '4px',
                    }}
                  >
                    {question.question_type}
                  </span>
                  <strong style={{ flex: 1 }}>{question.prompt_text}</strong>
                  {question.prompt_phonetic && (
                    <span style={{ color: 'var(--muted)', fontSize: '14px' }}>
                      {question.prompt_phonetic}
                    </span>
                  )}
                </div>

                <div style={{ paddingLeft: '32px' }}>
                  <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--body)' }}>
                    <strong>{t('review.correctAnswer')}</strong> {correctAnswer}
                  </p>
                  <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--body)' }}>
                    <strong>{t('review.yourAnswer')}</strong>{' '}
                    <span style={{ color: isCorrect ? '#16a34a' : '#dc2626' }}>
                      {selectedAnswer}
                    </span>
                  </p>
                  {question.explanation && (
                    <div className="review-explanation">
                      {question.source === 'ai' && (
                        <span className="ai-corner-chip" title={t('ai.contentWarning')}>
                          <Sparkles size={12} />
                          {t('ai.badge')}
                        </span>
                      )}
                      <p>{question.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
