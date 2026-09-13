import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CardType } from '../../types';

export type CardDraftInput = {
  card_type: CardType;
  front_text: string;
  front_phonetic: string;
  back_text: string;
  example: string;
  synonyms: { word: string; phonetic: string }[];
};

const emptyDraft: CardDraftInput = {
  card_type: 'vocab',
  front_text: '',
  front_phonetic: '',
  back_text: '',
  example: '',
  synonyms: [{ word: '', phonetic: '' }],
};

type AddCardModalProps = {
  onSubmit: (draft: CardDraftInput) => Promise<void>;
  onClose: () => void;
};

export default function AddCardModal({ onSubmit, onClose }: AddCardModalProps) {
  const [draft, setDraft] = useState<CardDraftInput>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);

  const updateSynonym = (index: number, field: 'word' | 'phonetic', value: string) => {
    setDraft((current) => ({
      ...current,
      synonyms: current.synonyms.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addSynonymRow = () => {
    setDraft((current) => ({
      ...current,
      synonyms: [...current.synonyms, { word: '', phonetic: '' }],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.front_text.trim() || !draft.back_text.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(draft);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-[90vw] max-w-2xl flex-col rounded-3xl border border-hairline bg-canvas animate-slideUp"
      >
        <div className="flex items-center justify-between border-b border-hairline px-7 py-6">
          <h2 className="m-0 text-headline-md font-medium text-ink">Add card</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-ink transition-colors hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-7 py-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-body-sm text-ink">
              <span className="font-semibold">Front text</span>
              <input
                value={draft.front_text}
                onChange={(event) => setDraft({ ...draft, front_text: event.target.value })}
                placeholder="abundant"
                className="w-full rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="space-y-2 text-body-sm text-ink">
              <span className="font-semibold">Phonetic</span>
              <input
                value={draft.front_phonetic}
                onChange={(event) => setDraft({ ...draft, front_phonetic: event.target.value })}
                placeholder="/əˈbʌndənt/"
                className="w-full rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 font-mono text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="space-y-2 text-body-sm text-ink sm:col-span-2">
              <span className="font-semibold">Back text</span>
              <textarea
                value={draft.back_text}
                onChange={(event) => setDraft({ ...draft, back_text: event.target.value })}
                placeholder="dồi dào, phong phú"
                className="min-h-[72px] w-full resize-y rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="space-y-2 text-body-sm text-ink sm:col-span-2">
              <span className="font-semibold">Example</span>
              <textarea
                value={draft.example}
                onChange={(event) => setDraft({ ...draft, example: event.target.value })}
                placeholder="The region has abundant natural resources."
                className="min-h-[72px] w-full resize-y rounded-lg border border-hairline bg-surface-card px-3.5 py-2.5 text-ink outline-none focus:ring-1 focus:ring-ink"
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-hairline bg-surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-semibold text-ink">Synonyms</span>
              <button
                type="button"
                onClick={addSynonymRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-body-sm text-ink transition-colors hover:bg-canvas-soft"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {draft.synonyms.map((synonym, index) => (
              <div key={index} className="grid grid-cols-2 gap-3">
                <input
                  value={synonym.word}
                  onChange={(event) => updateSynonym(index, 'word', event.target.value)}
                  placeholder="Word"
                  className="w-full rounded-lg border border-hairline bg-canvas-soft px-3 py-2 text-ink outline-none focus:ring-1 focus:ring-ink"
                />
                <input
                  value={synonym.phonetic}
                  onChange={(event) => updateSynonym(index, 'phonetic', event.target.value)}
                  placeholder="Phonetic"
                  className="w-full rounded-lg border border-hairline bg-canvas-soft px-3 py-2 font-mono text-ink outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-hairline px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </form>
    </div>
  );
}
