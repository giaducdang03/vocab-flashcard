import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { apiErrorMessage } from '../api/errors';

export default function AuthCallbackPage() {
  const { t } = useTranslation('auth');
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
        state: { authError: t('errors.noAuthorizationCode') },
      });
      return;
    }

    // Exchange code for token
    (async () => {
      try {
        await loginWithGoogleCode(code);
        navigate('/', { replace: true });
      } catch (err) {
        const message = apiErrorMessage(err, t('errors.signInFailed'));
        navigate('/login', {
          replace: true,
          state: { authError: message },
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loginWithGoogleCode, navigate]);

  return (
    <div className="app-shell center-block">
      <p>{t('callback.processing')}</p>
    </div>
  );
}
