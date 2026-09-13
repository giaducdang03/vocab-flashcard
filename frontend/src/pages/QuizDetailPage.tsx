import { useEffect, useState } from 'react';
import { ArrowLeft, FolderOpen, Play } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { QuizDetail } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';
import AttemptHistory from '../components/quiz/AttemptHistory';
import MasteryTrajectory from '../components/quiz/MasteryTrajectory';
import PageHeader from '../components/PageHeader';
import QuizStatCards from '../components/quiz/QuizStatCards';

const BACK_LINK_CLASS =
  'group inline-flex items-center gap-1.5 text-body-sm text-body transition-colors hover:text-ink';

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
      <div className="page-shell bg-canvas">
        <PageHeader />
        <main className="mx-auto w-full max-w-5xl px-margin py-space-xl max-sm:px-space-md">
          <Link to="/quizzes" className={BACK_LINK_CLASS}>
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Quizzes
          </Link>
          <div className="mt-space-lg grid min-h-[180px] place-items-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-canvas-soft p-space-xl text-center">
            <h3 className="text-title-md text-ink">Quiz not found</h3>
            <p className="text-body-sm text-body">The quiz you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const { quiz, attempts } = detail;
  const hasAttempts = attempts.length > 0;
  const buttonText = hasAttempts ? 'Retake quiz' : 'Start quiz';
  const uniqueTypes = Array.from(new Set(quiz.question_types));

  return (
    <div className="page-shell bg-canvas">
      <PageHeader />

      <main className="mx-auto w-full max-w-5xl px-margin py-space-xl max-sm:px-space-md">
        <Link to="/quizzes" className={BACK_LINK_CLASS}>
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
          Back to Quizzes
        </Link>

        {/* Hero */}
        <div className="mt-space-md flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col gap-space-xs">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {quiz.source_session_titles.map((title) => (
                <span
                  key={title}
                  className="inline-flex items-center gap-1.5 rounded border border-hairline bg-surface-card px-2.5 py-1 font-mono text-code-sm text-body"
                >
                  <FolderOpen size={15} className="text-muted" />
                  From session:{' '}
                  {sessions[title] ? (
                    <Link
                      to={`/sessions/${sessions[title]}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {title}
                    </Link>
                  ) : (
                    <strong className="font-medium text-ink">{title}</strong>
                  )}
                </span>
              ))}
              {uniqueTypes.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center rounded-full bg-ink px-2.5 py-1 text-caption-uppercase uppercase text-surface"
                >
                  {QUESTION_TYPE_LABELS[type]}
                </span>
              ))}
            </div>

            <h1 className="text-display-hero tracking-tight text-ink max-sm:text-headline-lg">
              {quiz.title}
            </h1>
          </div>

          <Link
            to={`/quizzes/${id}/take`}
            className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active md:self-auto"
          >
            <Play size={19} />
            {buttonText}
          </Link>
        </div>

        {/* Stat strip */}
        <div className="mt-space-lg">
          <QuizStatCards questionCount={quiz.question_count} attempts={attempts} />
        </div>

        {/* Attempt history */}
        <div className="mt-space-xl flex flex-col gap-space-sm">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-2">
              <h2 className="text-title-md text-ink">Attempt History</h2>
              <span className="inline-flex h-5 items-center justify-center rounded-full bg-hairline-soft px-2 font-mono text-[11px] text-muted">
                {attempts.length}
              </span>
            </div>
            {hasAttempts && (
              <span className="text-caption-uppercase uppercase text-muted">Sorted by newest</span>
            )}
          </div>
          <AttemptHistory attempts={attempts} />
        </div>

        {/* Insight — renders nothing below two attempts */}
        <div className="mt-space-xl">
          <MasteryTrajectory attempts={attempts} />
        </div>
      </main>
    </div>
  );
}
