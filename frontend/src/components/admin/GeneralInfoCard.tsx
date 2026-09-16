import { IdCard } from 'lucide-react';

type StatItem = {
  label: string;
  value: string;
  caption: string;
  tone?: 'muted' | 'success';
};

type GeneralInfoCardProps = {
  displayName: string;
  email: string;
  stats: StatItem[];
};

export default function GeneralInfoCard({ displayName, email, stats }: GeneralInfoCardProps) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-hairline pb-3">
        <IdCard size={20} className="text-muted" />
        <h2 className="text-title-sm text-ink">General Information</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-caption-uppercase uppercase tracking-wider text-muted">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            readOnly
            className="h-10 w-full cursor-not-allowed rounded-lg border border-hairline-strong bg-canvas-soft px-3 text-body-sm text-ink"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-caption-uppercase uppercase tracking-wider text-muted">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="h-10 w-full cursor-not-allowed rounded-lg border border-hairline-strong bg-canvas-soft px-3 text-body-sm text-ink"
          />
        </div>
      </div>

      <div className="mt-6 border-t border-hairline pt-4">
        <p className="mb-3 text-caption-uppercase uppercase tracking-wider text-muted">Core Platform Activity</p>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-hairline bg-canvas-soft p-3">
              <span className="block text-caption-uppercase text-muted">{stat.label}</span>
              <span className="mt-0.5 block text-title-md text-ink">{stat.value}</span>
              <span className={`font-mono text-code-sm ${stat.tone === 'success' ? 'text-secondary' : 'text-muted'}`}>
                {stat.caption}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
