import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Plus, RotateCcw, BookOpen, Upload, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ImportModal from '../components/ImportModal';
import type { Card, SessionDetailResponse } from '../types';

const defaultCard = {
  card_type: 'vocab' as const,
  front_text: '',
  front_phonetic: '',
  back_text: '',
  example: '',
  is_learned: false,
  position: 0,
  synonyms: [{ word: '', phonetic: '' }],
};

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [draft, setDraft] = useState(defaultCard);

  const fetchDetail = async () => {
    if (!id) {
      return;
    }

    const response = await api.get(`/sessions/${id}`);
    setDetail(response.data);
    setCards(response.data.cards || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchDetail();
  }, [id]);

  const learnedCount = useMemo(() => cards.filter((card) => card.is_learned).length, [cards]);

  const handleCreateCard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || !draft.front_text || !draft.back_text) {
      return;
    }

    const payload = {
      ...draft,
      front_text: draft.front_text.trim(),
      back_text: draft.back_text.trim(),
      front_phonetic: draft.front_phonetic?.trim() || null,
      example: draft.example?.trim() || null,
      synonyms: draft.synonyms
        .filter((item) => item.word.trim())
        .map((item) => ({ word: item.word.trim(), phonetic: item.phonetic?.trim() || null })),
    };

    const response = await api.post(`/sessions/${id}/cards`, payload);
    setCards((current) => [...current, response.data]);
    setDraft(defaultCard);
    setShowForm(false);
    if (detail) {
      setDetail({ ...detail, cards: [...detail.cards, response.data] });
    }
  };

  const toggleLearned = async (cardId: string, value: boolean) => {
    const response = await api.patch(`/cards/${cardId}/learned`, { is_learned: value });
    setCards((current) => current.map((card) => (card.id === cardId ? response.data : card)));
  };

  const deleteCard = async (cardId: string) => {
    if (!confirm('Delete this card?')) {
      return;
    }

    await api.delete(`/cards/${cardId}`);
    setCards((current) => current.filter((card) => card.id !== cardId));
  };

  const updateSynonymField = (index: number, field: 'word' | 'phonetic', value: string) => {
    setDraft((current) => ({
      ...current,
      synonyms: current.synonyms.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addSynonymRow = () => {
    setDraft((current) => ({
      ...current,
      synonyms: [...current.synonyms, { word: '', phonetic: '' }],
    }));
  };

  if (loading) {
    return <div className="app-shell center-block">Loading session…</div>;
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-row">
          <Link to="/" className="inline-link">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {cards.length > 0 && (
            <Link to={`/sessions/${id}/study`} className="btn btn-secondary">
              <BookOpen size={16} />
              Study
            </Link>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={16} />
            Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Add card
          </button>
        </div>
      </header>

      <main className="page-container compact">
        <section className="hero-card session-hero">
          <div>
            <p className="eyebrow">Session detail</p>
            <h1 className="display-title">{detail?.session.title || 'Session'}</h1>
          </div>

          <div className="progress-box">
            <span>{learnedCount}/{cards.length} learned</span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${cards.length ? (learnedCount / cards.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </section>

        {showForm && (
          <form onSubmit={handleCreateCard} className="editor-panel">
            <div className="editor-grid">
              <label className="field-group">
                <span>Front text</span>
                <input
                  value={draft.front_text}
                  onChange={(event) => setDraft({ ...draft, front_text: event.target.value })}
                  placeholder="abundant"
                />
              </label>

              <label className="field-group">
                <span>Phonetic</span>
                <input
                  value={draft.front_phonetic}
                  onChange={(event) => setDraft({ ...draft, front_phonetic: event.target.value })}
                  placeholder="/əˈbʌndənt/"
                />
              </label>

              <label className="field-group full-width">
                <span>Back text</span>
                <textarea
                  value={draft.back_text}
                  onChange={(event) => setDraft({ ...draft, back_text: event.target.value })}
                  placeholder="dồi dào, phong phú"
                />
              </label>

              <label className="field-group full-width">
                <span>Example</span>
                <textarea
                  value={draft.example}
                  onChange={(event) => setDraft({ ...draft, example: event.target.value })}
                  placeholder="The region has abundant natural resources."
                />
              </label>
            </div>

            <div className="synonym-block">
              <div className="synonym-header">
                <span>Synonyms</span>
                <button type="button" className="btn btn-secondary small" onClick={addSynonymRow}>
                  <Plus size={14} />
                  Add
                </button>
              </div>

              {draft.synonyms.map((synonym, index) => (
                <div key={index} className="synonym-row">
                  <input
                    value={synonym.word}
                    onChange={(event) => updateSynonymField(index, 'word', event.target.value)}
                    placeholder="Word"
                  />
                  <input
                    value={synonym.phonetic || ''}
                    onChange={(event) => updateSynonymField(index, 'phonetic', event.target.value)}
                    placeholder="Phonetic"
                  />
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                <RotateCcw size={15} />
                Close
              </button>
              <button type="submit" className="btn btn-primary">
                Save card
              </button>
            </div>
          </form>
        )}

        <section className="card-list">
          {cards.length === 0 ? (
            <div className="empty-state sofa">
              <h3>No cards yet</h3>
              <p>Add your first flashcard to start studying this session.</p>
            </div>
          ) : (
            cards.map((card) => (
              <article key={card.id} className={`card-row ${card.is_learned ? 'is-learned' : ''}`}>
                <div className="card-row-top">
                  <span className="badge tone-dark">{card.card_type}</span>
                  <div className="flex gap-2 items-center">
                    <button
                      type="button"
                      className={`learn-toggle ${card.is_learned ? 'active' : ''}`}
                      onClick={() => toggleLearned(card.id, !card.is_learned)}
                    >
                      <CheckCircle2 size={15} />
                      {card.is_learned ? 'Learned' : 'Mark learned'}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => deleteCard(card.id)}
                      title="Delete card"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="card-preview-grid">
                  <div>
                    <p className="meta-label">Front</p>
                    <h3>{card.front_text}</h3>
                    {card.front_phonetic && <p className="meta-sub">{card.front_phonetic}</p>}
                  </div>
                  <div>
                    <p className="meta-label">Back</p>
                    <h3>{card.back_text}</h3>
                  </div>
                </div>

                {card.synonyms.length > 0 && (
                  <div className="synonym-list">
                    {card.synonyms.map((synonym) => (
                      <span key={synonym.id} className="synonym-tag">
                        {synonym.word}
                        {synonym.phonetic ? ` /${synonym.phonetic}/` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </main>

      {showImport && id && (
        <ImportModal
          sessionId={id}
          onSuccess={() => {
            setShowImport(false);
            void fetchDetail();
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
