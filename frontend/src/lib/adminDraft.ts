import type { UserRole } from '../types';
import type { AdminUserDetail, AdminUserUpdate } from '../types/admin';

export const MAX_AI_DAILY_LIMIT = 1000;

export type AdminUserDraft = {
  role: UserRole;
  ai_enabled: boolean;
  /** null = dùng mặc định hệ thống */
  ai_daily_limit: number | null;
};

export function draftFromDetail(detail: AdminUserDetail): AdminUserDraft {
  return {
    role: detail.role,
    ai_enabled: detail.ai_enabled,
    ai_daily_limit: detail.ai_limit_is_custom ? detail.ai_daily_limit : null,
  };
}

/** Chỉ gửi các trường đã đổi để PATCH không ghi đè ngoài ý muốn. */
export function buildAdminUpdate(original: AdminUserDraft, draft: AdminUserDraft): AdminUserUpdate {
  const body: AdminUserUpdate = {};
  if (draft.role !== original.role) body.role = draft.role;
  if (draft.ai_enabled !== original.ai_enabled) body.ai_enabled = draft.ai_enabled;
  if (draft.ai_daily_limit !== original.ai_daily_limit) body.ai_daily_limit = draft.ai_daily_limit;
  return body;
}

export function hasChanges(original: AdminUserDraft, draft: AdminUserDraft): boolean {
  return Object.keys(buildAdminUpdate(original, draft)).length > 0;
}

export function isValidLimit(text: string): boolean {
  return /^\d+$/.test(text) && Number(text) <= MAX_AI_DAILY_LIMIT;
}
