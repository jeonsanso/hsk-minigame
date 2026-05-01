export interface SentenceData {
  sentence: string;
  words: string[];
  pinyin: string[];
  wordMeanings: string[];
  translation: string;
  hint: string;
}

export type GamePhase = 'loading' | 'playing' | 'correct' | 'wrong';

export interface ShuffledWord {
  id: number;
  text: string;
  originalIndex: number;
}

export interface HistoryEntry {
  sentence: SentenceData;
  result: 'correct' | 'wrong';
  timestamp: number;
}

export interface VocabQuestion {
  word: string;
  pinyin: string;
  correct: string;
  choices: string[];
}

export interface SentenceOrderData {
  sentences: string[];
  pinyin: string[];
  translations: string[];
  hint: string;
}

export type SentenceOrderPhase = 'loading' | 'playing' | 'correct' | 'wrong';

export interface SentenceOrderHistoryEntry {
  problem: SentenceOrderData;
  result: 'correct' | 'wrong';
  timestamp: number;
}
