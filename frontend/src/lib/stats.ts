import type { DailyPoint, Session } from '../types';

/** Longest run of consecutive entries with at least one word learned. */
export function longestStreak(daily: DailyPoint[]): number {
  let best = 0;
  let run = 0;

  for (const entry of daily) {
    if (entry.learned_count > 0) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return best;
}

/** Words learned on the most recent day of the series. */
export function todayLearned(daily: DailyPoint[]): number {
  return daily.length > 0 ? daily[daily.length - 1].learned_count : 0;
}

/** Sessions that actually contain cards. */
export function activeSessionCount(sessions: Session[]): number {
  return sessions.filter((session) => session.total_cards > 0).length;
}
