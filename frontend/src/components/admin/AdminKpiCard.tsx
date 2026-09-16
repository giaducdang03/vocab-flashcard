type AdminKpiCardProps = {
  label: string;
  value: string;
  caption: string;
};

export default function AdminKpiCard({ label, value, caption }: AdminKpiCardProps) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-card p-5">
      <p className="text-caption-uppercase uppercase text-muted">{label}</p>
      <p className="mt-3 text-headline-lg text-ink">{value}</p>
      <p className="mt-1 font-mono text-code-sm text-muted">{caption}</p>
    </div>
  );
}
