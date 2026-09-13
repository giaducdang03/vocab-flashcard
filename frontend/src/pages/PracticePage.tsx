import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import QuizQuestionView from '../components/quiz/QuizQuestionView';
import PracticeSummary from '../components/session/PracticeSummary';
import type {
  AnswerResult,
  PracticeAnswer,
  PracticeQuestion,
  PracticeStart,
  QuestionType,
  QuizQuestion,
} from '../types';

export default function PracticePage() {
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
      });
      setDeck(response.data);
      setCurrentIndex(0);
      setSelectedIndex(null);
      setAnswers([]);
      setFinished(false);
    } catch (err) {
      console.error('Failed to fetch practice deck:', err);
      setError('Failed to load practice deck. Please try again.');
      setDeck(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    void fetchDeck();
  }, [id, questionTypes]);

  const handleSelect = (optionIndex: number) => {
    if (!deck || finished) {
      return;
    }

    const question = deck.questions[currentIndex];
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
    return <div className="app-shell center-block">Building practice set…</div>;
  }

  if (!deck || error || deck.questions.length < 4) {
    return (
      <div className="page-shell">
        <PageHeader />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <Link to={`/sessions/${id}`} className="inline-link">
            <ArrowLeft size={16} />
            Back to session
          </Link>
        </div>

        <main className="page-container">
          <div className="empty-state">
            <h3>{error ? 'Error' : 'Practice unavailable'}</h3>
            <p>
              {error
                ? error
                : "We couldn't generate practice questions for this session. Please try again later."}
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
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
          <Link to={`/sessions/${id}`} className="inline-link">
            <ArrowLeft size={16} />
            {deck.session_title}
          </Link>
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
