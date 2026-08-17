import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, isLoading, user } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [navigate, user]);

  if (isLoading) {
    return <div className="app-shell center-block">Loading...</div>;
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
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell auth-shell">
      <div className="auth-panel">
        <div className="brand-block">
          <div className="brand-mark">VF</div>
          <div>
            <p className="eyebrow">VocabFlash</p>
            <h1>Build vocabulary sessions that stick.</h1>
          </div>
        </div>

        <div className="feature-list">
          <div className="feature-inline">
            <Sparkles size={18} />
            <span>Weekly study loops</span>
          </div>
          <div className="feature-inline">
            <Sparkles size={18} />
            <span>Session-based memorization</span>
          </div>
          <div className="feature-inline">
            <Sparkles size={18} />
            <span>Fast review with spaced recall</span>
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
              Login
            </button>
            <button
              type="button"
              className={isRegister ? 'tab-button active' : 'tab-button'}
              onClick={() => setIsRegister(true)}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="stack-form">
            {isRegister && (
              <label className="field-group">
                <span>Display name</span>
                <input
                  value={form.display_name}
                  onChange={(event) => setForm({ ...form, display_name: event.target.value })}
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="field-group">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="field-group">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="••••••••"
                required
              />
            </label>

            {error && <div className="inline-error">{error}</div>}

            <button type="submit" className="btn btn-primary wide" disabled={submitting}>
              {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
