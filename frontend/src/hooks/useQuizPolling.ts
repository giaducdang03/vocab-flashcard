import { useEffect, useRef } from 'react';

import { api } from '../api/client';
import type { Quiz, QuizStatus } from '../types';

const POLL_INTERVAL_MS = 2000;

/**
 * Poll trạng thái của các quiz đang được AI soạn.
 *
 * Tự dừng khi không còn quiz `pending` nào, nên không có timer chạy vô ích
 * trên màn hình chỉ có đề thường.
 */
export function useQuizPolling(
  quizzes: Quiz[],
  onUpdate: (id: string, status: QuizStatus) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const pendingIds = quizzes
    .filter((quiz) => quiz.status === 'pending')
    .map((quiz) => quiz.id)
    .join(',');

  useEffect(() => {
    if (!pendingIds) return;

    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        pendingIds.split(',').map(async (id) => {
          try {
            const response = await api.get<QuizStatus>(`/quizzes/${id}/status`);
            if (!cancelled) {
              onUpdateRef.current(id, response.data);
            }
          } catch {
            // Một lần poll hỏng không đáng để dừng cả vòng; lần sau thử lại.
          }
        }),
      );
    };

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingIds]);
}
