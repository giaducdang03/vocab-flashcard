export interface ChangelogVersion {
  version: string;
  date: string;
  title: string;
  shortTitle: string;
  label?: string;
  content: string;
}

export interface ChangelogData {
  versions: ChangelogVersion[];
  roadmap: string;
}

// Nhãn mặc định khi file không có dòng "Nhãn:"; bản tiền phát hành (0.x) không có nhãn.
const defaultLabel = (version: string): string | undefined => {
  const [major, minor, patch] = version.split('.').map(Number);
  if (major < 1) return undefined;
  if (minor === 0 && patch === 0) return 'LỚN';
  return patch === 0 ? 'TÍNH NĂNG MỚI' : 'SỬA LỖI & CẢI TIẾN';
};

const parseVersion = (
  text: string,
): { version: string; date: string; title: string; shortTitle: string; label?: string; content: string } => {
  const verMatch = text.match(/## Phiên bản ([\d.]+) — (\d{2}\/\d{2}\/\d{4})/);
  if (!verMatch) throw new Error('Invalid version format');

  const [, version, date] = verMatch;
  const titleMatch = text.match(/### (.+)/);
  if (!titleMatch) throw new Error('Invalid title format');

  const title = titleMatch[1];
  const labelMatch = text.match(/Nhãn: (.+)/);
  const label = labelMatch?.[1] || defaultLabel(version);
  const shortTitle = text.match(/Tên ngắn: (.+)/)?.[1] || title;

  const content = text
    .substring(text.indexOf('###') + titleMatch[0].length)
    .replace(/^(Nhãn|Tên ngắn): .*$/gm, '')
    .trim();

  return { version, date, title, shortTitle, label, content };
};

export async function loadChangelog(): Promise<ChangelogData> {
  return readChangelog();
}

export function getLatestVersion(): ChangelogVersion | undefined {
  return readChangelog().versions[0];
}

function readChangelog(): ChangelogData {
  const files = import.meta.glob('../content/changelog/*.md', { query: '?raw', eager: true });
  let roadmap = '';

  const semverSort = (a: string, b: string) => {
    const aparts = a.split('.').map(Number);
    const bparts = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (aparts[i] !== bparts[i]) return bparts[i] - aparts[i];
    }
    return 0;
  };

  const entries = Object.entries(files).map(([path, mod]: [string, any]) => ({
    filename: path.split('/').pop()!.replace('.md', ''),
    content: (mod.default ?? mod) as string,
  }));

  for (const { filename, content } of entries) {
    if (filename === 'roadmap') roadmap = content;
  }

  const versions: ChangelogVersion[] = entries
    .filter((entry) => entry.filename !== 'roadmap')
    .sort((a, b) => semverSort(a.filename, b.filename))
    .map((entry) => parseVersion(entry.content));

  return { versions, roadmap };
}
