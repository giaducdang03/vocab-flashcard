import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import ChangelogPage from './pages/ChangelogPage';
import SessionsPage from './pages/SessionsPage';
import SessionDetailPage from './pages/SessionDetailPage';
import StudyPage from './pages/StudyPage';
import QuizzesPage from './pages/QuizzesPage';
import QuizDetailPage from './pages/QuizDetailPage';
import TakeQuizPage from './pages/TakeQuizPage';
import AttemptReviewPage from './pages/AttemptReviewPage';
import PracticePage from './pages/PracticePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import Footer from './components/Footer';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-shell center-block">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-shell center-block">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function HomeRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-shell center-block">Loading…</div>;
  }

  return user ? <DashboardPage /> : <LandingPage />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<HomeRoute />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <SessionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions/:id"
        element={
          <ProtectedRoute>
            <SessionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions/:id/study"
        element={
          <ProtectedRoute>
            <StudyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions/:id/practice"
        element={
          <ProtectedRoute>
            <PracticePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes"
        element={
          <ProtectedRoute>
            <QuizzesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes/:id"
        element={
          <ProtectedRoute>
            <QuizDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes/:id/take"
        element={
          <ProtectedRoute>
            <TakeQuizPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attempts/:id"
        element={
          <ProtectedRoute>
            <AttemptReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <AdminRoute>
            <AdminUserDetailPage />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">
          <AppRoutes />
        </div>
        <Footer />
      </div>
    </AuthProvider>
  );
}
