import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import LandingHeader from '../components/landing/LandingHeader';
import ChangelogSidebar, { versionAnchor } from '../components/changelog/ChangelogSidebar';
import Markdown from '../components/changelog/Markdown';
import { loadChangelog, type ChangelogData, type ChangelogVersion } from '../lib/changelog';
import { AlertCircle } from 'lucide-react';

export default function ChangelogPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ChangelogData | null>(null);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    loadChangelog().then((result) => {
      setData(result);
      setActiveId(result.versions[0] ? versionAnchor(result.versions[0].version) : '');
    });
  }, []);

  if (!data) {
    return <div className="app-shell center-block">Loading…</div>;
  }

  return (
    <div className="bg-surface">
      {user ? <PageHeader user={user} onLogout={logout} /> : <LandingHeader />}
      {/* LandingHeader is fixed, PageHeader is sticky (in flow) */}
      <main className={`w-full ${user ? '' : 'pt-16'}`}>
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
                <VersionCard key={v.version} version={v} />
              ))}

              {/* Roadmap */}
              <div id="roadmap" className="scroll-mt-24 rounded-xl border border-hairline bg-surface-card p-space-lg">
                <div className="flex items-center gap-2 mb-space-md">
                  <AlertCircle className="text-primary" size={24} />
                  <h2 className="text-headline-lg text-ink">Sắp có trên VocabFlash</h2>
                </div>
                <Markdown content={data.roadmap.replace(/^## .*$/m, '')} />
              </div>
            </div>

            <ChangelogSidebar versions={data.versions} activeId={activeId} onSelect={setActiveId} />
          </div>
        </div>
      </main>
    </div>
  );
}

function VersionCard({ version }: { version: ChangelogVersion }) {
  return (
    <div
      id={versionAnchor(version.version)}
      className="scroll-mt-24 rounded-xl border border-hairline bg-surface-card p-space-lg"
    >
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
      <Markdown content={version.content} />
    </div>
  );
}
