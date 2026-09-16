import type { RecentAiQuiz } from '../../types/admin';
import { formatDateTime } from '../../lib/adminFormat';

type RecentAiQuizzesProps = {
  quizzes: RecentAiQuiz[];
};

const STATUS_CLASS: Record<RecentAiQuiz['status'], string> = {
  ready: 'border-success/30 bg-learned-surface text-success',
  pending: 'border-hairline bg-canvas-soft text-body',
  failed: 'border-error/30 bg-white text-error',
};

export default function RecentAiQuizzes({ quizzes }: RecentAiQuizzesProps) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-6">
      <p className="text-caption-uppercase uppercase text-muted">Recent AI Activity</p>
      <h2 className="mt-1 text-title-md text-ink">Latest AI-generated quizzes</h2>

      {quizzes.length === 0 ? (
        <p className="mt-4 text-body-sm text-muted">No AI quizzes yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b border-hairline">
              <tr>
                {['Created', 'Title', 'Status', 'AI questions'].map((header) => (
                  <th key={header} className="py-2 pr-4 text-caption-uppercase uppercase text-muted">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz.id} className="border-b border-hairline-soft last:border-0">
                  <td className="py-3 pr-4 font-mono text-code-sm text-body">{formatDateTime(quiz.created_at)}</td>
                  <td className="py-3 pr-4 text-body-sm text-ink">{quiz.title}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-caption-uppercase uppercase ${STATUS_CLASS[quiz.status]}`}
                    >
                      {quiz.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-code-sm text-body">
                    {quiz.ai_question_count} / {quiz.requested_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
