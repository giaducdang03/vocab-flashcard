import { api } from './client';
import type {
  AdminOverview,
  AdminUserDetail,
  AdminUserList,
  AdminUserListParams,
  AdminUserUpdate,
} from '../types/admin';

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await api.get<AdminOverview>('/admin/overview');
  return response.data;
}

export async function listAdminUsers(params: AdminUserListParams): Promise<AdminUserList> {
  // Bỏ tham số rỗng để backend không nhận role="" / ai="" (422).
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );
  const response = await api.get<AdminUserList>('/admin/users', { params: query });
  return response.data;
}

export async function getAdminUser(id: string): Promise<AdminUserDetail> {
  const response = await api.get<AdminUserDetail>(`/admin/users/${id}`);
  return response.data;
}

export async function updateAdminUser(id: string, body: AdminUserUpdate): Promise<AdminUserDetail> {
  const response = await api.patch<AdminUserDetail>(`/admin/users/${id}`, body);
  return response.data;
}
