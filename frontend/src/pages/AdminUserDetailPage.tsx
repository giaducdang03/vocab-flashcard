import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, ChevronDown, CircleCheck, CircleUserRound, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import GeneralInfoCard from '../components/admin/GeneralInfoCard';
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
  const [rateLimitValid, setRateLimitValid] = useState(true);

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

          <section className="mt-6 rounded-xl border border-hairline bg-surface-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex min-w-0 items-start gap-4 sm:items-center">
                {detail.avatar_url ? (
                  <img
                    src={detail.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-hairline"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-hairline-soft text-muted ring-2 ring-hairline">
                    <CircleUserRound size={36} strokeWidth={1.5} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-headline-md text-ink">{detail.display_name}</h1>
                    <div className="relative inline-flex items-center">
                      <select
                        value={draft.role}
                        disabled={roleLocked || saving}
                        title={roleLockReason}
                        onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}
                        className="h-8 appearance-none rounded-full border border-hairline-soft bg-surface-container py-0 pl-3 pr-7 text-body-sm text-ink disabled:cursor-not-allowed disabled:bg-canvas-soft disabled:text-muted"
                      >
                        <option value="user">Role: User</option>
                        <option value="admin">Role: Admin</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-muted" />
                    </div>
                    {detail.is_config_admin && (
                      <span className="rounded-full border border-hairline px-2.5 py-0.5 text-caption-uppercase uppercase text-muted">
                        Managed by config
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted">
                    <span className="flex items-center gap-1.5">
                      <Mail size={14} />
                      {detail.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={14} />
                      Joined {formatDate(detail.created_at)}
                    </span>
                  </p>
                  {(detail.email_verified || detail.has_google) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {detail.email_verified && (
                        <span className="rounded-full border border-hairline px-2 py-0.5 text-caption-uppercase uppercase text-muted">
                          Verified
                        </span>
                      )}
                      {detail.has_google && (
                        <span className="rounded-full border border-hairline px-2 py-0.5 text-caption-uppercase uppercase text-muted">
                          Google
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary h-9 shrink-0 px-3.5 text-body-sm"
                disabled={!dirty || saving || !rateLimitValid}
                onClick={handleSave}
              >
                <Check size={14} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </section>

          {saveError && (
            <div role="alert" className="mt-4 rounded-lg border border-error/30 bg-white px-4 py-3 text-body-sm text-error">
              {saveError}
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-5">
              <GeneralInfoCard
                displayName={detail.display_name}
                email={detail.email}
                stats={[
                  { label: 'Study Sessions', value: plural(detail.session_count, 'session'), caption: 'created' },
                  {
                    label: 'Flashcards',
                    value: plural(detail.card_count, 'card'),
                    caption: `${detail.learned_cards} learned (${formatPercent(learnedPercent)})`,
                    tone: 'success',
                  },
                  {
                    label: 'Quizzes Taken',
                    value: String(detail.quizzes_taken),
                    caption: `${formatPercent(detail.avg_accuracy)} avg accuracy`,
                    tone: 'success',
                  },
                  {
                    label: 'Last Active',
                    value: detail.last_active_at ? formatDate(detail.last_active_at) : 'Never',
                    caption: detail.last_active_at ? formatDateTime(detail.last_active_at) : 'no activity yet',
                  },
                ]}
              />

              <ActivityBars days={detail.activity_7d} />
            </div>

            <div className="flex flex-col gap-6 lg:col-span-7">
              <AiAccessCard
                enabled={draft.ai_enabled}
                disabled={saving}
                onChange={(enabled) => setDraft({ ...draft, ai_enabled: enabled })}
              />

              <RateLimitCard
                usage={detail.ai_usage}
                value={draft.ai_daily_limit}
                systemDefault={detail.ai_system_default_limit}
                aiEnabled={draft.ai_enabled}
                onChange={(limit) => setDraft({ ...draft, ai_daily_limit: limit })}
                onValidityChange={setRateLimitValid}
              />

              <RecentAiQuizzes quizzes={detail.recent_ai_quizzes} />
            </div>
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
