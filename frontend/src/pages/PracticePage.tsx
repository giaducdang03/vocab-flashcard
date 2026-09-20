import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import QuizQuestionView from '../components/quiz/QuizQuestionView';
import PracticeSummary from '../components/session/PracticeSummary';
import type {
  AnswerResult,
  PracticeAnswer,
  PracticePool,
  PracticeQuestion,
  PracticeStart,
  QuestionType,
  QuizQuestion,
} from '../types';

export default function PracticePage() {
  const { t } = useTranslation('session');
  const { id } = useParams();
  const location = useLocation();

  // Get question types from location state, default to all types
  const questionTypes = useMemo(() => {
    const types = (location.state?.questionTypes as QuestionType[] | undefined) || [
      'en_to_vi',
      'vi_to_en',
      'synonym',
    ];
    return types;
  }, [location.state?.questionTypes]);

  // Pool comes from the setup modal; a direct visit practices everything.
  const pool: PracticePool = (location.state?.pool as PracticePool | undefined) ?? 'all';

  const [deck, setDeck] = useState<PracticeStart | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDeck = async () => {
    if (!id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.post<PracticeStart>(`/sessions/${id}/practice`, {
        question_types: questionTypes,
        pool,
      });
      setDeck(response.data);
      setCurrentIndex(0);
      setSelectedIndex(null);
      setAnswers([]);
      setFinished(false);
    } catch (err) {
      console.error('Failed to fetch practice deck:', err);
      setError(t('practice.fetchError'));
      setDeck(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDeck();
  }, [id, questionTypes, pool]);

  const handleSelect = (optionIndex: number) => {
    if (!deck || finished) {
      return;
    }

    const question = deck.questions[currentIndex];

    // Prevent answering the same question twice
    const currentAnswer = answers.find((a) => a.question.card_id === question.card_id);
    if (currentAnswer) {
      return;
    }

    const isCorrect = optionIndex === question.correct_index;

    setSelectedIndex(optionIndex);

    // Create answer record
    const answer: PracticeAnswer = {
      question,
      selected_index: optionIndex,
      is_correct: isCorrect,
    };

    // Store answer
    setAnswers([...answers, answer]);
  };

  const handleNext = () => {
    if (!deck || finished) {
      return;
    }

    const isLast = currentIndex === deck.questions.length - 1;

    if (!isLast) {
      setCurrentIndex(currentIndex + 1);
      setSelectedIndex(null);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    void fetchDeck();
  };

  if (loading) {
    return <div className="app-shell center-block">{t('practice.building')}</div>;
  }

  // A narrowed pool can legitimately produce fewer than four questions; only
  // an empty deck is unusable.
  if (!deck || error || deck.questions.length === 0) {
    return (
      <div className="page-shell">
        <PageHeader />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <Link to={`/sessions/${id}`} className="inline-link">
            <ArrowLeft size={16} />
            {t('practice.backToSession')}
          </Link>
        </div>

        <main className="page-container">
          <div className="empty-state">
            <h3>{error ? t('practice.error') : t('practice.unavailable')}</h3>
            <p>
              {error ? error : t('practice.unavailableBody')}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (finished) {
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    return (
      <div className="page-shell">
        <PageHeader />
        <PracticeSummary
          answers={answers}
          durationSeconds={durationSeconds}
          sessionId={id!}
          sessionTitle={deck.session_title}
          pool={deck.pool}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  const question = deck.questions[currentIndex];
  const isLast = currentIndex === deck.questions.length - 1;

  // Map PracticeQuestion to QuizQuestion
  const quizQuestion: QuizQuestion = {
    id: question.card_id,
    question_type: question.question_type,
    prompt_text: question.prompt_text,
    prompt_phonetic: question.prompt_phonetic,
    options: question.options,
    position: question.position,
  };

  // Get result for this question if already answered
  const currentAnswer = answers.find((a) => a.question.card_id === question.card_id);
  const result: AnswerResult | null = currentAnswer
    ? {
        is_correct: currentAnswer.is_correct,
        correct_index: question.correct_index,
      }
    : null;

  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--canvas)' }}>
        <PageHeader />
        <div>
          <div className="page-toolbar">
            <Link to={`/sessions/${id}`} className="inline-link quiz-breadcrumb">
              <span className="breadcrumb-exit">
                <ArrowLeft size={16} />
                {t('practice.exit')}
              </span>
              <span className="breadcrumb-sep">|</span>
              <span className="breadcrumb-title">{deck.session_title}</span>
            </Link>
          </div>
        </div>
      </div>

      <QuizQuestionView
        question={quizQuestion}
        index={currentIndex}
        total={deck.questions.length}
        result={result}
        isChecking={false}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        onNext={handleNext}
        isLast={isLast}
      />
    </>
  );
}
