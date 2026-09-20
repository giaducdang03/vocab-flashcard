import axios from 'axios';

import i18n from '../i18n';

type StructuredDetail = {
  code?: unknown;
  message?: unknown;
  params?: Record<string, unknown>;
};

function detailOf(err: unknown): unknown {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { detail?: unknown } | undefined)?.detail;
}

/**
 * Lấy câu lỗi hiển thị được từ response lỗi của API.
 *
 * Thứ tự ưu tiên:
 *   1. Có `code` và có bản dịch  -> câu dịch theo ngôn ngữ đang bật.
 *   2. Có `code` nhưng chưa dịch -> `message` tiếng Anh từ máy chủ.
 *   3. `detail` là chuỗi          -> dùng nguyên chuỗi (endpoint chưa chuyển).
 *   4. Không có gì                -> `fallback` do nơi gọi truyền vào.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = detailOf(err);

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const { code, message, params } = detail as StructuredDetail;

    if (typeof code === 'string' && code) {
      const translated = i18n.t(`errors:${code}`, { ...params, defaultValue: '' });
      if (translated) return translated;
    }

    if (typeof message === 'string' && message.trim()) return message;
  }

  if (typeof detail === 'string' && detail.trim()) return detail;

  return fallback;
}
