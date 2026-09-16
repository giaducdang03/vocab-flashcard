import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, RotateCcw, Search, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import AdminKpiCard from '../components/admin/AdminKpiCard';
import UserTable from '../components/admin/UserTable';
import Pagination from '../components/admin/Pagination';
import { fetchAdminOverview, listAdminUsers } from '../api/admin';
import { apiErrorMessage } from '../api/errors';
import type { UserRole } from '../types';
import type { AdminOverview, AdminUserList, AiFilter } from '../types/admin';

const PAGE_SIZE = 20;
const SELECT_CLASS =
  'h-[42px] appearance-none rounded-lg border border-hairline-strong bg-white py-0 pl-3 pr-8 text-body-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const role = (searchParams.get('role') ?? '') as UserRole | '';
  const ai = (searchParams.get('ai') ?? '') as AiFilter;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [list, setList] = useState<AdminUserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateParams = useCallback(
    (next: Record<string, string>) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          Object.entries(next).forEach(([key, value]) => {
            if (value) params.set(key, value);
            else params.delete(key);
          });
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = window.setTimeout(() => updateParams({ search: searchInput.trim(), page: '' }), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, updateParams]);

  useEffect(() => {
    fetchAdminOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listAdminUsers({ search, role, ai, page, page_size: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load users.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, role, ai, page]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openUser = (id: string) => {
    navigate(`/admin/users/${id}`, { state: { from: location.search } });
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const kpi = (value: number | undefined) => (value === undefined ? '—' : value.toLocaleString('en-US'));

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <main className="page-container">
        <section>
          <p className="flex items-center gap-2 text-caption-uppercase uppercase">
            <span className="text-muted">Administration</span>
            <span className="text-muted">/</span>
            <span className="text-primary">Directory</span>
          </p>
          <h1 className="mt-2 text-headline-lg text-ink">User Management</h1>
          <p className="mt-2 max-w-2xl text-body-sm text-body">
            Review learners, promote admins, and control who can use AI quiz generation and how often.
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <AdminKpiCard label="Total Users" value={kpi(overview?.total_users)} caption="registered" />
          <AdminKpiCard label="Active Learners" value={kpi(overview?.active_users_7d)} caption="last 7 days" />
          <AdminKpiCard label="Total Vocab Cards" value={kpi(overview?.total_cards)} caption="in circulation" />
          <AdminKpiCard label="AI Quizzes" value={kpi(overview?.ai_quizzes_24h)} caption="last 24 hours" />
        </section>

        <section className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or email"
              className="h-[42px] w-full rounded-lg border border-hairline-strong bg-white pl-9 pr-3 text-body-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </label>
          <div className="relative inline-flex items-center">
            <select
              value={role}
              onChange={(event) => updateParams({ role: event.target.value, page: '' })}
              className={SELECT_CLASS}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 text-muted" />
          </div>
          <div className="relative inline-flex items-center">
            <select
              value={ai}
              onChange={(event) => updateParams({ ai: event.target.value, page: '' })}
              className={SELECT_CLASS}
            >
              <option value="">All AI Access</option>
              <option value="enabled">AI Enabled</option>
              <option value="disabled">AI Disabled</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 text-muted" />
          </div>
          <button type="button" className="btn btn-secondary" onClick={resetFilters} title="Reset filters">
            <RotateCcw size={15} />
            Reset
          </button>
        </section>

        <section className="mt-4">
          {error ? (
            <div role="alert" className="rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
              {error}
            </div>
          ) : !list ? (
            <div className="empty-state">Loading users…</div>
          ) : list.items.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <h3>No users match these filters</h3>
            </div>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <UserTable rows={list.items} onOpen={openUser} />
              <Pagination
                page={list.page}
                pageSize={list.page_size}
                total={list.total}
                onChange={(next) => updateParams({ page: next > 1 ? String(next) : '' })}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
