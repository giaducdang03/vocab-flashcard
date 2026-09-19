export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  email_verified: boolean;
  avatar_url: string | null;
};

export type Session = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  total_cards: number;
  learned_cards: number;
};

export type Synonym = {
  id: string;
  word: string;
  phonetic?: string | null;
};

export type CardType = 'vocab' | 'collocation';

export type Card = {
  id: string;
  session_id: string;
  card_type: CardType;
  front_text: string;
  front_phonetic?: string | null;
  back_text: string;
  example?: string | null;
  is_learned: boolean;
  position: number;
  synonyms: Synonym[];
};

export type SessionDetailResponse = {
  session: Session;
  cards: Card[];
};

export type DailyPoint = {
  date: string;
  learned_count: number;
};

export type DailyStats = {
  days: number;
  daily: DailyPoint[];
  current_streak: number;
};

export type QuestionType =
  | 'en_to_vi'
  | 'vi_to_en'
  | 'synonym'
  | 'cloze'
  | 'context'
  | 'verb_tense'
  | 'word_stress';

export const AI_QUESTION_TYPES: QuestionType[] = [
  'cloze',
  'context',
  'verb_tense',
  'word_stress',
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  en_to_vi: 'English → Vietnamese',
  vi_to_en: 'Vietnamese → English',
  synonym: 'Synonym',
  cloze: 'Fill in the blank',
  context: 'Choose the word in context',
  verb_tense: 'Verb tense',
  word_stress: 'Word stress',
};

// Tailwind classes for each type's pill, shared by the quiz list and detail pages.
export const QUESTION_TYPE_COLORS: Record<QuestionType, { bg: string; text: string }> = {
  en_to_vi: { bg: 'bg-blue-50', text: 'text-blue-700' },
  vi_to_en: { bg: 'bg-purple-50', text: 'text-purple-700' },
  synonym: { bg: 'bg-orange-50', text: 'text-orange-700' },
  cloze: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  context: { bg: 'bg-pink-50', text: 'text-pink-700' },
  verb_tense: { bg: 'bg-amber-50', text: 'text-amber-700' },
  word_stress: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
};

// Phrased as the question the learner is actually answering, so the task is
// clear without a type label to decode. Shown while taking a quiz (where it
// replaces the type badge) and under each type in the create modal.
export const QUESTION_TYPE_HINTS: Record<QuestionType, string> = {
  en_to_vi: 'What does this English word mean in Vietnamese?',
  vi_to_en: 'Which English word matches this Vietnamese meaning?',
  synonym: 'Which word means almost the same?',
  cloze: 'Which word fills the blank?',
  context: 'Which word fits this situation?',
  verb_tense: 'Which form of the verb in brackets fits the blank?',
  word_stress: 'Which syllable carries the main stress?',
};

// Verdict headlines shown after answering. The quiz view picks one by question
// index (not randomly) so the text stays put across re-renders while
// consecutive questions still read differently.
export const CORRECT_MESSAGES: string[] = [
  'Correct!',
  'Nice one!',
  'Well done!',
  'Spot on!',
  'Exactly right!',
  'Nailed it!',
  'Great job!',
  'You got it!',
  'Perfect!',
  'Brilliant!',
];

export const WRONG_MESSAGES: string[] = [
  'Not quite',
  'Almost there',
  'Close one',
  'Good try',
  'Not this time',
  'Oops, not that one',
  'Nearly!',
  'Keep going',
  "Don't worry, next one's yours",
  "Let's learn from this",
];

export type Quiz = {
  id: string;
  title: string;
  question_types: QuestionType[];
  question_count: number;
  source_session_titles: string[];
  attempt_count: number;
  best_score: number | null;
  last_attempt_at: string | null;
  created_at: string;
  status: 'pending' | 'ready' | 'failed';
  uses_ai: boolean;
  error_message: string | null;
  ai_question_count: number;
};

export interface AiStatus {
  available: boolean;
  enabled_for_user: boolean;
  daily_limit: number;
  used_today: number;
}

export interface QuizStatus {
  status: 'pending' | 'ready' | 'failed';
  question_count: number;
  error_message: string | null;
}

export type QuizAttemptSummary = {
  id: string;
  submitted_at: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
};

export type QuizDetail = {
  quiz: Quiz;
  attempts: QuizAttemptSummary[];
};

export type QuizCapacity = {
  total_cards: number;
  per_type: Partial<Record<QuestionType, number>>;
  max_questions: number;
};

export type QuizQuestion = {
  id: string;
  question_type: QuestionType;
  prompt_text: string;
  prompt_phonetic?: string | null;
  options: string[];
  position: number;
  source?: string;
};

export type AttemptStart = {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  questions: QuizQuestion[];
};

export type AnswerResult = {
  is_correct: boolean;
  correct_index: number;
  explanation?: string | null;
};

export type AttemptSubmitResult = {
  attempt_id: string;
  score: number;
  total_questions: number;
  duration_seconds: number;
};

export type ReviewQuestion = QuizQuestion & {
  correct_index: number;
  selected_index: number | null;
  is_correct: boolean;
  card_id: string | null;
  explanation?: string | null;
  source?: string;
};

export type AttemptReview = {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
  submitted_at: string;
  questions: ReviewQuestion[];
};

export type PracticeQuestion = {
  card_id: string;
  question_type: QuestionType;
  prompt_text: string;
  prompt_phonetic?: string | null;
  options: string[];
  correct_index: number;
  position: number;
};

export type PracticeStart = {
  session_id: string;
  session_title: string;
  pool: PracticePool;
  questions: PracticeQuestion[];
};

/** Which slice of a session a practice run draws its questions from. */
export type PracticePool = 'all' | 'unlearned' | 'learned';

export const PRACTICE_POOL_LABELS: Record<PracticePool, string> = {
  all: 'All cards',
  unlearned: 'Unlearned only',
  learned: 'Learned only',
};

/** One answered question, kept in client state only — never sent to the server. */
export type PracticeAnswer = {
  question: PracticeQuestion;
  selected_index: number;
  is_correct: boolean;
};
