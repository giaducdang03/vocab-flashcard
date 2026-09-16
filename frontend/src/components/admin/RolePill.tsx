import type { UserRole } from '../../types';

export default function RolePill({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 text-caption-uppercase uppercase text-white">
        Admin
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-surface-card px-2.5 py-0.5 text-caption-uppercase uppercase text-body">
      User
    </span>
  );
}
