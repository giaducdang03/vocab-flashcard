import { useState, useRef, useEffect } from 'react';
import { CircleUser, LogOut } from 'lucide-react';
import type { User } from '../types';

type UserMenuProps = {
  user: User;
  onLogout: () => void;
};

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-canvas transition-colors text-ink"
        onClick={() => setIsOpen(!isOpen)}
        title="User menu"
      >
        <CircleUser size={18} />
        <span className="text-sm font-medium">{user.display_name || user.email}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-hairline rounded-lg shadow-lg z-50">
          <div className="px-4 py-3 border-b border-hairline">
            <p className="text-xs text-muted mb-1">User info</p>
            <p className="text-sm font-semibold text-ink">{user.display_name}</p>
            <p className="text-xs text-muted">{user.email}</p>
          </div>

          <button
            type="button"
            className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-canvas text-ink transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
