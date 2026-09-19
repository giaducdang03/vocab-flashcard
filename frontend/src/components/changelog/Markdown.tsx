import type { ReactNode } from 'react';
import { Info, ShieldCheck, Sparkles, TrendingUp, Wrench } from 'lucide-react';

const GROUP_ICONS: Record<string, typeof Sparkles> = {
  'Có gì mới': Sparkles,
  'Đã tốt hơn': TrendingUp,
  'Đã sửa': Wrench,
  'Lưu ý': Info,
  'Dành cho quản trị viên': ShieldCheck,
};

// Inline: **bold**, *italic*, `code`
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key++} className="rounded bg-surface-container px-1 py-0.5 font-mono text-[12px]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-body-sm text-body">
      {content
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, i) => {
          const heading = block.match(/^\*\*([^*]+)\*\*$/);
          if (heading) {
            const name = heading[1];
            const Icon = GROUP_ICONS[name];
            return (
              <div key={i} className="flex items-center gap-2 pt-space-sm">
                {Icon && <Icon size={18} className="text-primary" />}
                <h4 className="text-title-sm text-ink">{name}</h4>
              </div>
            );
          }
          if (block.startsWith('- ')) {
            return (
              <ul key={i} className="list-outside list-disc space-y-1.5 pl-5">
                {block.split('\n').map((line, j) => (
                  <li key={j} className="leading-relaxed">
                    {renderInline(line.replace(/^- /, ''))}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="leading-relaxed">
              {renderInline(block)}
            </p>
          );
        })}
    </div>
  );
}
