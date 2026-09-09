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
  const isEmpty = daily.every((point) => point.learned_count === 0);

  const data = {
    labels: daily.map((point) => formatLabel(point.date)),
    datasets: [
      {
        label: 'Words learned',
        data: daily.map((point) => point.learned_count),
        backgroundColor: '#f54e00',
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} ${context.parsed.y === 1 ? 'word' : 'words'}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#807d72', autoSkip: true, maxTicksLimit: days === 7 ? 7 : 6 },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#807d72', precision: 0 },
        grid: { color: '#e6e5e0' },
      },
    },
  };

  return (
    <div className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink m-0">Words learned per day</h3>

        <div className="flex items-center gap-1 bg-surface-strong rounded-xl p-1">
          {[7, 30].map((option) => (
            <button
              key={option}
              type="button"
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                days === option ? 'bg-white text-ink' : 'bg-transparent text-muted'
              }`}
              onClick={() => onDaysChange(option)}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        <Bar data={data} options={options} />
      </div>

      {isEmpty && (
        <p className="text-sm text-body m-0">
          No words marked as learned in the last {days} days.
        </p>
      )}
    </div>
  );
}
