import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import type { Session } from '../../types';

const MAX_BARS = 10;

type SessionProgressChartProps = {
  sessions: Session[];
};

export default function SessionProgressChart({ sessions }: SessionProgressChartProps) {
  const withCards = sessions.filter((session) => session.total_cards > 0);

  const ranked = withCards
    .map((session) => ({
      title: session.title,
      learned: session.learned_cards,
      total: session.total_cards,
      percent: Math.round((session.learned_cards / session.total_cards) * 100),
    }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, MAX_BARS);

  if (ranked.length === 0) {
    return (
      <div className="bg-white border border-hairline rounded-2xl p-5">
        <h3 className="text-base font-semibold text-ink m-0 mb-2">Progress by session</h3>
        <p className="text-sm text-body m-0">No sessions with cards yet.</p>
      </div>
    );
  }

  const data = {
    labels: ranked.map((item) => item.title),
    datasets: [
      {
        label: 'Progress',
        data: ranked.map((item) => item.percent),
        backgroundColor: '#f54e00',
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = ranked[context.dataIndex];
            return `${item.learned}/${item.total} words (${item.percent}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: { color: '#807d72', callback: (value) => `${value}%` },
        grid: { color: '#e6e5e0' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#26251e' },
      },
    },
  };

  return (
    <div className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink m-0">Progress by session</h3>
        {withCards.length > MAX_BARS && (
          <span className="text-xs text-muted">
            {MAX_BARS} of {withCards.length} sessions
          </span>
        )}
      </div>

      <div style={{ height: `${Math.max(160, ranked.length * 36)}px` }}>
        <Bar data={data} options={options} />
      </div>

      <p className="text-xs text-muted m-0">Sorted by least complete first.</p>
    </div>
  );
}
