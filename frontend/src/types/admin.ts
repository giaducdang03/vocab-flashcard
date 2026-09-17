import type { UserRole } from './index';

export type AiFilter = '' | 'enabled' | 'disabled';

export type AdminOverview = {
  total_users: number;
  active_users_7d: number;
  total_cards: number;
  ai_quizzes_24h: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  is_config_admin: boolean;
  email_verified: boolean;
  has_google: boolean;
  avatar_url: string | null;
  session_count: number;
  card_count: number;
  quizzes_taken: number;
  avg_accuracy: number | null;
  ai_enabled: boolean;
  ai_daily_limit: number;
  ai_limit_is_custom: boolean;
  ai_used_24h: number;
};

export type AdminUserList = {
  items: AdminUserRow[];
  total: number;
  page: number;
  page_size: number;
};

export type ActivityDay = {
  date: string;
  count: number;
};

export type AiUsage = {
  used: number;
  limit: number;
  resets_at: string | null;
};

export type RecentAiQuiz = {
  id: string;
  title: string;
  created_at: string;
  status: 'pending' | 'ready' | 'failed';
  ai_question_count: number;
  requested_count: number;
};

export type AdminUserDetail = AdminUserRow & {
  learned_cards: number;
  last_active_at: string | null;
  activity_7d: ActivityDay[];
  ai_usage: AiUsage;
  ai_system_default_limit: number;
  recent_ai_quizzes: RecentAiQuiz[];
};

export type AdminUserUpdate = {
  role?: UserRole;
  ai_enabled?: boolean;
  ai_daily_limit?: number | null;
};

export type AdminUserListParams = {
  search?: string;
  role?: UserRole | '';
  ai?: AiFilter;
  page?: number;
  page_size?: number;
};
