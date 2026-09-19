const STATS = [
  {
    value: '94.2%',
    title: '30-Day Retention',
    description: 'Calculated through active recall decay testing.',
  },
  {
    value: '< 150ms',
    title: 'Zero Latency Feedback',
    description: 'Instant answer verification with IPA rendering.',
  },
  {
    value: '10,000+',
    title: 'Collocation Mappings',
    description: 'Curated specifically for academic and business mastery.',
  },
  {
    value: '0% Noise',
    title: 'Pure Editorial Focus',
    description: 'No intrusive gamified bells, badges, or distracting popups.',
  },
];

export default function StatsStrip() {
  return (
    <section className="w-full border-y border-hairline bg-canvas-soft px-space-md py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.title} className="flex flex-col space-y-1">
              <span className="text-headline-lg font-normal text-ink">{stat.value}</span>
              <span className="text-title-sm text-ink">{stat.title}</span>
              <p className="text-body-sm leading-snug text-muted">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
