import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import LandingHeader from '../components/landing/LandingHeader';
import Footer from '../components/Footer';
import { loadChangelog, type ChangelogData } from '../lib/changelog';
import { Sparkles, TrendingUp, Wrench, AlertCircle } from 'lucide-react';

const iconMap = {
  Sparkles,
  TrendingUp,
  Wrench,
  AlertCircle,
} as Record<string, typeof Sparkles>;

export default function ChangelogPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ChangelogData | null>(null);
  const [activeId, setActiveId] = useState<string>('v2-0-0');

  useEffect(() => {
    loadChangelog().then(setData);
  }, []);

  if (!data) {
    return <div className="app-shell center-block">Loading…</div>;
  }

  const Header = user ? PageHeader : LandingHeader;

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Header />
      <main className="flex-1 w-full pt-16">
        <div className="mx-auto max-w-[1120px] px-space-md py-space-xl lg:px-space-xl">
          <div className="mb-space-xl">
            <h1 className="text-display-hero font-normal tracking-tight text-ink mb-space-sm">
              Có gì mới ở VocabFlash
            </h1>
            <p className="text-body-md text-body leading-relaxed">
              Tổng hợp những thay đổi qua từng bản cập nhật, mới nhất ở trên cùng.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
            {/* Timeline */}
            <div className="lg:col-span-8 space-y-space-xl">
              {data.versions.map((v) => (
                <VersionCard key={v.version} version={v} active={activeId === `v${v.version}`} />
              ))}

              {/* Roadmap */}
              <div className="rounded-xl border border-hairline bg-surface-card p-space-lg">
                <div className="flex items-center gap-2 mb-space-md">
                  <AlertCircle className="text-primary" size={24} />
                  <h2 className="text-headline-lg text-ink">Sắp có trên VocabFlash</h2>
                </div>
                <p className="text-body-md text-body whitespace-pre-line">{data.roadmap}</p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block lg:col-span-4">
              <div className="sticky top-20 space-y-2">
                {data.versions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => setActiveId(`v${v.version}`)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeId === `v${v.version}`
                        ? 'bg-primary-fixed text-primary'
                        : 'hover:bg-canvas-soft text-body'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm font-medium">{v.version} — {v.title}</span>
                      <span className="text-code-sm text-muted">{v.date.slice(0, 5)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function VersionCard({ version, active }: { version: any; active: boolean }) {
  const Icon = iconMap[version.icon] || Sparkles;

  return (
    <div id={`v${version.version}`} className="rounded-xl border border-hairline bg-surface-card p-space-lg">
      <div className="flex items-start justify-between mb-space-md">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary text-on-primary px-2.5 py-1 font-mono text-code-sm font-medium">
            {version.version}
          </span>
          {version.label && (
            <span className="rounded bg-surface-container px-2.5 py-1 text-caption-uppercase text-ink font-semibold text-[11px]">
              {version.label}
            </span>
          )}
        </div>
        <span className="text-code-sm text-muted">{version.date}</span>
      </div>
      <h3 className="text-headline-lg text-ink mb-space-md">{version.title}</h3>
      <div className="prose prose-sm text-body-sm text-body">
        <Markdown content={version.content} />
      </div>
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-2">
      {content.split('\n\n').map((block, i) => {
        if (block.startsWith('**') && block.endsWith('**')) {
          return (
            <h4 key={i} className="font-semibold text-body-md text-ink mt-space-md">
              {block.replace(/\*\*/g, '')}
            </h4>
          );
        }
        if (block.startsWith('- ')) {
          return (
            <ul key={i} className="space-y-1 pl-4">
              {block.split('\n').map((line, j) => (
                <li key={j} className="list-disc list-outside">
                  {line.replace(/^- /, '')}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="leading-relaxed">{block}</p>;
      })}
    </div>
  );
}
