import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Download, Plus, ShieldCheck, Table, Upload, Zap } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ImportModal from '../components/ImportModal';
import PageHeader from '../components/PageHeader';
import CardsToolbar, { type FilterKey, type SortKey } from '../components/session/CardsToolbar';
import BulkActionBar from '../components/session/BulkActionBar';
import CardRow from '../components/session/CardRow';
import AddCardModal, { type CardDraftInput } from '../components/session/AddCardModal';
import PracticeSetupModal from '../components/session/PracticeSetupModal';
import { useInfiniteReveal } from '../hooks/useInfiniteReveal';
import { useFormatters } from '../lib/format';
import type { Card, SessionDetailResponse } from '../types';

const CARD_BATCH_SIZE = 10;

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation('session');
  const { date } = useFormatters();

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showPractice, setShowPractice] = useState(false);

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

  const resetKey = `${filter}|${query}|${sort}|${sortedFilteredCards.length}`;
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
    if (!confirm(t('detail.deleteCardConfirm'))) {
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
    if (!confirm(t('detail.deleteBulkConfirm', { count: selectedIds.size }))) {
      return;
    }

    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((cardId) => api.delete(`/cards/${cardId}`)));
    setCards((current) => current.filter((card) => !selectedIds.has(card.id)));
    setSelectedIds(new Set());
  };

  if (loading) {
    return <div className="app-shell center-block">{t('detail.loading')}</div>;
  }

  const createdLabel = detail ? date(detail.session.created_at) : '';

  return (
    <div className="page-shell">
      <PageHeader user={user} onLogout={handleLogout} />

      <div className="page-toolbar flex items-center">
        <Link to="/sessions" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft size={16} />
          {t('detail.backToSessions')}
        </Link>
      </div>

      <main className="page-container compact">
        <section className="rounded-xl border border-hairline bg-surface-card p-4 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded bg-primary/10 px-2.5 py-1 text-caption-uppercase font-bold uppercase tracking-wider text-primary">
                  {t('detail.badge')}
                </span>
                {detail && <span className="font-mono text-code-sm text-muted">{t('detail.createdLabel', { date: createdLabel })}</span>}
              </div>

              <h1 className="m-0 text-headline-md font-medium tracking-tight text-ink sm:text-headline-lg sm:font-medium sm:tracking-tight">
                {detail?.session.title || t('detail.titleFallback')}
              </h1>

              <div className="pt-2">
                <div className="mb-2 flex flex-col items-start justify-between gap-1 text-body-sm lg:flex-row lg:items-center">
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    <ShieldCheck size={18} className="text-secondary" />
                    {t('detail.masteryProgress')}
                  </span>
                  <span className="font-mono text-code-sm text-body">
                    <strong className="font-semibold text-primary">
                      {t('detail.learnedOf', { learned: learnedCount, total: cards.length })}
                    </strong>{' '}
                    (<span className="font-semibold text-ink">{progressPercent}%</span>)
                  </span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPercent < 33 ? 'bg-error' : progressPercent < 67 ? 'bg-primary' : 'bg-success'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2.5 pt-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:self-start lg:pt-0">
              {cards.length > 0 && (
                <Link
                  to={`/sessions/${id}/study`}
                  className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active sm:col-auto sm:h-10"
                >
                  <BookOpen size={18} />
                  {t('detail.studyDeck')}
                </Link>
              )}
              {cards.length >= 4 && (
                <button
                  type="button"
                  onClick={() => setShowPractice(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft sm:h-10"
                >
                  <Zap size={18} className="text-secondary" />
                  {t('detail.quickPractice')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface-card px-3.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft sm:h-10"
              >
                <Upload size={18} className="text-muted" />
                {t('detail.import')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-3.5 text-body-sm font-medium text-surface-card transition-colors hover:bg-ink/85 sm:h-10 ${
                  cards.length >= 4 ? 'col-span-2 sm:col-auto' : ''
                }`}
              >
                <Plus size={18} />
                {t('detail.addCard')}
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
              <h3>{t('detail.emptyTitle')}</h3>
              <p>{t('detail.emptyBody')}</p>
            </div>
          ) : sortedFilteredCards.length === 0 ? (
            <div className="empty-state sofa">
              <h3>{t('detail.emptyFilteredTitle')}</h3>
              <p>{t('detail.emptyFilteredBody')}</p>
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

        <aside className="flex flex-col items-start gap-4 rounded-xl bg-surface-container p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card text-primary">
              <Table size={22} />
            </span>
            <div>
              <h4 className="m-0 text-title-sm text-ink">{t('detail.bulkImportTitle')}</h4>
              <p className="m-0 text-body-sm text-body">
                {t('detail.bulkImportBody')}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <a
              href="/api/cards/template/download"
              className="inline-flex items-center gap-1.5 py-2.5 text-body-sm font-medium text-ink transition-colors hover:text-primary sm:py-0"
            >
              <Download size={16} />
              {t('detail.downloadTemplate')}
            </a>
            <span className="text-hairline-strong">·</span>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="rounded-lg bg-surface-card px-3 py-2.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft sm:py-1.5"
            >
              {t('detail.openImporter')}
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

      <PracticeSetupModal
        isOpen={showPractice}
        sessionId={id || ''}
        cards={cards}
        onClose={() => setShowPractice(false)}
      />
    </div>
  );
}
