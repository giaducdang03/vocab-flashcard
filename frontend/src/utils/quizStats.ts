import type { QuizAttemptSummary } from '../types';

/** A percentage at or above this counts as a strong score and earns the emerald tint. */
const STRONG_SCORE_THRESHOLD = 80;

export type QuizStats = {
  attemptCount: number;
  bestScore: number | null;
  bestTotal: number | null;
  bestPercent: number | null;
  averageScore: number | null;
  averagePercent: number | null;
};

export type TrajectoryInsight = {
  firstPercent: number;
  lastPercent: number;
  /** Percentage points gained from the first attempt to the latest. Can be negative. */
  netGain: number;
  /** Seconds shaved off since the first attempt. Positive means faster. Null when either attempt lacks a duration. */
  secondsFaster: number | null;
};

export const percentOf = (score: number, total: number): number =>
  total > 0 ? Math.round((score / total) * 100) : 0;

export const isStrongScore = (percent: number): boolean => percent >= STRONG_SCORE_THRESHOLD;

/** Newest attempt first. Does not mutate the input. */
export const sortNewestFirst = (attempts: QuizAttemptSummary[]): QuizAttemptSummary[] =>
  [...attempts].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
  );

export const computeQuizStats = (attempts: QuizAttemptSummary[]): QuizStats => {
  if (attempts.length === 0) {
    return {
      attemptCount: 0,
      bestScore: null,
      bestTotal: null,
      bestPercent: null,
      averageScore: null,
      averagePercent: null,
    };
  }

  const best = attempts.reduce((leader, attempt) =>
    percentOf(attempt.score, attempt.total_questions) >
    percentOf(leader.score, leader.total_questions)
      ? attempt
      : leader,
  );

  const scoreSum = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const percentSum = attempts.reduce(
    (sum, attempt) => sum + percentOf(attempt.score, attempt.total_questions),
    0,
  );

  return {
    attemptCount: attempts.length,
    bestScore: best.score,
    bestTotal: best.total_questions,
    bestPercent: percentOf(best.score, best.total_questions),
    averageScore: Math.round((scoreSum / attempts.length) * 10) / 10,
    averagePercent: Math.round(percentSum / attempts.length),
  };
};

export const computeTrajectory = (attempts: QuizAttemptSummary[]): TrajectoryInsight | null => {
  if (attempts.length < 2) {
    return null;
  }

  const ordered = sortNewestFirst(attempts);
  const latest = ordered[0];
  const first = ordered[ordered.length - 1];

  const firstPercent = percentOf(first.score, first.total_questions);
  const lastPercent = percentOf(latest.score, latest.total_questions);

  const secondsFaster =
    first.duration_seconds !== null && latest.duration_seconds !== null
      ? first.duration_seconds - latest.duration_seconds
      : null;

  return {
    firstPercent,
    lastPercent,
    netGain: lastPercent - firstPercent,
    secondsFaster,
  };
};

export const formatDuration = (seconds: number | null): string => {
  if (seconds === null) {
    return '—';
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

export const formatAttemptDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
