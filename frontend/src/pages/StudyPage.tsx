import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Circle, RotateCcw, Settings, Shuffle, Volume2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import type { Card, SessionDetailResponse } from '../types';

type FilterMode = 'all' | 'unlearned' | 'learned';

type DisplayConfig = {
  phonetic: boolean;
  synonyms: boolean;
  example: boolean;
};

const DISPLAY_CONFIG_KEY = 'studyCardDisplayConfig';
const defaultDisplayConfig: DisplayConfig = { phonetic: true, synonyms: true, example: true };

const loadDisplayConfig = (): DisplayConfig => {
  try {
    const raw = localStorage.getItem(DISPLAY_CONFIG_KEY);
    if (!raw) {
      return defaultDisplayConfig;
    }

    return { ...defaultDisplayConfig, ...JSON.parse(raw) };
  } catch {
    return defaultDisplayConfig;
  }
};

type VoiceGender = 'male' | 'female';

const VOICE_GENDER_KEY = 'studyVoiceGender';

const loadVoiceGender = (): VoiceGender => {
  try {
    const raw = localStorage.getItem(VOICE_GENDER_KEY);
    return raw === 'male' ? 'male' : 'female';
  } catch {
    return 'female';
  }
};

const FEMALE_VOICE_HINTS = ['female', 'zira', 'susan', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'catherine', 'aria', 'jenny', 'hazel'];
const MALE_VOICE_HINTS = ['male', 'david', 'mark', 'daniel', 'alex', 'fred', 'george', 'james', 'ryan', 'guy', 'tom', 'eric'];

type VoiceAccent = 'en-US' | 'en-GB';

const VOICE_ACCENT_KEY = 'studyVoiceAccent';

const loadVoiceAccent = (): VoiceAccent => {
  try {
    const raw = localStorage.getItem(VOICE_ACCENT_KEY);
    return raw === 'en-GB' ? 'en-GB' : 'en-US';
  } catch {
    return 'en-US';
  }
};

type VoicePick = {
  voice: SpeechSynthesisVoice | null;
  exactMatch: boolean;
};

function pickVoice(voices: SpeechSynthesisVoice[], gender: VoiceGender, accent: VoiceAccent): VoicePick {
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const accentVoices = englishVoices.filter((v) => v.lang.toLowerCase() === accent.toLowerCase());
  const hints = gender === 'female' ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;
  const matchesGender = (v: SpeechSynthesisVoice) => hints.some((hint) => new RegExp(`\\b${hint}\\b`, 'i').test(v.name));

  // Best case: right accent AND right gender.
  const exactMatch = accentVoices.find(matchesGender);
  if (exactMatch) {
    return { voice: exactMatch, exactMatch: true };
  }

  // No voice for this accent has the requested gender — keep the accent
  // (e.g. fall back to a UK female voice rather than switch to a US male one).
  if (accentVoices.length > 0) {
    return { voice: accentVoices[0], exactMatch: false };
  }

  // No voice at all for this accent — try to at least keep the gender.
  const genderMatch = englishVoices.find(matchesGender);
  if (genderMatch) {
    return { voice: genderMatch, exactMatch: false };
  }

  return { voice: englishVoices[0] || voices[0] || null, exactMatch: false };
}

const TOOL_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 py-1.5 text-body-sm text-body transition-colors hover:bg-canvas-soft hover:text-ink';

const TOOL_BUTTON_ACTIVE_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-hairline-strong bg-canvas-soft px-3 py-1.5 text-body-sm font-semibold text-ink transition-colors';

const EYEBROW_CLASS = 'text-caption-uppercase uppercase text-muted';

export default function StudyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(loadDisplayConfig);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(loadVoiceGender);
  const [voiceAccent, setVoiceAccent] = useState<VoiceAccent>(loadVoiceAccent);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showSpeakerSettings, setShowSpeakerSettings] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const displaySettingsRef = useRef<HTMLDivElement>(null);
  const speakerSettingsRef = useRef<HTMLDivElement>(null);
  const voiceToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (voiceToastTimeoutRef.current) {
        clearTimeout(voiceToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(VOICE_GENDER_KEY, voiceGender);
  }, [voiceGender]);

  useEffect(() => {
    localStorage.setItem(VOICE_ACCENT_KEY, voiceAccent);
  }, [voiceAccent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    localStorage.setItem(DISPLAY_CONFIG_KEY, JSON.stringify(displayConfig));
  }, [displayConfig]);

  useEffect(() => {
    if (!showDisplaySettings) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (displaySettingsRef.current && !displaySettingsRef.current.contains(e.target as Node)) {
        setShowDisplaySettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDisplaySettings]);

  useEffect(() => {
    if (!showSpeakerSettings) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (speakerSettingsRef.current && !speakerSettingsRef.current.contains(e.target as Node)) {
        setShowSpeakerSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeakerSettings]);

  const toggleDisplayField = useCallback((field: keyof DisplayConfig) => {
    setDisplayConfig((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

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

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const showVoiceToast = useCallback((message: string) => {
    if (voiceToastTimeoutRef.current) {
      clearTimeout(voiceToastTimeoutRef.current);
    }

    setVoiceToast(message);
    voiceToastTimeoutRef.current = setTimeout(() => setVoiceToast(null), 3500);
  }, []);

  const handleSpeak = useCallback((text: string) => {
    if (!speechSupported || !text) {
      return;
    }

    const spokenText = text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!spokenText) {
      return;
    }

    const { voice, exactMatch } = pickVoice(voices, voiceGender, voiceAccent);

    if (!exactMatch) {
      const genderLabel = voiceGender === 'female' ? 'nữ' : 'nam';
      const accentLabel = voiceAccent === 'en-GB' ? 'UK' : 'US';
      showVoiceToast(`Không tìm thấy giọng ${genderLabel} cho accent ${accentLabel}, đang dùng giọng thay thế.`);
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = voiceAccent;

    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }, [speechSupported, voices, voiceGender, voiceAccent, showVoiceToast]);

  const filteredCards = useMemo(() => {
    const cardList = cards || [];

    if (filter === 'unlearned') {
      return cardList.filter((card) => !card.is_learned);
    }

    if (filter === 'learned') {
      return cardList.filter((card) => card.is_learned);
    }

    return cardList;
  }, [cards, filter]);

  const displayedCards = useMemo(() => {
    if (!shuffleEnabled) {
      return filteredCards;
    }

    const shuffled = [...filteredCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCards, shuffleEnabled, shuffleSeed]);

  const handleToggleShuffle = useCallback(() => {
    setShuffleEnabled((prev) => !prev);
    setShuffleSeed((prev) => prev + 1);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  const currentCard = displayedCards[currentIndex] || null;
  const learnedCount = useMemo(() => cards.filter((card) => card.is_learned).length, [cards]);

  const filterCounts = useMemo(
    () => ({
      all: cards.length,
      unlearned: cards.length - learnedCount,
      learned: learnedCount,
    }),
    [cards.length, learnedCount],
  );

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < displayedCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, displayedCards.length]);

  const toggleLearned = async (cardId: string, value: boolean) => {
    try {
      await api.patch(`/cards/${cardId}/learned`, { is_learned: value });
      setCards((current) =>
        current.map((card) => (card.id === cardId ? { ...card, is_learned: value } : card)),
      );
    } catch (error) {
      console.error('Failed to update card:', error);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsFlipped((current) => !current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return <div className="app-shell center-block">Loading session…</div>;
  }

  if (!detail) {
    return <div className="app-shell center-block">Session not found</div>;
  }

  return (
    <div className="page-shell bg-canvas">
      <PageHeader user={user} onLogout={handleLogout} />

      {voiceToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fadeIn rounded-xl bg-ink px-4 py-3 text-body-sm font-semibold text-white shadow-lg">
          {voiceToast}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-margin py-space-xl max-sm:px-space-md">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-space-md">
      {/* Top Bar */}
      <header className="flex flex-col gap-space-md flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <Link
            to={`/sessions/${id}`}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-card px-3 py-1.5 text-body-sm text-body transition-colors hover:bg-canvas-soft hover:text-ink"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Session detail
          </Link>

          <div className="inline-flex items-center gap-space-xs rounded-xl bg-hairline-soft p-1">
            {(['all', 'unlearned', 'learned'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={filter === mode}
                className={`rounded-lg px-3 py-1.5 text-body-sm capitalize transition-colors ${
                  filter === mode
                    ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                    : 'text-body hover:text-ink'
                }`}
                onClick={() => {
                  setFilter(mode);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
              >
                {mode}
                <span
                  className={`ml-1.5 font-mono text-code-sm ${
                    mode === 'learned' ? 'text-secondary' : 'text-muted-soft'
                  }`}
                >
                  {filterCounts[mode]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={TOOL_BUTTON_CLASS}
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              title="Back to first card"
            >
              <RotateCcw size={16} />
              <span className="max-sm:hidden">Start</span>
            </button>

            <button
              type="button"
              className={shuffleEnabled ? TOOL_BUTTON_ACTIVE_CLASS : TOOL_BUTTON_CLASS}
              onClick={handleToggleShuffle}
              title={shuffleEnabled ? 'Turn off shuffle' : 'Shuffle card order'}
            >
              <Shuffle size={16} />
              <span className="max-sm:hidden">Shuffle</span>
            </button>

            {speechSupported && (
              <div className="relative" ref={speakerSettingsRef}>
                <button
                  type="button"
                  className={showSpeakerSettings ? TOOL_BUTTON_ACTIVE_CLASS : TOOL_BUTTON_CLASS}
                  onClick={() => setShowSpeakerSettings((current) => !current)}
                  title="Configure pronunciation voice"
                >
                  <Volume2 size={16} />
                  <span className="max-sm:hidden">Speaker</span>
                </button>

                {showSpeakerSettings && (
                  <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col gap-space-md rounded-xl border border-hairline bg-surface-card p-space-md shadow-lg">
                    <div>
                      <p className={`${EYEBROW_CLASS} mb-2`}>Voice</p>
                      <div className="flex items-center gap-space-xs rounded-lg bg-hairline-soft p-1">
                        {(['female', 'male'] as const).map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            aria-pressed={voiceGender === gender}
                            className={`flex-1 rounded px-3 py-1.5 text-body-sm transition-colors ${
                              voiceGender === gender
                                ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                                : 'text-body hover:text-ink'
                            }`}
                            onClick={() => setVoiceGender(gender)}
                            title={gender === 'female' ? 'Female voice' : 'Male voice'}
                          >
                            {gender === 'female' ? 'Nữ' : 'Nam'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className={`${EYEBROW_CLASS} mb-2`}>Accent</p>
                      <div className="flex items-center gap-space-xs rounded-lg bg-hairline-soft p-1">
                        {(['en-US', 'en-GB'] as const).map((accent) => (
                          <button
                            key={accent}
                            type="button"
                            aria-pressed={voiceAccent === accent}
                            className={`flex-1 rounded px-3 py-1.5 font-mono text-code-sm transition-colors ${
                              voiceAccent === accent
                                ? 'bg-surface-card font-semibold text-ink ring-1 ring-hairline'
                                : 'text-body hover:text-ink'
                            }`}
                            onClick={() => setVoiceAccent(accent)}
                            title={accent === 'en-US' ? 'US pronunciation' : 'UK pronunciation'}
                          >
                            {accent === 'en-US' ? 'US' : 'UK'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={displaySettingsRef}>
              <button
                type="button"
                className={showDisplaySettings ? TOOL_BUTTON_ACTIVE_CLASS : TOOL_BUTTON_CLASS}
                onClick={() => setShowDisplaySettings((current) => !current)}
                title="Configure card fields"
              >
                <Settings size={16} />
                <span className="max-sm:hidden">Display</span>
              </button>

              {showDisplaySettings && (
                <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col gap-space-sm rounded-xl border border-hairline bg-surface-card p-space-md shadow-lg">
                  <p className={EYEBROW_CLASS}>Show on card</p>
                  {(
                    [
                      ['phonetic', 'Phonetic'],
                      ['synonyms', 'Synonyms'],
                      ['example', 'Example'],
                    ] as const
                  ).map(([field, label]) => (
                    <label
                      key={field}
                      className="flex cursor-pointer select-none items-center gap-space-sm text-body-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={displayConfig[field]}
                        onChange={() => toggleDisplayField(field)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <span className="rounded-lg bg-hairline-soft px-3 py-1.5 font-mono text-code-sm font-semibold text-ink">
              {learnedCount} / {cards.length}
            </span>
          </div>
        </div>
      </header>

          {/* Progress Bar */}
        <div className="flex flex-col gap-space-sm flex-shrink-0">
          <div className="flex items-baseline gap-space-sm">
            <span className="font-mono text-title-sm text-ink">
              {filteredCards.length === 0 ? 0 : currentIndex + 1} / {filteredCards.length}
            </span>
            <span className="text-body-sm text-muted">{detail.session.title}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline-soft">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width:
                  filteredCards.length === 0
                    ? '0%'
                    : `${((currentIndex + 1) / filteredCards.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Study Area */}
        {filteredCards.length === 0 ? (
          <div className="flex min-h-[440px] items-center justify-center rounded-2xl border border-hairline bg-surface-card">
            <p className="text-body-md text-muted">No cards to study in this filter.</p>
          </div>
        ) : currentCard ? (
          <div className="flex flex-col gap-space-md">
            <div
              className="perspective min-h-[440px] cursor-pointer transition-transform duration-500 md:min-h-[480px]"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
              onClick={() => setIsFlipped((current) => !current)}
            >
              <div className="relative h-full min-h-[440px] w-full md:min-h-[480px]" style={{ transformStyle: 'preserve-3d' }}>
                {/* Front */}
                <div
                  className="absolute inset-0 flex h-full flex-col rounded-2xl border border-hairline bg-surface-card p-space-lg sm:p-10"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-sm transition-colors ${
                        currentCard.is_learned
                          ? 'bg-learned-surface text-secondary'
                          : 'bg-hairline-soft text-muted hover:text-ink'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleLearned(currentCard.id, !currentCard.is_learned);
                      }}
                    >
                      {currentCard.is_learned ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      {currentCard.is_learned ? 'Learned' : 'Mark learned'}
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-hairline bg-canvas-soft px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-hairline-soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(true);
                      }}
                    >
                      Flip
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center gap-space-sm text-center">
                    <div className="flex items-center gap-space-sm">
                      <h2 className="break-words text-headline-lg text-ink sm:text-display-hero">
                        {currentCard.front_text}
                      </h2>
                      {speechSupported && (
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas-soft text-body transition-colors hover:bg-hairline-soft hover:text-ink"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(currentCard.front_text);
                          }}
                          title="Play pronunciation"
                        >
                          <Volume2 size={18} />
                        </button>
                      )}
                    </div>
                    {displayConfig.phonetic && currentCard.front_phonetic && (
                      <p className="font-mono text-code-phonetic text-muted">{currentCard.front_phonetic}</p>
                    )}
                  </div>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 flex h-full flex-col items-center justify-center overflow-y-auto rounded-2xl border border-hairline bg-surface-card p-space-lg sm:p-10"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="absolute top-space-lg left-space-lg right-space-lg flex items-center justify-between sm:top-10 sm:left-10 sm:right-10">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-sm transition-colors ${
                        currentCard.is_learned
                          ? 'bg-learned-surface text-secondary'
                          : 'bg-hairline-soft text-muted hover:text-ink'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleLearned(currentCard.id, !currentCard.is_learned);
                      }}
                    >
                      {currentCard.is_learned ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      {currentCard.is_learned ? 'Learned' : 'Mark learned'}
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-hairline bg-canvas-soft px-3 py-1.5 text-body-sm text-ink transition-colors hover:bg-hairline-soft"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(false);
                      }}
                    >
                      Flip back
                    </button>
                  </div>

                  <div className="flex w-full flex-col items-center gap-space-lg">
                    <h2 className="break-words text-center text-headline-lg text-ink">
                      {currentCard.back_text}
                    </h2>

                    {displayConfig.synonyms && currentCard.synonyms.length > 0 && (
                      <div>
                        <p className={`${EYEBROW_CLASS} mb-2`}>Synonyms</p>
                        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
                          {currentCard.synonyms.map((synonym) => (
                            <div key={synonym.id} className="rounded-xl bg-canvas-soft p-3">
                              <p className="text-title-sm text-ink">{synonym.word}</p>
                              {synonym.phonetic && (
                                <p className="mt-1 font-mono text-code-sm text-muted-soft" title={synonym.phonetic}>
                                  {synonym.phonetic}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {displayConfig.example && currentCard.example && (
                      <div className="rounded-xl bg-canvas-soft p-space-md">
                        <p className={`${EYEBROW_CLASS} mb-2`}>Example</p>
                        <p className="text-body-md leading-relaxed text-ink">{currentCard.example}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-space-md">
              <button
                type="button"
                className="inline-flex items-center gap-space-sm rounded-lg border border-hairline-strong bg-surface-card px-4 py-2.5 text-body-sm font-medium text-ink transition-colors hover:bg-canvas-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-card"
                disabled={currentIndex === 0}
                onClick={handlePrev}
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              <span className="font-mono text-code-sm text-muted">
                {currentIndex + 1} of {filteredCards.length}
              </span>

              <button
                type="button"
                className="inline-flex items-center gap-space-sm rounded-lg bg-primary px-5 py-2.5 text-body-sm font-medium text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
                disabled={currentIndex >= filteredCards.length - 1}
                onClick={handleNext}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Keyboard Hints */}
            <div className="flex justify-center">
              <p className="inline-flex flex-wrap items-center justify-center gap-space-sm rounded-full bg-canvas-soft px-4 py-2 text-body-sm text-muted">
                <span>💡</span>
                <span>
                  <span className="font-mono text-code-sm text-body">Space</span> to flip
                </span>
                <span aria-hidden="true">•</span>
                <span>
                  <span className="font-mono text-code-sm text-body">← →</span> arrow keys to navigate
                </span>
              </p>
            </div>
          </div>
        ) : null}
        </div>
      </main>
    </div>
  );
}
