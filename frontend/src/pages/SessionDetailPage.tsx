import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Download, Plus, ShieldCheck, Table, Upload } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ImportModal from '../components/ImportModal';
import PageHeader from '../components/PageHeader';
import CardsToolbar, { type FilterKey, type SortKey } from '../components/session/CardsToolbar';
import BulkActionBar from '../components/session/BulkActionBar';
import CardRow from '../components/session/CardRow';
import AddCardModal, { type CardDraftInput } from '../components/session/AddCardModal';
import { useInfiniteReveal } from '../hooks/useInfiniteReveal';
import type { Card, SessionDetailResponse } from '../types';

const CARD_BATCH_SIZE = 10;

const formatCreatedAt = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('position');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    window.scrollTo(0, 0);
    void fetchDetail();
  }, [id]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const learnedCount = useMemo(() => cards.filter((card) => card.is_learned).length, [cards]);
  const progressPercent = cards.length ? Math.round((learnedCount / cards.length) * 100) : 0;

  const counts = useMemo(
    () => ({
      all: cards.length,
      vocab: cards.filter((card) => card.card_type === 'vocab').length,
      collocation: cards.filter((card) => card.card_type === 'collocation').length,
      unlearned: cards.filter((card) => !card.is_learned).length,
      learned: cards.filter((card) => card.is_learned).length,
    }),
    [cards],
  );

  const sortedFilteredCards = useMemo(() => {
    let list = cards;

    if (filter === 'vocab') {
      list = list.filter((card) => card.card_type === 'vocab');
    } else if (filter === 'collocation') {
      list = list.filter((card) => card.card_type === 'collocation');
    } else if (filter === 'unlearned') {
      list = list.filter((card) => !card.is_learned);
    } else if (filter === 'learned') {
      list = list.filter((card) => card.is_learned);
    }

    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (card) =>
          card.front_text.toLowerCase().includes(needle) ||
          card.back_text.toLowerCase().includes(needle) ||
          (card.front_phonetic ?? '').toLowerCase().includes(needle),
      );
    }

    const sorted = [...list];
    if (sort === 'alphabetical') {
      sorted.sort((a, b) => a.front_text.localeCompare(b.front_text));
    } else if (sort === 'recent') {
      sorted.reverse();
    }

    return sorted;
  }, [cards, filter, query, sort]);

  const resetKey = `${filter}|${query}|${sort}`;
  const { visibleCount, sentinelRef } = useInfiniteReveal(resetKey, sortedFilteredCards.length, CARD_BATCH_SIZE);
  const visibleCards = sortedFilteredCards.slice(0, visibleCount);

  const allSelected =
    sortedFilteredCards.length > 0 && sortedFilteredCards.every((card) => selectedIds.has(card.id));

  const toggleSelectCard = (cardId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sortedFilteredCards.map((card) => card.id)));
  };

  const handleCreateCard = async (draftInput: CardDraftInput) => {
    if (!id) {
      return;
    }

    const payload = {
      card_type: draftInput.card_type,
      front_text: draftInput.front_text.trim(),
      back_text: draftInput.back_text.trim(),
      front_phonetic: draftInput.front_phonetic.trim() || null,
      example: draftInput.example.trim() || null,
      is_learned: false,
      position: 0,
      synonyms: draftInput.synonyms
        .filter((item) => item.word.trim())
        .map((item) => ({ word: item.word.trim(), phonetic: item.phonetic.trim() || null })),
    };

    const response = await api.post(`/sessions/${id}/cards`, payload);
    setCards((current) => [...current, response.data]);
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
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
  };

  const handleBulkMarkLearned = async () => {
    const ids = Array.from(selectedIds);
    const responses = await Promise.all(
      ids.map((cardId) => api.patch(`/cards/${cardId}/learned`, { is_learned: true })),
    );
    setCards((current) =>
      current.map((card) => {
        const updated = responses.find((response) => response.data.id === card.id);
        return updated ? updated.data : card;
      }),
    );
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected card(s)?`)) {
      return;
    }

    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((cardId) => api.delete(`/cards/${cardId}`)));
    setCards((current) => current.filter((card) => !selectedIds.has(card.id)));
    setSelectedIds(new Set());
  };

  if (loading) {
    return <div className="app-shell center-block">Loading session…</div>;
  }

  const createdLabel = detail ? formatCreatedAt(detail.session.created_at) : '';

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <div className="page-toolbar flex items-center border-b border-hairline">
        <Link to="/" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </div>

      <main className="page-container compact">
        <section className="rounded-xl border border-hairline bg-surface-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
                  Session detail
                </span>
                {detail && <span className="font-mono text-code-sm text-muted">Created {createdLabel}</span>}
              </div>

              <h1 className="m-0 text-headline-lg font-medium tracking-tight text-ink">
                {detail?.session.title || 'Session'}
              </h1>

              <div className="pt-2">
                <div className="mb-2 flex items-center justify-between text-body-sm">
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    <ShieldCheck size={18} className="text-secondary" />
                    Mastery progress
                  </span>
                  <span className="font-mono text-code-sm text-body">
                    <strong className="font-semibold text-primary">{learnedCount}</strong> of {cards.length} learned (
                    <span className="font-semibold text-ink">{progressPercent}%</span>)
                  </span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start pt-2 lg:pt-0">
              {cards.length > 0 && (
                <Link
                  to={`/sessions/${id}/study`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
                >
                  <BookOpen size={18} />
                  Study deck
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
              >
                <Upload size={18} className="text-muted" />
                Import
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-3.5 text-body-sm font-medium text-surface-card transition-colors hover:bg-ink/85"
              >
                <Plus size={18} />
                Add card
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <CardsToolbar
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
            sort={sort}
            onSortChange={setSort}
          />

          {cards.length > 0 && (
            <BulkActionBar
              totalVisible={sortedFilteredCards.length}
              selectedCount={selectedIds.size}
              allSelected={allSelected}
              onToggleSelectAll={toggleSelectAll}
              onMarkLearned={handleBulkMarkLearned}
              onDelete={handleBulkDelete}
            />
          )}
        </section>

        <section className="space-y-4">
          {cards.length === 0 ? (
            <div className="empty-state sofa">
              <h3>No cards yet</h3>
              <p>Add your first flashcard to start studying this session.</p>
            </div>
          ) : sortedFilteredCards.length === 0 ? (
            <div className="empty-state sofa">
              <h3>No cards match your filters</h3>
              <p>Try a different search term or clear the active filter.</p>
            </div>
          ) : (
            <>
              {visibleCards.map((card, index) => (
                <CardRow
                  key={card.id}
                  card={card}
                  index={index}
                  selected={selectedIds.has(card.id)}
                  onToggleSelect={toggleSelectCard}
                  onToggleLearned={toggleLearned}
                  onDelete={deleteCard}
                />
              ))}
              {visibleCount < sortedFilteredCards.length && <div ref={sentinelRef} className="h-1" />}
            </>
          )}
        </section>

        <aside className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-container p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card text-primary">
              <Table size={22} />
            </span>
            <div>
              <h4 className="m-0 text-title-sm text-ink">Need to add many words at once?</h4>
              <p className="m-0 text-body-sm text-body">
                Use the bulk import tool with our standardized spreadsheet template to load 50+ definitions in seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/cards/template/download"
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink transition-colors hover:text-primary"
            >
              <Download size={16} />
              Download .xlsx template
            </a>
            <span className="text-hairline-strong">·</span>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="rounded-lg bg-surface-card px-3 py-1.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft"
            >
              Open Importer
            </button>
          </div>
        </aside>
      </main>

      {showAddModal && (
        <AddCardModal onSubmit={handleCreateCard} onClose={() => setShowAddModal(false)} />
      )}

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
