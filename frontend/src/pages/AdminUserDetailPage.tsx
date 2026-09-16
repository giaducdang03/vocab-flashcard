import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, CircleCheck, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import AdminKpiCard from '../components/admin/AdminKpiCard';
import ActivityBars from '../components/admin/ActivityBars';
import AiAccessCard from '../components/admin/AiAccessCard';
import RateLimitCard from '../components/admin/RateLimitCard';
import RecentAiQuizzes from '../components/admin/RecentAiQuizzes';
import { getAdminUser, updateAdminUser } from '../api/admin';
import { apiErrorMessage } from '../api/errors';
import { buildAdminUpdate, draftFromDetail, hasChanges, type AdminUserDraft } from '../lib/adminDraft';
import { formatDate, formatDateTime, formatPercent, plural } from '../lib/adminFormat';
import type { UserRole } from '../types';
import type { AdminUserDetail } from '../types/admin';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [draft, setDraft] = useState<AdminUserDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(null);
    getAdminUser(id)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setDraft(draftFromDetail(data));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load this user.'));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const backToList = () => {
    const from = (location.state as { from?: string } | null)?.from ?? '';
    navigate(`/admin/users${from}`);
  };

  const handleSave = async () => {
    if (!detail || !draft) return;
    const body = buildAdminUpdate(draftFromDetail(detail), draft);
    if (Object.keys(body).length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const next = await updateAdminUser(detail.id, body);
      setDetail(next);
      setDraft(draftFromDetail(next));
      setToast('User settings saved');
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save changes.'));
    } finally {
      setSaving(false);
    }
  };

  const shell = (content: React.ReactNode) => (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />
      <main className="page-container">{content}</main>
    </div>
  );

  if (loadError) {
    return shell(
      <div role="alert" className="rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
        {loadError}
      </div>,
    );
  }

  if (!detail || !draft) {
    return shell(<div className="empty-state">Loading user…</div>);
  }

  const dirty = hasChanges(draftFromDetail(detail), draft);
  const isSelf = user?.id === detail.id;
  const roleLocked = detail.is_config_admin || isSelf;
  const roleLockReason = detail.is_config_admin
    ? 'Managed by ADMIN_EMAILS'
    : isSelf
      ? 'You cannot change your own role'
      : undefined;
  const learnedPercent = detail.card_count > 0 ? detail.learned_cards / detail.card_count : null;

  return (
    <>
      {shell(
        <>
          <nav className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 text-body transition-colors hover:text-ink"
            >
              <ArrowLeft size={15} />
              Back to Users
            </button>
            <span>/</span>
            <span className="text-caption-uppercase uppercase">Administration</span>
            <span>/</span>
            <span className="text-caption-uppercase uppercase">User Management</span>
          </nav>

          <section className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-headline-lg text-ink">{detail.display_name}</h1>
                <select
                  value={draft.role}
                  disabled={roleLocked || saving}
                  title={roleLockReason}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}
                  className="h-9 rounded-lg border border-hairline-strong bg-white px-3 text-body-sm text-ink disabled:cursor-not-allowed disabled:bg-canvas-soft disabled:text-muted"
                >
                  <option value="user">Role: User</option>
                  <option value="admin">Role: Admin</option>
                </select>
                {detail.is_config_admin && (
                  <span className="rounded-full border border-hairline px-2.5 py-0.5 text-caption-uppercase uppercase text-muted">
                    Managed by config
                  </span>
                )}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-body">
                <Mail size={14} />
                {detail.email}
                <span className="text-muted">•</span>
                <CalendarDays size={14} />
                Joined {formatDate(detail.created_at)}
              </p>
            </div>
            <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={handleSave}>
              <Check size={16} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </section>

          {saveError && (
            <div role="alert" className="mt-4 rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
              {saveError}
            </div>
          )}

          <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AdminKpiCard label="Study Sessions" value={plural(detail.session_count, 'session')} caption="created" />
            <AdminKpiCard
              label="Flashcards"
              value={plural(detail.card_count, 'card')}
              caption={`${detail.learned_cards} learned (${formatPercent(learnedPercent)})`}
            />
            <AdminKpiCard
              label="Quizzes Taken"
              value={String(detail.quizzes_taken)}
              caption={`${formatPercent(detail.avg_accuracy)} avg accuracy`}
            />
            <AdminKpiCard
              label="Last Active"
              value={detail.last_active_at ? formatDate(detail.last_active_at) : 'Never'}
              caption={detail.last_active_at ? formatDateTime(detail.last_active_at) : 'no activity yet'}
            />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ActivityBars days={detail.activity_7d} />
            <AiAccessCard
              enabled={draft.ai_enabled}
              disabled={saving}
              onChange={(enabled) => setDraft({ ...draft, ai_enabled: enabled })}
            />
          </div>

          <div className="mt-6">
            <RateLimitCard
              usage={detail.ai_usage}
              value={draft.ai_daily_limit}
              systemDefault={detail.ai_system_default_limit}
              aiEnabled={draft.ai_enabled}
              onChange={(limit) => setDraft({ ...draft, ai_daily_limit: limit })}
            />
          </div>

          <div className="mt-6">
            <RecentAiQuizzes quizzes={detail.recent_ai_quizzes} />
          </div>
        </>,
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-3 text-body-sm text-ink shadow-lg"
        >
          <CircleCheck size={16} className="text-success" />
          {toast}
        </div>
      )}
    </>
  );
}
