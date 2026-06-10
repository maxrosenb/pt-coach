// Shared types and labels for structured pronunciation feedback.

export type ErrorCategory =
  | 'r-sounds'
  | 'nasal-vowels'
  | 'vowel-quality'
  | 'vowel-reduction'
  | 'palatalization'
  | 's-sounds'
  | 'stress-rhythm'
  | 'other';

export const ERROR_CATEGORIES: ErrorCategory[] = [
  'r-sounds',
  'nasal-vowels',
  'vowel-quality',
  'vowel-reduction',
  'palatalization',
  's-sounds',
  'stress-rhythm',
  'other',
];

export interface PronunciationError {
  word: string; // exact word from the target phrase
  sound: string; // the letter(s) in that word, e.g. "r", "ão", "d"
  category: ErrorCategory;
  heard: string; // what the learner actually said, in plain English
  target: string; // what it should sound like, with an English anchor
  tip: string; // physical instruction for how to make the sound
  severity: 'minor' | 'major';
}

export interface WordResult {
  word: string;
  status: 'good' | 'minor' | 'major';
}

// Independent measurement signals, each 0-100 (null = signal unavailable)
export interface ScoreBreakdown {
  clarity: number; // strict blind transcription vs target words
  sounds: number | null; // blind IPA transcription vs target IPA
  nativeness: number | null; // word-by-word comparison against a native reference clip
  phonemes?: number | null; // Azure forced-alignment phoneme accuracy (objective)
}

export interface PronunciationAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  errors: PronunciationError[];
  words: WordResult[];
  breakdown?: ScoreBreakdown;
}

export const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  'r-sounds': 'R sounds',
  'nasal-vowels': 'Nasal vowels',
  'vowel-quality': 'Vowel quality',
  'vowel-reduction': 'Vowel reduction',
  palatalization: 'Soft D & T',
  's-sounds': 'S sounds',
  'stress-rhythm': 'Stress & rhythm',
  other: 'Other sounds',
};

export const CATEGORY_ADVICE: Record<ErrorCategory, string> = {
  'r-sounds':
    'Drill the two Rs: flick your tongue tip for the tap (like the "tt" in American "butter") and breathe a soft "h" from the throat for the strong R.',
  'nasal-vowels':
    'Practice sending vowels through your nose — pinch your nose while saying "ão"; if the sound changes, it\'s nasal.',
  'vowel-quality':
    'Portuguese vowels are pure and short — practice open "é" (as in "bet") vs closed "ê" (as in "they", without the glide).',
  'vowel-reduction':
    'Unstressed vowels shrink: whisper or drop unstressed "e" and turn final "o" into a quick "oo".',
  palatalization:
    'Before "i" (and final "e"), soften d → "j" as in "jeans" and t → "ch" as in "cheese": "dia" = "JEE-ah".',
  's-sounds':
    'S before a consonant or at the end of a word becomes "sh" — "está" sounds like "shtá".',
  'stress-rhythm':
    'Exaggerate the stressed syllable of each word — say it louder and longer than the rest.',
  other:
    'Listen to the native audio and shadow it — repeat immediately after, copying the exact mouth movements.',
};
