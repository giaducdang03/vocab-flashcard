import { LineChart, TrendingDown, TrendingUp } from 'lucide-react';
import type { QuizAttemptSummary } from '../../types';
import { computeTrajectory, formatDuration } from '../../utils/quizStats';

type MasteryTrajectoryProps = {
  attempts: QuizAttemptSummary[];
};

export default function MasteryTrajectory({ attempts }: MasteryTrajectoryProps) {
  const trajectory = computeTrajectory(attempts);

  // Fewer than two attempts leaves nothing to compare.
  if (!trajectory) {
    return null;
  }

  const { firstPercent, lastPercent, netGain, secondsFaster } = trajectory;
  const improving = netGain >= 0;
  const paceGained = secondsFaster !== null && secondsFaster > 0;

  return (
    <div className="flex flex-col items-start justify-between gap-space-md rounded-xl border border-hairline bg-surface-card p-space-md md:flex-row md:items-center">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <LineChart size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-title-sm text-ink">Mastery Trajectory</span>
          <span className="text-body-sm text-body">
            {paceGained ? (
              <>
                Your completion pace improved by{' '}
                <strong className="font-medium text-ink">{formatDuration(secondsFaster)}</strong>{' '}
                from your first attempt to your latest, with accuracy{' '}
                {improving ? 'increasing' : 'moving'} from {firstPercent}% to {lastPercent}%.
              </>
            ) : (
              <>
                Across {attempts.length} attempts your accuracy{' '}
                {improving ? 'increased' : 'moved'} from {firstPercent}% to {lastPercent}%.
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-stretch justify-end md:self-auto">
        <span
          className={`flex items-center gap-1 font-mono text-code-sm ${
            improving ? 'text-secondary' : 'text-error'
          }`}
        >
          {improving ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {improving ? '+' : ''}
          {netGain}% Net {improving ? 'Gain' : 'Change'}
        </span>
      </div>
    </div>
  );
}
