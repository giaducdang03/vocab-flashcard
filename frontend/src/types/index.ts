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
