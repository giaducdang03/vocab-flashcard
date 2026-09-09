type KpiTileProps = {
  label: string;
  value: number | string;
  suffix?: string;
};

export default function KpiTile({ label, value, suffix }: KpiTileProps) {
  return (
    <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-muted">{label}</span>
      <span className="text-3xl font-light letter-spacing-tight text-ink">
        {value}
        {suffix ? <span className="text-base text-body ml-1">{suffix}</span> : null}
      </span>
    </div>
  );
}
