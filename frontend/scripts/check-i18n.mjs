// Đối chiếu key giữa hai ngôn ngữ. Thoát khác 0 nếu lệch, để chặn build.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const LANGS = ['en', 'vi'];

/** Trải JSON lồng nhau thành danh sách key phẳng: "a.b.c". */
function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, key) : [key];
  });
}

function keysOf(lang, file) {
  const path = join(root, lang, file);
  if (!existsSync(path)) return null;
  return new Set(flatten(JSON.parse(readFileSync(path, 'utf8'))));
}

const files = new Set(LANGS.flatMap((l) => readdirSync(join(root, l))));
const problems = [];

for (const file of [...files].sort()) {
  const [en, vi] = LANGS.map((l) => keysOf(l, file));
  if (!en) problems.push(`${file}: thiếu hẳn file bản en`);
  if (!vi) problems.push(`${file}: thiếu hẳn file bản vi`);
  if (!en || !vi) continue;

  for (const k of en) if (!vi.has(k)) problems.push(`${file}: vi thiếu key "${k}"`);
  for (const k of vi) if (!en.has(k)) problems.push(`${file}: en thiếu key "${k}"`);
}

if (problems.length) {
  console.error(
    `check-i18n: ${problems.length} vấn đề\n` + problems.map((p) => `  - ${p}`).join('\n'),
  );
  process.exit(1);
}
console.log(`check-i18n: OK, ${files.size} namespace khớp key giữa ${LANGS.join(' và ')}.`);
