export interface ChangelogVersion {
  version: string;
  date: string;
  title: string;
  label?: string;
  content: string;
  icon: string;
}

export interface ChangelogData {
  versions: ChangelogVersion[];
  roadmap: string;
}

const ICON_MAP: Record<string, string> = {
  'Có gì mới': 'Sparkles',
  'Đã tốt hơn': 'TrendingUp',
  'Đã sửa': 'Wrench',
  'Lưu ý': 'AlertCircle',
  'Dành cho quản trị viên': 'Settings',
};

const LABEL_MAP: Record<string, string> = {
  '2.0.0': 'LỚN / BỘ MẶT MỚI',
  '1.1.1': 'CẢI TIẾN AI',
  '1.1.0': 'SOẠN ĐỀ BẰNG AI',
  '1.0.0': 'LỚN / GIAO DIỆN MỚI',
};

const parseVersion = (text: string): { version: string; date: string; title: string; label?: string; content: string } => {
  const verMatch = text.match(/## Phiên bản ([\d.]+) — (\d{2}\/\d{2}\/\d{4})/);
  if (!verMatch) throw new Error('Invalid version format');

  const [, version, date] = verMatch;
  const titleMatch = text.match(/### (.+)/);
  if (!titleMatch) throw new Error('Invalid title format');

  const title = titleMatch[1];
  const labelMatch = text.match(/Nhãn: (.+)/);
  const label = labelMatch?.[1] || LABEL_MAP[version];

  const content = text.substring(text.indexOf('###') + titleMatch[0].length).trim();

  return { version, date, title, label, content };
};

export async function loadChangelog(): Promise<ChangelogData> {
  const files = import.meta.glob('../content/changelog/*.md', { query: '?raw', eager: true });
  const versions: ChangelogVersion[] = [];
  let roadmap = '';

  const semverSort = (a: string, b: string) => {
    const aparts = a.split('.').map(Number);
    const bparts = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (aparts[i] !== bparts[i]) return bparts[i] - aparts[i];
    }
    return 0;
  };

  const entries = Object.entries(files)
    .map(([path, mod]: any) => {
      const filename = path.split('/').pop()!.replace('.md', '');
      return { filename, content: mod.default || mod };
    })
    .sort((a, b) => semverSort(a.filename, b.filename));

  for (const { filename, content } of entries) {
    if (filename === 'roadmap') {
      roadmap = content;
    } else {
      const parsed = parseVersion(content);
      versions.push({
        ...parsed,
        icon: 'Sparkles',
      });
    }
  }

  return { versions, roadmap };
}
