import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import type { Session, Quiz, QuestionType, QuizCapacity } from '../../types/index';
import { QUESTION_TYPE_LABELS } from '../../types/index';

type QuizCreateModalProps = {
  isOpen: boolean;
  sessions: Session[];
  onClose: () => void;
  onCreated: (quiz: Quiz) => void;
};

const QUESTION_TYPES: QuestionType[] = ['en_to_vi', 'vi_to_en', 'synonym'];

export default function QuizCreateModal({
  isOpen,
  sessions,
  onClose,
  onCreated,
}: QuizCreateModalProps) {
  const [step, setStep] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [types, setTypes] = useState<QuestionType[]>(['en_to_vi']);
  const [questionCount, setQuestionCount] = useState(10);
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState<QuizCapacity | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setSessionIds([]);
    setTypes(['en_to_vi']);
    setQuestionCount(10);
    setTitle('');
    setCapacity(null);
    setError(null);
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
      });
      onCreated(response.data);
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail ?? 'Could not create the quiz.'
            : 'Could not create the quiz.';
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const selectedSessionTitles = sessions
    .filter((s) => sessionIds.includes(s.id))
    .map((s) => s.title);

  const maxQuestions = capacity?.max_questions ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create new quiz</h2>
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
            <span>
              Step {step + 1} of 4
            </span>
          </div>

          {/* Step 0: Select Sessions */}
          {step === 0 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>Select sessions</span>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
                  Cards from selected sessions will be used for the quiz
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
                        {session.total_cards} cards
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
                <span>Number of questions</span>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
                  {capacity && capacity.total_cards > 0
                    ? `${capacity.total_cards} cards available · up to ${maxQuestions} questions`
                    : 'Loading capacity...'}
                </p>
              </div>
              <div className="field-group">
                <input
                  type="number"
                  min="1"
                  max={maxQuestions || undefined}
                  value={questionCount}
                  onChange={(e) =>
                    setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  placeholder="Enter number of questions"
                />
              </div>
              {maxQuestions > 0 && questionCount > maxQuestions && (
                <div className="inline-error">
                  Maximum available questions: {maxQuestions}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Question Types */}
          {step === 2 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>Question types</span>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
                  Select the types of questions to include
                </p>
              </div>
              <div className="choice-list">
                {QUESTION_TYPES.map((type) => {
                  const typeCapacity = capacity?.per_type[type] ?? 0;
                  return (
                    <label
                      key={type}
                      className={`choice-row ${
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
                        </div>
                      </div>
                      <div className="choice-row-meta">
                        {typeCapacity} cards
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Enter Title */}
          {step === 3 && (
            <div className="grid gap-4">
              <div className="field-group">
                <span>Quiz name</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., TOEFL Vocabulary Quiz"
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
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Summary</div>
                <div style={{ fontSize: '14px', color: '#111827', marginTop: '6px' }}>
                  {questionCount} questions
                  {types.length > 0 && (
                    <>
                      {' '}
                      · {types.map((t) => QUESTION_TYPE_LABELS[t]).join(', ')}
                    </>
                  )}
                  {selectedSessionTitles.length > 0 && (
                    <>
                      {' '}
                      · from {selectedSessionTitles.join(', ')}
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
              Back
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
              Next
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
              {creating ? 'Creating...' : 'Create quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
