import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import type { DailyPoint } from '../../types';

type DailyLearnedChartProps = {
  daily: DailyPoint[];
  days: number;
  onDaysChange: (days: number) => void;
};

function formatLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(day)}/${Number(month)}`;
}

export default function DailyLearnedChart({ daily, days, onDaysChange }: DailyLearnedChartProps) {
  const { t, i18n } = useTranslation('dashboard');
  const isEmpty = daily.every((point) => point.learned_count === 0);

  const data = useMemo(
    () => ({
      labels: daily.map((point) => formatLabel(point.date)),
      datasets: [
        {
          label: t('charts.dailyLearned.title'),
          data: daily.map((point) => point.learned_count),
          backgroundColor: '#a83300',
          borderRadius: 4,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [daily, i18n.language],
  );

  const average =
    daily.length > 0
      ? (daily.reduce((sum, point) => sum + point.learned_count, 0) / daily.length).toFixed(1)
      : '0.0';

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => t('charts.dailyLearned.tooltipWord', { count: context.parsed.y ?? 0 }),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#807d72', autoSkip: true, maxTicksLimit: days === 7 ? 7 : 6, font: { family: 'JetBrains Mono', size: 11 } },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#807d72', precision: 0, font: { family: 'JetBrains Mono', size: 11 } },
          grid: { color: '#efeee8' },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, i18n.language],
  );

  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-card p-space-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-title-md text-ink">{t('charts.dailyLearned.title')}</h2>
          <p className="m-0 text-body-sm text-muted">{t('charts.dailyLearned.subtitle')}</p>
        </div>

        <div className="inline-flex shrink-0 rounded-lg bg-hairline-soft p-0.5 text-body-sm">
          {[7, 30].map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded px-2.5 py-1 transition-all ${
                days === option
                  ? 'bg-surface-card font-medium text-ink'
                  : 'text-muted hover:text-ink'
              }`}
              onClick={() => onDaysChange(option)}
            >
              {t('charts.dailyLearned.rangeDays', { count: option })}
            </button>
          ))}
        </div>
      </div>

      <div className="h-44">
        <Bar data={data} options={options} />
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 font-mono text-code-sm text-muted">
        <span>
          {isEmpty
            ? t('charts.dailyLearned.emptyState', { count: days })
            : t('charts.dailyLearned.retentionTip')}
        </span>
        <span>{t('charts.dailyLearned.average', { value: average })}</span>
      </div>
    </div>
  );
}
