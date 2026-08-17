import { useCallback, useState } from 'react';
import { Upload, X, ChevronDown, Copy, Check, Download } from 'lucide-react';
import { api } from '../api/client';

type FileData = {
  file: File;
  preview: string[][];
};

type ImportModalProps = {
  sessionId: string;
  onSuccess: () => void;
  onClose: () => void;
};

export default function ImportModal({ sessionId, onSuccess, onClose }: ImportModalProps) {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [copied, setCopied] = useState(false);

  const csvPrompt = `Tạo cho tôi một file CSV học từ vựng tiếng Anh theo đúng format sau:

**Cấu trúc CSV:**
- Encoding: UTF-8
- Dấu phân cách: dấu phẩy \`,\`
- Header bắt buộc (dòng đầu tiên): \`front_text,phonetic,back_text,example,synonyms\`

**Quy tắc từng cột:**
1. \`front_text\` — từ vựng hoặc collocation tiếng Anh
2. \`phonetic\` — phiên âm IPA đặt trong \`/.../\`. Bắt buộc với từ vựng đơn lẻ, để trống với collocation
3. \`back_text\` — nghĩa tiếng Việt. Nếu có nhiều nghĩa thì phân cách bằng dấu phẩy, bọc trong dấu ngoặc kép \`"nghĩa 1, nghĩa 2"\`
4. \`example\` — một câu ví dụ tiếng Anh sử dụng từ đó. Nếu câu chứa dấu phẩy thì bọc trong \`"..."\`
5. \`synonyms\` — danh sách từ đồng nghĩa, mỗi từ kèm phiên âm, phân cách bằng \`; \`. Format: \`word1 /phiên âm/; word2 /phiên âm/\`. Để trống nếu là collocation

**Phân biệt vocab vs collocation:**
- Vocab: có phonetic + có synonyms → ví dụ: \`abundant,/əˈbʌndənt/,"dồi dào, phong phú",The region has abundant natural resources.,plentiful /ˈplentɪfəl/; copious /ˈkoʊpiəs/\`
- Collocation: phonetic trống + synonyms trống → ví dụ: \`make a decision,,"đưa ra quyết định",We need to make a decision before the deadline.,\`

**Ví dụ hoàn chỉnh 3 dòng (1 header + 1 vocab + 1 collocation):**
\`\`\`csv
front_text,phonetic,back_text,example,synonyms
resilient,/rɪˈzɪliənt/,"kiên cường, có sức bật",She proved to be remarkably resilient after the setback.,tough /tʌf/; hardy /ˈhɑːrdi/; adaptable /əˈdæptəbəl/
take into account,,"xem xét, tính đến",You should take into account all the risks involved.,
\`\`\`

**Yêu cầu:**
- Chủ đề: [ĐIỀN CHỦ ĐỀ CỦA BẠN VÀO ĐÂY]
- Số lượng: [ĐIỀN SỐ LƯỢNG] từ vocab + [ĐIỀN SỐ LƯỢNG] collocation
- Mỗi vocab phải có ít nhất 2 synonym kèm phiên âm IPA chính xác
- Nghĩa tiếng Việt phải tự nhiên, dễ hiểu
- Câu ví dụ phải thực tế, đúng ngữ cảnh
- Output: chỉ trả về nội dung CSV, không giải thích thêm`;

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(csvPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
      const lines = content.split('\n');
      const preview = lines.slice(0, 6).map((line) => {
        if (file.name.endsWith('.csv')) {
          return line.split(',').map((cell) => cell.trim());
        }

        return line.split('\t').map((cell) => cell.trim());
      });

      setFileData({
        file,
        preview: preview.filter((row) => row.some((cell) => cell)),
      });

      setError('');
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

        <div className="px-7 py-7 flex-1 overflow-y-auto flex flex-col gap-4">
          {/* Format Guide */}
          <button
            type="button"
            onClick={() => setShowFormat(!showFormat)}
            className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <span className="text-sm font-semibold text-ink">📋 CSV Format & Prompt</span>
            <ChevronDown size={18} className={`transition-transform ${showFormat ? 'rotate-180' : ''}`} />
          </button>

          {showFormat && (
            <div className="px-4 py-3 bg-gray-50 border border-hairline rounded-lg text-xs space-y-3 overflow-auto max-h-96">
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

          {!fileData ? (
            <div
              className={`grid place-items-center gap-4 min-h-72 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-primary bg-orange-50/50 text-primary'
                  : 'border-hairline bg-white/60 text-body'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload size={36} />
              <h3 className="text-lg font-semibold text-ink m-0">Drag and drop your file</h3>
              <p className="text-body m-0">or click to browse</p>

              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />

              <label htmlFor="file-input" className="px-4 py-2 bg-white text-ink border border-hairline rounded-lg hover:border-primary font-semibold cursor-pointer transition-all">
                Choose file
              </label>

              <p className="text-xs text-muted m-0 mt-2">Supported: .xlsx, .csv</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink m-0 mb-1">{fileData.file.name}</p>
                  <p className="text-sm text-body m-0">
                    {fileData.preview.length} rows (preview showing first 5 + header)
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
                <div className="grid gap-0 bg-surface-strong" style={{ gridTemplateColumns: `repeat(${fileData.preview[0]?.length || 5}, 1fr)` }}>
                  {fileData.preview[0]?.map((cell, index) => (
                    <div key={index} className="px-3 py-2 text-xs font-semibold text-ink border-b border-r border-hairline last:border-r-0">
                      {cell || `Column ${index + 1}`}
                    </div>
                  ))}
                </div>

                {fileData.preview.slice(1).map((row, rowIndex) => (
                  <div key={rowIndex} className="grid gap-0" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                    {row.map((cell, colIndex) => (
                      <div key={colIndex} className="px-3 py-2 text-xs text-ink border-b border-r border-hairline last:border-r-0">
                        {cell}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <p className="text-sm text-body text-center px-4 py-3 bg-green-50/50 border border-green-200 rounded-lg m-0">
                This will import {Math.max(0, fileData.preview.length - 1)} cards into this session.
              </p>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-error/8 text-error border border-error/20 rounded-lg text-sm">
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
              disabled={loading}
            >
              {loading ? 'Importing...' : 'Confirm import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
