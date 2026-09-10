import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import UserMenu from './UserMenu';

interface PageHeaderProps {
  user?: User | null;
  onLogout?: () => void;
}

export default function PageHeader({ user, onLogout }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div
        className="brand-row hover:opacity-70 transition-opacity cursor-pointer"
        onClick={() => navigate('/')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
      >
        <div className="brand-mark small">VF</div>
        <span>VocabFlash</span>
      </div>

      <nav className="top-actions">
        {user && <UserMenu user={user} onLogout={onLogout} />}
      </nav>
    </header>
  );
}
