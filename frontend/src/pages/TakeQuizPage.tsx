import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import QuizQuestionView from '../components/quiz/QuizQuestionView';
import PageHeader from '../components/PageHeader';
import type { AnswerResult, AttemptStart } from '../types';

export default function TakeQuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptStart | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttempt = async () => {
    if (!id) {
      return;
    }

    try {
      const response = await api.post<AttemptStart>(`/quizzes/${id}/attempts`);
      setAttempt(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch attempt:', err);
      setError('Failed to start quiz. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchAttempt();
  }, [id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentIndex]);

  const handleSelect = async (optionIndex: number) => {
    if (!attempt) {
      return;
    }

    const question = attempt.questions[currentIndex];
    setSelectedIndex(optionIndex);
    setIsChecking(true);

    try {
      const response = await api.post<AnswerResult>(
        `/attempts/${attempt.attempt_id}/answers`,
        {
          question_id: question.id,
          selected_index: optionIndex,
        },
      );
      setResult(response.data);
    } catch (err) {
      console.error('Failed to save answer:', err);
      setSelectedIndex(null);
      setError('Could not save that answer.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleNext = async () => {
    if (!attempt) {
      return;
    }

    const isLast = currentIndex === attempt.questions.length - 1;

    if (!isLast) {
      setCurrentIndex(currentIndex + 1);
      setSelectedIndex(null);
      setResult(null);
    } else {
      try {
        const response = await api.post(`/attempts/${attempt.attempt_id}/submit`);
        const { attempt_id } = response.data;
        navigate(`/attempts/${attempt_id}`, { replace: true });
      } catch (err) {
        console.error('Failed to submit quiz:', err);
        setError('Failed to submit quiz. Please try again.');
      }
    }
  };

  if (loading) {
    return <div className="app-shell center-block">Loading quiz…</div>;
  }

  if (!attempt || error) {
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
            <h3>{error ? 'Error' : 'Quiz not found'}</h3>
            <p>
              {error
                ? error
                : "The quiz you're looking for doesn't exist or has no questions."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const question = attempt.questions[currentIndex];
  const isLast = currentIndex === attempt.questions.length - 1;

  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--canvas)' }}>
        <PageHeader />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <Link to={`/quizzes/${id}`} className="inline-link">
            <ArrowLeft size={16} />
            {attempt.quiz_title}
          </Link>
        </div>
      </div>

      <QuizQuestionView
        question={question}
        index={currentIndex}
        total={attempt.questions.length}
        result={result}
        isChecking={isChecking}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        onNext={handleNext}
        isLast={isLast}
      />
    </>
  );
}
