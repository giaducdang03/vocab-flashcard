import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type SessionCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isCreating: boolean;
};

export default function SessionCreateModal({
  isOpen,
  onClose,
  title,
  onTitleChange,
  onSubmit,
  isCreating,
}: SessionCreateModalProps) {
  const { t } = useTranslation('session');
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('create.session.title')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-7">
          <div className="field-group">
            <label>
              <span>{t('create.session.nameLabel')}</span>
              <input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder={t('create.session.namePlaceholder')}
                autoFocus
              />
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isCreating}
            >
              {t('create.session.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating || !title.trim()}
            >
              <Plus size={16} />
              {isCreating ? t('create.session.submitting') : t('create.session.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
