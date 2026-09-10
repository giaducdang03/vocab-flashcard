export type User = {
  id: string;
  email: string;
  display_name: string;
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

export type QuestionType = 'en_to_vi' | 'vi_to_en' | 'synonym';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  en_to_vi: 'English → Vietnamese',
  vi_to_en: 'Vietnamese → English',
  synonym: 'Synonym',
};

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
};

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
