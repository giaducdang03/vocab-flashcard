import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGoogleCode } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double-exchange in React 18 StrictMode
    if (hasProcessed.current) {
      return;
    }

    hasProcessed.current = true;

    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login', {
        replace: true,
        state: { authError: error },
      });
      return;
    }

    if (!code) {
      navigate('/login', {
        replace: true,
        state: { authError: 'No authorization code provided' },
      });
      return;
    }

    // Exchange code for token
    (async () => {
      try {
        await loginWithGoogleCode(code);
        navigate('/', { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
        navigate('/login', {
          replace: true,
          state: { authError: message },
        });
      }
    })();
  }, [searchParams, loginWithGoogleCode, navigate]);

  return (
    <div className="app-shell center-block">
      <p>Signing you in…</p>
    </div>
  );
}
