import type { QuizAttemptSummary } from '../../types';

type AttemptHistoryProps = {
  attempts: QuizAttemptSummary[];
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AttemptHistory({ attempts }: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return (
      <div className="empty-state sofa">
        <h3>No attempts yet</h3>
        <p>Start your first quiz attempt to see your attempt history.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline">
            <th className="text-left py-3 px-4 text-sm font-semibold text-body">Date</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-body">Score</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-body">Percent</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-body">Duration</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-body">Action</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => {
            const percent = Math.round((attempt.score / attempt.total_questions) * 100);
            return (
              <tr key={attempt.id} className="border-b border-hairline hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-sm text-ink">{formatDate(attempt.submitted_at)}</td>
                <td className="py-3 px-4 text-sm text-ink">
                  {attempt.score}/{attempt.total_questions}
                </td>
                <td className="py-3 px-4 text-sm text-ink">{percent}%</td>
                <td className="py-3 px-4 text-sm text-ink">{formatDuration(attempt.duration_seconds)}</td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    className="text-xs px-3 py-1 bg-primary text-white rounded border border-primary hover:bg-primary-dark transition-colors"
                  >
                    Review
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
