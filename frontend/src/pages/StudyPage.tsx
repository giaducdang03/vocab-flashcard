import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Filter, Settings, Shuffle, Volume2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
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

function pickVoice(voices: SpeechSynthesisVoice[], gender: VoiceGender, accent: VoiceAccent): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const accentVoices = englishVoices.filter((v) => v.lang.toLowerCase() === accent.toLowerCase());
  const pool = accentVoices.length > 0 ? accentVoices : englishVoices;
  const hints = gender === 'female' ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS;

  const match = pool.find((v) => hints.some((hint) => v.name.toLowerCase().includes(hint)));
  if (match) {
    return match;
  }

  return pool[0] || voices[0] || null;
}

export default function StudyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const displaySettingsRef = useRef<HTMLDivElement>(null);
  const speakerSettingsRef = useRef<HTMLDivElement>(null);

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
    void fetchDetail();
  }, [id]);

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleSpeak = useCallback((text: string) => {
    if (!speechSupported || !text) {
      return;
    }

    const spokenText = text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!spokenText) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = voiceAccent;

    const voice = pickVoice(voices, voiceGender, voiceAccent);
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }, [speechSupported, voices, voiceGender, voiceAccent]);

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

  if (loading) {
    return <div className="app-shell center-block">Loading session…</div>;
  }

  if (!detail) {
    return <div className="app-shell center-block">Session not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-canvas to-amber-100/20 py-6 px-5">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 h-[calc(100vh-48px)]">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-4 border-b border-hairline pb-4 flex-shrink-0">
        <Link to={`/sessions/${id}`} className="inline-flex items-center gap-2 text-ink font-semibold hover:text-primary transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">Session detail</span>
        </Link>

        <div className="flex items-center gap-1 bg-surface-strong rounded-xl p-1 flex-shrink-0">
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === 'all'
                ? 'bg-white text-ink'
                : 'bg-transparent text-muted'
            }`}
            onClick={() => {
              setFilter('all');
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
          >
            <Filter size={14} />
            All
          </button>
          <button
            type="button"
            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === 'unlearned'
                ? 'bg-white text-ink'
                : 'bg-transparent text-muted'
            }`}
            onClick={() => {
              setFilter('unlearned');
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
          >
            Unlearned
          </button>
          <button
            type="button"
            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === 'learned'
                ? 'bg-white text-ink'
                : 'bg-transparent text-muted'
            }`}
            onClick={() => {
              setFilter('learned');
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
          >
            Learned
          </button>
        </div>

        <button
          type="button"
          className="px-3 py-1 text-xs font-semibold text-muted border border-hairline rounded-lg hover:border-primary hover:text-primary transition-all flex-shrink-0"
          onClick={() => {
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          title="Back to first card"
        >
          ↻ Start
        </button>

        <button
          type="button"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex-shrink-0 ${
            shuffleEnabled ? 'bg-white border-primary text-primary' : 'border-hairline text-muted hover:border-primary hover:text-primary'
          }`}
          onClick={handleToggleShuffle}
          title={shuffleEnabled ? 'Turn off shuffle' : 'Shuffle card order'}
        >
          <Shuffle size={16} />
          Shuffle
        </button>

        {speechSupported && (
          <div className="relative flex-shrink-0" ref={speakerSettingsRef}>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                showSpeakerSettings ? 'bg-white border-primary text-primary' : 'border-hairline text-muted hover:border-primary hover:text-primary'
              }`}
              onClick={() => setShowSpeakerSettings((current) => !current)}
              title="Configure pronunciation voice"
            >
              <Volume2 size={16} />
              Speaker
            </button>

            {showSpeakerSettings && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-hairline rounded-xl shadow-lg p-3 z-10 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Voice</p>
                  <div className="flex items-center gap-1 bg-surface-strong rounded-xl p-1">
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        voiceGender === 'female' ? 'bg-white text-ink' : 'bg-transparent text-muted'
                      }`}
                      onClick={() => setVoiceGender('female')}
                      title="Female voice"
                    >
                      Nữ
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        voiceGender === 'male' ? 'bg-white text-ink' : 'bg-transparent text-muted'
                      }`}
                      onClick={() => setVoiceGender('male')}
                      title="Male voice"
                    >
                      Nam
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Accent</p>
                  <div className="flex items-center gap-1 bg-surface-strong rounded-xl p-1">
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        voiceAccent === 'en-US' ? 'bg-white text-ink' : 'bg-transparent text-muted'
                      }`}
                      onClick={() => setVoiceAccent('en-US')}
                      title="US pronunciation"
                    >
                      US
                    </button>
                    <button
                      type="button"
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        voiceAccent === 'en-GB' ? 'bg-white text-ink' : 'bg-transparent text-muted'
                      }`}
                      onClick={() => setVoiceAccent('en-GB')}
                      title="UK pronunciation"
                    >
                      UK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative flex-shrink-0" ref={displaySettingsRef}>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
              showDisplaySettings ? 'bg-white border-primary text-primary' : 'border-hairline text-muted hover:border-primary hover:text-primary'
            }`}
            onClick={() => setShowDisplaySettings((current) => !current)}
            title="Configure card fields"
          >
            <Settings size={16} />
            Display
          </button>

          {showDisplaySettings && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-hairline rounded-xl shadow-lg p-3 z-10 flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Show on card</p>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={displayConfig.phonetic}
                  onChange={() => toggleDisplayField('phonetic')}
                />
                Phonetic
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={displayConfig.synonyms}
                  onChange={() => toggleDisplayField('synonyms')}
                />
                Synonyms
              </label>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={displayConfig.example}
                  onChange={() => toggleDisplayField('example')}
                />
                Example
              </label>
            </div>
          )}
        </div>

        <div className="text-xs font-semibold text-body flex-shrink-0">
          {learnedCount}/{cards.length}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col gap-4">
        {/* Progress Bar */}
        <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold text-ink">
              {filteredCards.length === 0 ? 0 : currentIndex + 1} / {filteredCards.length}
            </span>
            <span className="text-sm text-body">{detail.session.title}</span>
          </div>
          <div className="w-full h-3 bg-hairline rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all"
              style={{
                width: filteredCards.length === 0 ? '0%' : `${((currentIndex + 1) / filteredCards.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Study Area */}
        {filteredCards.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-[#5a5852]">No cards to study in this filter.</p>
          </div>
        ) : currentCard ? (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Flashcard */}
            <div
              className={`flex-1 perspective cursor-pointer transition-transform duration-600 `}
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
              onClick={() => setIsFlipped((current) => !current)}
            >
              <div className="w-full h-full relative" style={{ transformStyle: 'preserve-3d' }}>
                {/* Front */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-white/98 to-amber-50/95 border-2 border-hairline rounded-2xl p-9 flex flex-col items-center justify-center"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        currentCard.is_learned
                          ? 'bg-green-100/40 border-green-300/40 text-success'
                          : 'border-hairline bg-transparent text-ink hover:border-primary'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleLearned(currentCard.id, !currentCard.is_learned);
                      }}
                    >
                      <CheckCircle2 size={18} />
                      {currentCard.is_learned ? 'Learned' : 'Not learned'}
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs font-semibold text-muted border border-hairline rounded-lg hover:border-primary hover:text-primary transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(true);
                      }}
                    >
                      Flip
                    </button>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-4 text-center w-full">
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl md:text-5xl font-light leading-tight tracking-tight text-ink break-words">
                        {currentCard.front_text}
                      </h2>
                      {speechSupported && (
                        <button
                          type="button"
                          className="w-10 h-10 shrink-0 rounded-full border border-hairline bg-white/70 text-ink hover:border-primary hover:text-primary transition-all flex items-center justify-center"
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
                      <p className="text-lg text-body font-mono">{currentCard.front_phonetic}</p>
                    )}
                  </div>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-orange-100/6 to-orange-200/4 border-2 border-hairline rounded-2xl p-9 flex flex-col items-center justify-center overflow-y-auto"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        currentCard.is_learned
                          ? 'bg-green-100/40 border-green-300/40 text-success'
                          : 'border-hairline bg-transparent text-ink hover:border-primary'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleLearned(currentCard.id, !currentCard.is_learned);
                      }}
                    >
                      <CheckCircle2 size={18} />
                      {currentCard.is_learned ? 'Learned' : 'Not learned'}
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs font-semibold text-muted border border-hairline rounded-lg hover:border-primary hover:text-primary transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(false);
                      }}
                    >
                      Flip back
                    </button>
                  </div>
                  <div className="flex flex-col items-center justify-start gap-4 w-full pt-12">
                    <h2 className="text-2xl md:text-3xl font-light leading-tight tracking-tight text-ink text-center break-words">
                      {currentCard.back_text}
                    </h2>

                    {displayConfig.synonyms && currentCard.synonyms.length > 0 && (
                      <div className="w-full bg-white/60 border border-hairline rounded-2xl p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Synonyms</p>
                        <div className="grid grid-cols-2 gap-2">
                          {currentCard.synonyms.map((synonym) => (
                            <div key={synonym.id} className="flex flex-col gap-1 p-2 bg-blue-100/8 border border-blue-300/20 rounded-xl text-sm">
                              <span className="font-semibold text-ink">{synonym.word}</span>
                              {synonym.phonetic && (
                                <span className="text-xs text-body font-mono" title={synonym.phonetic}>
                                  {synonym.phonetic}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {displayConfig.example && currentCard.example && (
                      <div className="w-full bg-white/60 border border-hairline rounded-2xl p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Example</p>
                        <p className="text-sm leading-relaxed text-ink italic">{currentCard.example}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-6 flex-shrink-0">
              <button
                type="button"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold transition-all ${
                  currentIndex === 0
                    ? 'bg-white text-ink border-hairline opacity-40 cursor-not-allowed'
                    : 'bg-white text-ink border-hairline hover:border-primary hover:-translate-y-0.5'
                }`}
                disabled={currentIndex === 0}
                onClick={handlePrev}
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              <span className="text-sm font-semibold text-body min-w-20 text-center">
                {currentIndex + 1} of {filteredCards.length}
              </span>

              <button
                type="button"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold transition-all ${
                  currentIndex >= filteredCards.length - 1
                    ? 'bg-white text-ink border-hairline opacity-40 cursor-not-allowed'
                    : 'bg-white text-ink border-hairline hover:border-primary hover:-translate-y-0.5'
                }`}
                disabled={currentIndex >= filteredCards.length - 1}
                onClick={handleNext}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Keyboard Hints */}
            <div className="text-center text-xs text-muted bg-white/50 rounded-xl p-3 flex-shrink-0">
              <p>💡 <span className="bg-black/8 px-1.5 py-0.5 rounded font-mono">Spacebar</span> to flip • <span className="bg-black/8 px-1.5 py-0.5 rounded font-mono">← →</span> arrow keys to navigate</p>
            </div>
          </div>
        ) : null}
      </main>
      </div>
    </div>
  );
}
