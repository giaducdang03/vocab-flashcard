import { useCallback, useMemo, useState } from 'react';
import { Upload, X, ChevronDown, Copy, Check, Download } from 'lucide-react';
import { api } from '../api/client';

type FileData = {
  file: File;
  preview: string[][];
  totalRows: number;
};

type ImportModalProps = {
  sessionId: string;
  onSuccess: () => void;
  onClose: () => void;
};

const MAX_IMPORT_ROWS = 100;

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export default function ImportModal({ sessionId, onSuccess, onClose }: ImportModalProps) {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includeVocab, setIncludeVocab] = useState(true);
  const [includeSynonyms, setIncludeSynonyms] = useState(true);
  const [includeCollocation, setIncludeCollocation] = useState(true);

  const toggleVocab = useCallback(() => {
    setIncludeVocab((prev) => {
      if (prev && !includeCollocation) {
        return prev;
      }

      return !prev;
    });
  }, [includeCollocation]);

  const toggleCollocation = useCallback(() => {
    setIncludeCollocation((prev) => {
      if (prev && !includeVocab) {
        return prev;
      }

      return !prev;
    });
  }, [includeVocab]);

  const toggleSynonyms = useCallback(() => {
    setIncludeSynonyms((prev) => !prev);
  }, []);

  const csvPrompt = useMemo(() => {
    const typeLabel = includeVocab && includeCollocation ? 'từ vựng hoặc collocation' : includeVocab ? 'từ vựng' : 'collocation';
    const withSynonyms = includeVocab && includeSynonyms;

    const lines: string[] = [
      'Tạo cho tôi một file CSV học từ vựng tiếng Anh theo đúng format sau:',
      '',
      '**Cấu trúc CSV:**',
      '- Encoding: UTF-8',
      '- Dấu phân cách: dấu phẩy `,`',
      '- Header bắt buộc (dòng đầu tiên): `front_text,phonetic,back_text,example,synonyms`',
      '',
      '**Quy tắc từng cột:**',
      `1. \`front_text\` — ${typeLabel} tiếng Anh`,
    ];

    if (includeVocab && includeCollocation) {
      lines.push('2. `phonetic` — phiên âm IPA đặt trong `/.../`. Bắt buộc với từ vựng đơn lẻ, để trống với collocation');
    } else if (includeVocab) {
      lines.push('2. `phonetic` — phiên âm IPA đặt trong `/.../`. Bắt buộc với mọi từ vựng');
    } else {
      lines.push('2. `phonetic` — luôn để trống (collocation không cần phiên âm)');
    }

    lines.push('3. `back_text` — nghĩa tiếng Việt. Nếu có nhiều nghĩa thì phân cách bằng dấu phẩy, bọc trong dấu ngoặc kép `"nghĩa 1, nghĩa 2"`');
    lines.push('4. `example` — một câu ví dụ tiếng Anh sử dụng từ đó. Nếu câu chứa dấu phẩy thì bọc trong `"..."`');

    if (withSynonyms) {
      lines.push('5. `synonyms` — danh sách từ đồng nghĩa, mỗi từ kèm phiên âm, phân cách bằng `; `. Format: `word1 /phiên âm/; word2 /phiên âm/`. Để trống nếu là collocation');
    } else {
      lines.push('5. `synonyms` — luôn để trống (không cần điền)');
    }

    lines.push('');

    if (includeVocab && includeCollocation) {
      lines.push('**Phân biệt vocab vs collocation:**');
      lines.push(`- Vocab: có phonetic${withSynonyms ? ' + có synonyms' : ''} → ví dụ: \`abundant,/əˈbʌndənt/,"dồi dào, phong phú",The region has abundant natural resources.,${withSynonyms ? 'plentiful /ˈplentɪfəl/; copious /ˈkoʊpiəs/' : ''}\``);
      lines.push('- Collocation: phonetic trống' + (withSynonyms ? ' + synonyms trống' : '') + ' → ví dụ: `make a decision,,"đưa ra quyết định",We need to make a decision before the deadline.,`');
      lines.push('');
    }

    lines.push('**Ví dụ hoàn chỉnh:**');
    lines.push('```csv');
    lines.push('front_text,phonetic,back_text,example,synonyms');

    if (includeVocab) {
      lines.push(`resilient,/rɪˈzɪliənt/,"kiên cường, có sức bật",She proved to be remarkably resilient after the setback.,${withSynonyms ? 'tough /tʌf/; hardy /ˈhɑːrdi/; adaptable /əˈdæptəbəl/' : ''}`);
    }

    if (includeCollocation) {
      lines.push('take into account,,"xem xét, tính đến",You should take into account all the risks involved.,');
    }

    lines.push('```');
    lines.push('');
    lines.push('**Yêu cầu:**');
    lines.push('- Chủ đề: [ĐIỀN CHỦ ĐỀ CỦA BẠN VÀO ĐÂY]');

    const countParts: string[] = [];
    if (includeVocab) {
      countParts.push('[ĐIỀN SỐ LƯỢNG] từ vocab');
    }
    if (includeCollocation) {
      countParts.push('[ĐIỀN SỐ LƯỢNG] collocation');
    }
    lines.push(`- Số lượng: ${countParts.join(' + ')}`);

    if (withSynonyms) {
      lines.push('- Mỗi vocab phải có ít nhất 2 synonym kèm phiên âm IPA chính xác');
    }

    lines.push('- Nghĩa tiếng Việt phải tự nhiên, dễ hiểu');
    lines.push('- Câu ví dụ phải thực tế, đúng ngữ cảnh');
    lines.push('- Output: chỉ trả về nội dung CSV, không giải thích thêm');

    return lines.join('\n');
  }, [includeVocab, includeSynonyms, includeCollocation]);

  const handleCopyPrompt = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(csvPrompt);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = csvPrompt;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error('execCommand copy failed');
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy prompt to clipboard');
    }
  }, [csvPrompt]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch('/api/cards/template/download');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'vocab_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
    }
  }, []);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      const delimiter = file.name.endsWith('.csv') ? ',' : '\t';
      const rows = content
        .split('\n')
        .map((line) => parseDelimitedLine(line, delimiter))
        .filter((row) => row.some((cell) => cell));

      setFileData({
        file,
        preview: rows,
        totalRows: rows.length,
      });

      setError(
        rows.length - 1 > MAX_IMPORT_ROWS
          ? `File has ${rows.length - 1} rows, which exceeds the ${MAX_IMPORT_ROWS}-row limit per import. Please split it into smaller files.`
          : '',
      );
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = e.dataTransfer.files;

      if (files && files.length > 0) {
        const file = files[0];

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
          parseFile(file);
        } else {
          setError('Please upload a .xlsx or .csv file');
        }
      }
    },
    [parseFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;

      if (files && files.length > 0) {
        parseFile(files[0]);
      }
    },
    [parseFile],
  );

  const handleImport = async () => {
    if (!fileData) {
      return;
    }

    if (fileData.totalRows - 1 > MAX_IMPORT_ROWS) {
      setError(`File has ${fileData.totalRows - 1} rows, which exceeds the ${MAX_IMPORT_ROWS}-row limit per import. Please split it into smaller files.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', fileData.file);

      await api.post(`/sessions/${sessionId}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-canvas border border-hairline rounded-3xl max-w-2xl w-[90vw] max-h-[90vh] flex flex-col animate-slideUp">
        <div className="flex items-center justify-between px-7 py-6 border-b border-hairline">
          <h2 className="text-2xl font-light letter-spacing-tight text-ink m-0">Import cards</h2>
          <button
            type="button"
            className="w-9 h-9 border border-hairline rounded-xl bg-transparent text-ink hover:bg-surface-strong transition-all flex items-center justify-center"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-7 py-7 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          {/* Format Guide */}
          <button
            type="button"
            onClick={() => setShowFormat(!showFormat)}
            className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shrink-0"
          >
            <span className="text-sm font-semibold text-ink">📋 CSV Format & Prompt</span>
            <ChevronDown size={18} className={`transition-transform ${showFormat ? 'rotate-180' : ''}`} />
          </button>

          {showFormat && (
            <div className="px-4 py-3 bg-gray-50 border border-hairline rounded-lg text-xs space-y-3 overflow-auto max-h-96 shrink-0">
              <div>
                <p className="font-semibold text-ink mb-2">⚙️ Tuỳ chỉnh nội dung prompt:</p>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeVocab}
                      onChange={toggleVocab}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-body">Vocab</span>
                  </label>

                  <label className={`flex items-center gap-2 select-none ${includeVocab ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={includeSynonyms}
                      onChange={toggleSynonyms}
                      disabled={!includeVocab}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-body">Synonyms</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeCollocation}
                      onChange={toggleCollocation}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-body">Collocation</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                    copied
                      ? 'bg-green-100 text-success border border-green-300'
                      : 'bg-white border border-hairline text-ink hover:border-primary'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy Prompt
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1 px-3 py-2 bg-white border border-hairline text-ink hover:border-primary rounded-lg font-semibold transition-all text-sm"
                >
                  <Download size={16} />
                  Download Template
                </button>
              </div>

              <div>
                <p className="font-semibold text-ink mb-2">📌 CSV Header:</p>
                <code className="block bg-white p-2 rounded border border-hairline text-gray-700 font-mono text-xs">
                  front_text,phonetic,back_text,example,synonyms
                </code>
              </div>

              <div>
                <p className="font-semibold text-ink mb-2">📝 Cấu trúc từng cột:</p>
                <ul className="space-y-1 text-body">
                  <li><strong>front_text:</strong> từ vựng/collocation tiếng Anh</li>
                  <li><strong>phonetic:</strong> phiên âm IPA trong /.../ (trống với collocation)</li>
                  <li><strong>back_text:</strong> nghĩa Việt, nhiều nghĩa thì ngăn bằng dấu phẩy</li>
                  <li><strong>example:</strong> câu ví dụ tiếng Anh</li>
                  <li><strong>synonyms:</strong> từ đồng nghĩa kèm phiên âm, ngăn bằng <strong>;</strong></li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-ink mb-2">✅ Ví dụ Vocab:</p>
                <code className="block bg-white p-2 rounded border border-hairline text-gray-700 font-mono text-xs whitespace-pre-wrap overflow-auto">
                  resilient,/rɪˈzɪliənt/,"kiên cường, sức bật",She proved remarkably resilient.,tough /tʌf/; hardy /ˈhɑːrdi/
                </code>
              </div>

              <div>
                <p className="font-semibold text-ink mb-2">✅ Ví dụ Collocation:</p>
                <code className="block bg-white p-2 rounded border border-hairline text-gray-700 font-mono text-xs whitespace-pre-wrap overflow-auto">
                  make a decision,,"đưa ra quyết định",We need to make a decision.,
                </code>
              </div>

              <div className="text-body bg-yellow-50 p-2 rounded border border-yellow-200 text-xs">
                💡 Nếu text chứa dấu phẩy, bọc trong dấu ngoặc kép "..."
              </div>
            </div>
          )}

          {!showFormat && (!fileData ? (
            <div
              className={`grid place-items-center gap-2 min-h-40 shrink-0 border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-primary bg-orange-50/50 text-primary'
                  : 'border-hairline bg-white/60 text-body'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload size={24} />
              <h3 className="text-base font-semibold text-ink m-0">Drag and drop your file</h3>
              <p className="text-body text-sm m-0">or click to browse</p>

              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />

              <label htmlFor="file-input" className="px-4 py-2 bg-white text-ink border border-hairline rounded-lg hover:border-primary font-semibold cursor-pointer transition-all text-sm">
                Choose file
              </label>

              <p className="text-xs text-muted m-0">Supported: .xlsx, .csv</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink m-0 mb-1">{fileData.file.name}</p>
                  <p className="text-sm text-body m-0">
                    {fileData.totalRows} rows
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-white text-ink border border-hairline rounded-lg hover:border-primary font-semibold text-sm transition-all"
                  onClick={() => {
                    setFileData(null);
                    setError('');
                  }}
                >
                  Change file
                </button>
              </div>

              <div className="border border-hairline rounded-2xl overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <div
                    className="grid gap-0 bg-surface-strong sticky top-0 z-10"
                    style={{ gridTemplateColumns: `repeat(${fileData.preview[0]?.length || 5}, 1fr)` }}
                  >
                    {fileData.preview[0]?.map((cell, index) => (
                      <div key={index} className="px-3 py-2 text-xs font-semibold text-ink border-b border-r border-hairline last:border-r-0">
                        {cell || `Column ${index + 1}`}
                      </div>
                    ))}
                  </div>

                  {fileData.preview.slice(1).map((row, rowIndex) => (
                    <div key={rowIndex} className="grid gap-0" style={{ gridTemplateColumns: `repeat(${fileData.preview[0]?.length || 5}, 1fr)` }}>
                      {row.map((cell, colIndex) => (
                        <div key={colIndex} className="px-3 py-2 text-xs text-ink border-b border-r border-hairline last:border-r-0">
                          {cell}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-body text-center px-4 py-3 bg-green-50/50 border border-green-200 rounded-lg m-0">
                This will import {Math.max(0, fileData.totalRows - 1)} cards into this session.
              </p>
            </div>
          ))}

          {error && (
            <div className="px-3 py-2 bg-error/8 text-error border border-error/20 rounded-lg text-sm shrink-0">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-hairline">
          <button type="button" className="px-4 py-2 bg-white text-ink border border-hairline rounded-lg hover:border-primary font-semibold transition-all" onClick={onClose}>
            Cancel
          </button>

          {fileData && (
            <button
              type="button"
              className="px-4 py-2 bg-primary text-on-primary border border-primary rounded-lg hover:bg-primary-active font-semibold transition-all disabled:opacity-50"
              onClick={handleImport}
              disabled={loading || fileData.totalRows - 1 > MAX_IMPORT_ROWS}
            >
              {loading ? 'Importing...' : 'Confirm import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
