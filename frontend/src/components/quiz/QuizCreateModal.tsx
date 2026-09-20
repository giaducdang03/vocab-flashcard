import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { apiErrorMessage } from '../../api/errors';
import type { Session, Quiz, QuestionType, QuizCapacity, AiStatus } from '../../types/index';
import { AI_QUESTION_TYPES, QUESTION_TYPE_HINTS, QUESTION_TYPE_LABELS } from '../../types/index';

type QuizCreateModalProps = {
  isOpen: boolean;
  sessions: Session[];
  onClose: () => void;
  onCreated: (quiz: Quiz) => void;
};

const QUESTION_COUNT_PRESETS = [5, 10, 20, 30, 50];

type ExplanationLanguage = 'vi' | 'en';
const EXPLANATION_LANGUAGES: { value: ExplanationLanguage; label: string }[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
];

export default function QuizCreateModal({
  isOpen,
  sessions,
  onClose,
  onCreated,
}: QuizCreateModalProps) {
  const { t, i18n } = useTranslation('quiz');
  const [step, setStep] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(['en_to_vi']);
  const [questionCount, setQuestionCount] = useState(10);
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState<QuizCapacity | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [explanationLanguage, setExplanationLanguage] = useState<ExplanationLanguage>(
    i18n.language.startsWith('vi') ? 'vi' : 'en',
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setSessionIds([]);
    setTypes(['en_to_vi']);
    setQuestionCount(10);
    setUseCustomCount(false);
    setTitle('');
    setCapacity(null);
    setError(null);
    setExplanationLanguage(i18n.language.startsWith('vi') ? 'vi' : 'en');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch capacity when step changes or dependencies update
  useEffect(() => {
    if (!isOpen || step === 0 || sessionIds.length === 0 || types.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await api.post<QuizCapacity>('/quizzes/capacity', {
          session_ids: sessionIds,
          question_types: types,
        });
        if (!cancelled) setCapacity(response.data);
      } catch {
        if (!cancelled) setCapacity(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, sessionIds, types]);

  useEffect(() => {
    if (!isOpen) return;

    api
      .get<AiStatus>('/quizzes/ai-status')
      .then((response) => setAiStatus(response.data))
      .catch(() => setAiStatus(null));
  }, [isOpen]);

  const canGoNext = () => {
    if (step === 0) return sessionIds.length > 0;
    if (step === 1) {
      const maxQuestions = capacity?.max_questions ?? 0;
      return (
        questionCount >= 1 && (maxQuestions === 0 || questionCount <= maxQuestions)
      );
    }
    if (step === 2) return types.length > 0;
    return title.trim().length > 0;
  };

  const handleSessionToggle = (sessionId: string) => {
    setSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleTypeToggle = (type: QuestionType) => {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const maxQuestions = capacity?.max_questions ?? questionCount;
      const response = await api.post<Quiz>('/quizzes', {
        title: title.trim(),
        session_ids: sessionIds,
        question_count: Math.min(questionCount, maxQuestions),
        question_types: types,
        explanation_language: explanationLanguage,
      });
      onCreated(response.data);
      onClose();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, t('create.createError')));
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const selectedSessionTitles = sessions
    .filter((s) => sessionIds.includes(s.id))
    .map((s) => s.title);

  const maxQuestions = capacity?.max_questions ?? 0;

  const availableTypes: QuestionType[] = aiStatus?.available && aiStatus.enabled_for_user
    ? ([
        'en_to_vi',
        'vi_to_en',
        'synonym',
        'cloze',
        'context',
        'verb_tense',
        'word_stress',
      ] as QuestionType[])
    : (['en_to_vi', 'vi_to_en', 'synonym'] as QuestionType[]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('create.title')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Wizard Steps */}
          <div className="wizard-steps">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className={`wizard-step ${step === i ? 'active' : ''}`}>
                  {i + 1}
                </div>
              </div>
            ))}
            <span className="flex-1" />
            <span>{t('create.step', { current: step + 1, total: 4 })}</span>
          </div>

          {/* Step 0: Select Sessions */}
          {step === 0 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>{t('create.sessions.label')}</span>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
                  {t('create.sessions.hint')}
                </p>
              </div>
              <div className="choice-list">
                {sessions.map((session) => (
                  <label
                    key={session.id}
                    className={`choice-row ${
                      sessionIds.includes(session.id) ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sessionIds.includes(session.id)}
                      onChange={() => handleSessionToggle(session.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{session.title}</div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginTop: '2px',
                        }}
                      >
                        {t('create.sessions.cardsCount', { count: session.total_cards })}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Select Question Count */}
          {step === 1 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>{t('create.count.label')}</span>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
                  {capacity && capacity.total_cards > 0
                    ? t('create.count.available', {
                        cards: capacity.total_cards,
                        max: maxQuestions,
                      })
                    : t('create.count.loadingCapacity')}
                </p>
              </div>
              <div className="question-count-presets">
                {QUESTION_COUNT_PRESETS.filter(
                  (n) => maxQuestions === 0 || n <= maxQuestions
                ).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`preset-button ${
                      !useCustomCount && questionCount === n ? 'active' : ''
                    }`}
                    onClick={() => {
                      setQuestionCount(n);
                      setUseCustomCount(false);
                    }}
                  >
                    {n}
                  </button>
                ))}
                {maxQuestions > 0 && (
                  <button
                    type="button"
                    className={`preset-button ${
                      !useCustomCount && questionCount === maxQuestions ? 'active' : ''
                    }`}
                    onClick={() => {
                      setQuestionCount(maxQuestions);
                      setUseCustomCount(false);
                    }}
                  >
                    {t('create.count.all')}
                  </button>
                )}
                <button
                  type="button"
                  className={`preset-button ${useCustomCount ? 'active' : ''}`}
                  onClick={() => setUseCustomCount(true)}
                >
                  {t('create.count.custom')}
                </button>
              </div>
              {useCustomCount && (
                <div className="field-group">
                  <input
                    type="number"
                    min="1"
                    max={maxQuestions || undefined}
                    value={questionCount === 0 ? '' : questionCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setQuestionCount(0);
                        return;
                      }
                      const parsed = parseInt(raw, 10);
                      if (!isNaN(parsed)) {
                        setQuestionCount(parsed);
                      }
                    }}
                    onBlur={() => {
                      if (questionCount < 1) setQuestionCount(1);
                    }}
                    placeholder={t('create.count.placeholder')}
                    autoFocus
                  />
                </div>
              )}
              {maxQuestions > 0 && questionCount > maxQuestions && (
                <div className="inline-error">
                  {t('create.count.maxError', { max: maxQuestions })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Question Types */}
          {step === 2 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>{t('create.types.label')}</span>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
                  {t('create.types.hint')}
                </p>
              </div>
              <div className="choice-list">
                {availableTypes.map((type) => {
                  const typeCapacity = capacity?.per_type[type] ?? 0;
                  const isAiType = AI_QUESTION_TYPES.includes(type);
                  return (
                    <label
                      key={type}
                      className={`choice-row ${isAiType ? 'choice-row--ai' : ''} ${
                        types.includes(type) ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={types.includes(type)}
                        onChange={() => handleTypeToggle(type)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>
                          {QUESTION_TYPE_LABELS[type]}
                          {isAiType && (
                            <span className="ai-chip">
                              <Sparkles />
                              AI
                            </span>
                          )}
                        </div>
                        <p className="choice-row-hint">{QUESTION_TYPE_HINTS[type]}</p>
                      </div>
                      <div className="choice-row-meta">
                        {t('create.types.cardsCount', { count: typeCapacity })}
                      </div>
                    </label>
                  );
                })}
              </div>
              {types.some((type) => AI_QUESTION_TYPES.includes(type)) && (
                <>
                  <p className="ai-note">
                    <Sparkles size={16} />
                    <span>{t('create.types.aiNote')}</span>
                  </p>
                  <div className="field-group">
                    <span>{t('create.types.explanationLanguage.label')}</span>
                    <div
                      className="auth-toggle auth-toggle--compact"
                      role="radiogroup"
                      aria-label={t('create.types.explanationLanguage.label')}
                    >
                      {EXPLANATION_LANGUAGES.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={explanationLanguage === value}
                          className={explanationLanguage === value ? 'tab-button active' : 'tab-button'}
                          onClick={() => setExplanationLanguage(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                      {t('create.types.explanationLanguage.hint')}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Enter Title */}
          {step === 3 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>{t('create.name.label')}</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('create.name.placeholder')}
                  autoFocus
                />
              </div>

              {/* Summary */}
              <div
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{t('create.name.summary')}</div>
                <div style={{ fontSize: '14px', color: '#111827', marginTop: '6px' }}>
                  {t('create.name.questionsCount', { count: questionCount })}
                  {types.length > 0 && (
                    <>
                      {' '}
                      · {types.map((qt) => QUESTION_TYPE_LABELS[qt]).join(', ')}
                    </>
                  )}
                  {selectedSessionTitles.length > 0 && (
                    <>
                      {' '}
                      · {t('create.name.from', { sessions: selectedSessionTitles.join(', ') })}
                    </>
                  )}
                  {types.some((qt) => AI_QUESTION_TYPES.includes(qt)) && (
                    <>
                      {' '}
                      · {t('create.types.explanationLanguage.label')}:{' '}
                      {EXPLANATION_LANGUAGES.find((l) => l.value === explanationLanguage)?.label}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && <div className="inline-error">{error}</div>}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBack}
              disabled={creating}
            >
              <ChevronLeft size={16} />
              {t('create.back')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!canGoNext() || creating}
            >
              {t('create.next')}
              <ChevronRight size={16} />
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!canGoNext() || creating}
            >
              {creating ? t('create.creating') : t('create.create')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
