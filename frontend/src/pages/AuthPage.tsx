import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api, API_BASE_URL } from '../api/client';
import { apiErrorMessage } from '../api/errors';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function AuthPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, user } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    // Check if Google sign-in is enabled
    (async () => {
      try {
        const response = await api.get('/auth/providers');
        setGoogleEnabled(response.data.google === true);
      } catch {
        // If error, just don't show Google button
        setGoogleEnabled(false);
      }
    })();
  }, []);

  useEffect(() => {
    // Display auth error from OAuth callback redirect
    if (location.state?.authError) {
      setError(location.state.authError);
      // Clear the state to prevent showing the error again on page refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  if (isLoading) {
    return <div className="app-shell center-block">{t('callback.processing')}</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isRegister) {
        await register(form.email, form.password, form.display_name);
      } else {
        await login(form.email, form.password);
      }

      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, t('errors.authFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell auth-shell">
      <div className="auth-lang-switcher" style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div className="auth-panel">
        <div className="brand-block">
          <img src="/favicon.ico" alt={t('brand.name')} className="brand-logo" />
          <div>
            <p className="eyebrow">{t('brand.name')}</p>
            <h1>{t('brand.tagline')}</h1>
          </div>
        </div>

        <div className="feature-list">
          <div className="feature-inline">
            <Sparkles size={18} />
            <span>{t('features.weeklyLoops')}</span>
          </div>
          <div className="feature-inline">
            <Sparkles size={18} />
            <span>{t('features.sessionMemorization')}</span>
          </div>
          <div className="feature-inline">
            <Sparkles size={18} />
            <span>{t('features.fastReview')}</span>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-toggle">
            <button
              type="button"
              className={isRegister ? 'tab-button' : 'tab-button active'}
              onClick={() => setIsRegister(false)}
            >
              {t('login.tab')}
            </button>
            <button
              type="button"
              className={isRegister ? 'tab-button active' : 'tab-button'}
              onClick={() => setIsRegister(true)}
            >
              {t('register.tab')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="stack-form">
            {isRegister && (
              <label className="field-group">
                <span>{t('field.displayName')}</span>
                <input
                  value={form.display_name}
                  onChange={(event) => setForm({ ...form, display_name: event.target.value })}
                  placeholder={t('field.displayNamePlaceholder')}
                />
              </label>
            )}

            <label className="field-group">
              <span>{t('field.email')}</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder={t('field.emailPlaceholder')}
                required
              />
            </label>

            <label className="field-group">
              <span>{t('field.password')}</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={t('field.passwordPlaceholder')}
                required
              />
            </label>

            {error && <div className="inline-error">{error}</div>}

            <button type="submit" className="btn btn-primary wide" disabled={submitting}>
              {submitting
                ? isRegister
                  ? t('register.submitting')
                  : t('login.submitting')
                : isRegister
                  ? t('register.submit')
                  : t('login.submit')}
              <ArrowRight size={16} />
            </button>
          </form>

          {googleEnabled && (
            <>
              <div className="divider-text">{t('login.or')}</div>
              <button
                type="button"
                className="btn btn-secondary wide btn-google"
                onClick={() => {
                  window.location.assign(`${API_BASE_URL}/auth/google/login`);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
                  />
                </svg>
                {t('login.googleCta')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
