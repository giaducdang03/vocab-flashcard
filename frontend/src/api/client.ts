import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'vocabflash:token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setStoredToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 only means "your session expired" for a request that actually
    // carried a token. Login/register calls are unauthenticated by nature —
    // their 401 just means "wrong credentials", and the caller (AuthPage)
    // already shows that inline. Redirecting here would hard-reload the
    // page and wipe whatever the person had typed into the form.
    const hadToken = Boolean(error.config?.headers?.Authorization);

    if (error.response?.status === 401 && hadToken) {
      setStoredToken(null);
      window.location.assign('/login');
    }

    return Promise.reject(error);
  },
);

export { API_BASE_URL, TOKEN_KEY };
