import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import type { AttemptReview } from '../types';

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
};

export default function AttemptReviewPage() {
  const { id } = useParams();
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError('Failed to load review. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchReview();
  }, [id]);

  if (loading) {
    return <div className="app-shell center-block">Loading review…</div>;
  }

  if (!review || error) {
    return (
      <div className="page-shell">
        <PageHeader />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <Link to="/quizzes" className="inline-link">
            <ArrowLeft size={16} />
            Back to quizzes
          </Link>
        </div>

        <main className="page-container">
          <div className="empty-state">
            <h3>{error ? 'Error' : 'Review not found'}</h3>
            <p>
              {error
                ? error
                : "The review you're looking for doesn't exist."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const percent = review.total_questions > 0
    ? Math.round((review.score / review.total_questions) * 100)
    : 0;
  const submittedDate = new Date(review.submitted_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="page-shell">
      <PageHeader />
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
        <Link to={`/quizzes/${review.quiz_id}`} className="inline-link">
          <ArrowLeft size={16} />
          Back to quiz
        </Link>
      </div>

      <main className="page-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">{review.quiz_title}</p>
            <h1 className="display-title">
              {review.score}/{review.total_questions} correct · {percent}%
            </h1>
            <p className="text-sm text-body mt-2">
              Finished in {formatDuration(review.duration_seconds)} · {submittedDate}
            </p>
          </div>

          <Link to={`/quizzes/${review.quiz_id}`} className="btn btn-primary">
            <RotateCcw size={16} />
            Back to quiz
          </Link>
        </section>

        <section className="section-header">
          <h2>Review ({review.questions.length})</h2>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {review.questions.map((question, index) => {
            const isCorrect = question.is_correct;
            const correctAnswer = question.options[question.correct_index];
            const selectedAnswer =
              question.selected_index !== null
                ? question.options[question.selected_index]
                : 'Not answered';

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
                    <strong>Correct answer:</strong> {correctAnswer}
                  </p>
                  <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--body)' }}>
                    <strong>Your answer:</strong>{' '}
                    <span style={{ color: isCorrect ? '#16a34a' : '#dc2626' }}>
                      {selectedAnswer}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
