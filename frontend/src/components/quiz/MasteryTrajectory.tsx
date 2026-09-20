import { LineChart, TrendingDown, TrendingUp } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { QuizAttemptSummary } from '../../types';
import { computeTrajectory, formatDuration } from '../../utils/quizStats';

type MasteryTrajectoryProps = {
  attempts: QuizAttemptSummary[];
};

export default function MasteryTrajectory({ attempts }: MasteryTrajectoryProps) {
  const { t } = useTranslation('quiz');
  const trajectory = computeTrajectory(attempts);

  // Fewer than two attempts leaves nothing to compare.
  if (!trajectory) {
    return null;
  }

  const { firstPercent, lastPercent, netGain, secondsFaster } = trajectory;
  const improving = netGain >= 0;
  const paceGained = secondsFaster !== null && secondsFaster > 0;
  const trend = paceGained
    ? t(improving ? 'stats.trajectory.increasing' : 'stats.trajectory.moving')
    : t(improving ? 'stats.trajectory.increased' : 'stats.trajectory.moved');

  return (
    <div className="flex flex-col items-start justify-between gap-space-md rounded-xl border border-hairline bg-surface-card p-space-md md:flex-row md:items-center">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <LineChart size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-title-sm text-ink">{t('stats.trajectory.title')}</span>
          <span className="text-body-sm text-body">
            {paceGained ? (
              <Trans
                t={t}
                i18nKey="stats.trajectory.paceImproved"
                values={{
                  duration: formatDuration(secondsFaster),
                  trend,
                  firstPercent,
                  lastPercent,
                }}
                components={{ bold: <strong className="font-medium text-ink" /> }}
              />
            ) : (
              t('stats.trajectory.acrossAttempts', {
                count: attempts.length,
                trend,
                firstPercent,
                lastPercent,
              })
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
          {t('stats.trajectory.netLine', {
            sign: improving ? '+' : '',
            value: netGain,
            label: t(improving ? 'stats.trajectory.netGain' : 'stats.trajectory.netChange'),
          })}
        </span>
      </div>
    </div>
  );
}
