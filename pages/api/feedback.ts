import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import os from 'os';
import path from 'path';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { PHRASES_PT_BR } from '../../data/phrases-pt-br';
import { PHRASES_PT_PT } from '../../data/phrases-pt-pt';
import {
  ERROR_CATEGORIES,
  ErrorCategory,
  PronunciationAnalysis,
  PronunciationError,
  ScoreBreakdown,
  WordResult,
} from '../../lib/pronunciation';
import { synthesizeValidatedSpeech } from '../../lib/speech';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Disable body parsing, we'll handle it with formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

const AUDIO_MODEL = 'gpt-audio-1.5';
const MAX_REPORTED_ERRORS = 5;

// Combine both phrase sets into a lookup map
const ALL_PHRASES: { [key: string]: { portuguese: string; english: string; ipa: string } } = {
  ...Object.fromEntries(PHRASES_PT_BR.map(p => [p.id, { portuguese: p.portuguese, english: p.english, ipa: p.ipa }])),
  ...Object.fromEntries(PHRASES_PT_PT.map(p => [p.id, { portuguese: p.portuguese, english: p.english, ipa: p.ipa }])),
};

interface FeedbackResponse {
  feedback: string[];
  transcript?: string;
  score?: number;
  analysis?: PronunciationAnalysis;
}

// ---------------------------------------------------------------------------
// Text / phonetic similarity helpers (deterministic scoring lives here)
// ---------------------------------------------------------------------------

function stripPunctuation(word: string): string {
  return word.replace(/[.,!?;:"'“”‘’()¿¡…]/g, '');
}

function deaccent(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeWord(word: string): string {
  return deaccent(stripPunctuation(word).toLocaleLowerCase('pt'));
}

function targetWords(phrase: string): string[] {
  return phrase.split(/\s+/).map(stripPunctuation).filter(w => w.length > 0);
}

// The phrase data's IPA is word-aligned (one space-separated token per word),
// which lets us mechanically verify phonological claims per word.
function buildWordIpaMap(phrase: string, ipa: string): Map<string, string> | null {
  if (!ipa) return null;
  const words = targetWords(phrase);
  const tokens = ipa
    .split(/\s+/)
    .map(t => t.replace(/[,;]/g, ''))
    .filter(Boolean);
  if (tokens.length !== words.length) {
    // Data bug: this disables the per-word IPA hallucination guards
    console.warn(
      `IPA misaligned (${tokens.length} tokens vs ${words.length} words) for phrase: "${phrase}"`
    );
    return null;
  }
  const map = new Map<string, string>();
  words.forEach((w, i) => {
    const norm = normalizeWord(w);
    if (!map.has(norm)) map.set(norm, tokens[i]);
  });
  return map;
}

// Code-level guard against phonological hallucinations: the target IPA is
// ground truth, so claims it contradicts are dropped no matter how confident
// the model sounded. (e.g. "comida: d should be dj" — IPA shows plain /d/.)
function claimContradictsIpa(
  category: ErrorCategory,
  word: string,
  wordIpa: string | null,
  claimText: string
): boolean {
  if (category === 'r-sounds' && !normalizeWord(word).includes('r')) return true;
  if (category === 's-sounds' && !/[szxç]/.test(word.toLocaleLowerCase('pt'))) return true;
  if (!wordIpa) return false;

  const hasPalatal = /d͡?ʒ|t͡?ʃ/.test(wordIpa);
  const hasNasal = wordIpa.normalize('NFD').includes('̃');

  // "Should be dj/tch" advice is only valid where the IPA actually palatalizes
  if (!hasPalatal && (category === 'palatalization' || /\bdj\b|\btch\b|jeans|cheese/i.test(claimText))) {
    return true;
  }
  // "Missing nasalization" is only valid for words the IPA marks as nasal —
  // unless the claim is about OVER-nasalizing, which is legitimate anywhere
  if (
    !hasNasal &&
    category === 'nasal-vowels' &&
    !/too nasal|over-?nasal|should ?n[o']t be nasal/i.test(claimText)
  ) {
    return true;
  }
  return false;
}

// Second self-consistency guard: if the blind listener's IPA of what the
// learner ACTUALLY SAID already contains the target sound, a claim that the
// learner failed to produce it is refuted by our own evidence.
// (e.g. blind IPA heard "d͡ʒi" for "de" → drop "you said a hard English d".)
function claimRefutedByHeardIpa(
  category: ErrorCategory,
  claimText: string,
  heardToken: string | null
): boolean {
  if (!heardToken) return false;
  const saidPalatal = /d͡?ʒ|t͡?ʃ/.test(heardToken);
  const saidNasal = heardToken.normalize('NFD').includes('̃');
  const saidTap = heardToken.includes('ɾ');

  if (
    saidPalatal &&
    (category === 'palatalization' ||
      /(?:hard|english|plain).{0,12}\b[dt]\b|\bdj\b|\btch\b|\bch\b|jeans|cheese/i.test(claimText))
  ) {
    return true;
  }
  if (saidNasal && category === 'nasal-vowels' && /missing|no nasal|not nasal|lack|forgot/i.test(claimText)) {
    return true;
  }
  if (saidTap && category === 'r-sounds' && /english r/i.test(claimText)) {
    return true;
  }
  return false;
}

// True when every r in the word is syllable-final (coda), as in "acordo",
// "porta", "falar" — no word-initial r, no rr, no r before a vowel.
// In Brazilian Portuguese the coda r has many native realizations (soft "h",
// tap, caipira retroflex that sounds like an English r, or dropped), so
// r-claims on these words get special treatment.
function isCodaOnlyR(word: string): boolean {
  const w = normalizeWord(word);
  if (!w.includes('r')) return false;
  if (/^r|rr/.test(w)) return false;
  return !/r[aeiou]/.test(w);
}

function levenshtein<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[n];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Signal A: did a blind, strict transcriber hear the right words?
function clarityScore(transcript: string, target: string): number {
  const heard = transcript.split(/\s+/).map(normalizeWord).filter(Boolean);
  const expected = target.split(/\s+/).map(normalizeWord).filter(Boolean);
  if (expected.length === 0) return 0;
  const dist = levenshtein(heard, expected);
  const accuracy = 1 - dist / Math.max(heard.length, expected.length);
  // Mild rescale: below 20% word accuracy is indistinguishable noise
  return clamp01((accuracy - 0.2) / 0.8);
}

// Signal B: how close is the blind-heard IPA to the target IPA?
function soundsScore(heardIpa: string, targetIpa: string): number | null {
  const normalize = (ipa: string) => ipa.replace(/[ˈˌ.,\s\/\[\]|‖]/g, '');
  const heard = normalize(heardIpa);
  const expected = normalize(targetIpa);
  if (!heard || !expected) return null;
  const dist = levenshtein(heard, expected);
  const similarity = 1 - dist / Math.max(heard.length, expected.length);
  // Two transcribers of the SAME speech differ ~20-30%, so rescale:
  // similarity ~0.95 → 1.0, ~0.67 → 0.5, ~0.40 → 0
  return clamp01((similarity - 0.4) / 0.55);
}

type WordRating = 'native-like' | 'close' | 'off';

const RATING_VALUE: Record<WordRating, number> = {
  'native-like': 1,
  close: 0.5,
  off: 0.05,
};

// Signal C: word-by-word judgment against the native reference clip.
// Uses the continuous merged value when available.
function nativenessScore(ratings: ComparisonResult['ratings']): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + (r.value ?? RATING_VALUE[r.match]), 0);
  return clamp01(sum / ratings.length);
}

// Deterministic final score — the LLM never picks this number.
// Azure forced alignment (when available) is the heaviest signal because it
// is the only fully objective one. Clarity is weighted low on purpose:
// transcription models are accent-robust, so a perfect transcript says little
// about accent. It mostly acts as a gate.
function computeScore(
  clarity: number,
  sounds: number | null,
  nativeness: number | null,
  phonemes: number | null
): number {
  const signals: { value: number; weight: number }[] = [{ value: clarity, weight: 0.1 }];
  if (sounds !== null) signals.push({ value: sounds, weight: 0.15 });
  if (nativeness !== null) signals.push({ value: nativeness, weight: 0.3 });
  if (phonemes !== null) signals.push({ value: phonemes, weight: 0.45 });

  const totalWeight = signals.reduce((acc, s) => acc + s.weight, 0);
  const raw = signals.reduce((acc, s) => acc + s.value * s.weight, 0) / totalWeight;
  let score = Math.round(raw * 100);

  // Hard caps: you cannot score well if the words weren't even recognizable,
  // if most words were clearly off next to the native reference, or if the
  // forced-alignment phoneme accuracy collapsed.
  if (clarity < 0.5) score = Math.min(score, 40);
  if (nativeness !== null && nativeness < 0.35) score = Math.min(score, 45);
  if (phonemes !== null && phonemes < 0.45) score = Math.min(score, 45);
  // Floor: a genuinely clean attempt should not be dragged down by signal noise.
  if (nativeness !== null && nativeness > 0.9 && clarity > 0.85 && (phonemes === null || phonemes > 0.85)) {
    score = Math.max(score, 88);
  }

  return Math.min(100, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Azure pronunciation assessment (objective forced-alignment phoneme scores)
// ---------------------------------------------------------------------------

interface AzureWordScore {
  word: string;
  accuracy: number; // 0-100
  errorType: string; // None | Mispronunciation | Omission | Insertion
}

interface AzureAssessment {
  accuracy: number; // 0-100 phoneme-level accuracy
  fluency: number;
  completeness: number;
  pronScore: number;
  words: AzureWordScore[];
}

async function azureAssess(
  wavBuffer: Buffer,
  referenceText: string,
  locale: 'pt-BR' | 'pt-PT'
): Promise<AzureAssessment | null> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return null;

  try {
    const paConfig = Buffer.from(
      JSON.stringify({
        ReferenceText: referenceText,
        GradingSystem: 'HundredMark',
        Granularity: 'Phoneme',
        Dimension: 'Comprehensive',
        EnableMiscue: true,
      })
    ).toString('base64');

    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Pronunciation-Assessment': paConfig,
        Accept: 'application/json',
      },
      body: new Uint8Array(wavBuffer),
    });

    if (!res.ok) {
      console.error('Azure assessment HTTP error:', res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as Record<string, any>;
    if (json.RecognitionStatus !== 'Success') {
      console.error('Azure recognition status:', json.RecognitionStatus);
      return null;
    }
    const best = json.NBest?.[0];
    if (!best) return null;
    // The REST API returns scores flat on NBest[0]/Words; the SDK nests them
    // under PronunciationAssessment. Support both shapes.
    const pa = best.PronunciationAssessment ?? best;
    if (pa.AccuracyScore === undefined && pa.PronScore === undefined) return null;

    return {
      accuracy: pa.AccuracyScore ?? 0,
      fluency: pa.FluencyScore ?? 0,
      completeness: pa.CompletenessScore ?? 0,
      pronScore: pa.PronScore ?? pa.AccuracyScore ?? 0,
      words: (Array.isArray(best.Words) ? best.Words : []).map((w: any) => {
        const wpa = w.PronunciationAssessment ?? w;
        return {
          word: String(w.Word ?? ''),
          accuracy: wpa.AccuracyScore ?? 0,
          errorType: String(wpa.ErrorType ?? 'None'),
        };
      }),
    };
  } catch (err) {
    console.error('Azure assessment failed:', err);
    return null;
  }
}

// Azure per-word accuracy → tile status thresholds
function azureWordStatus(w: AzureWordScore): 'good' | 'minor' | 'major' {
  if (w.errorType === 'Omission' || w.accuracy < 60) return 'major';
  if (w.accuracy < 80 || w.errorType !== 'None') return 'minor';
  return 'good';
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

// Probe B: the model hears ONLY the audio — it never sees the target phrase,
// so it cannot flatter the learner by transcribing what they "meant".
const BLIND_LISTEN_PROMPT = `You are an expert phonetician. You will hear a short recording of a person speaking — probably Portuguese, possibly with a strong foreign accent, possibly garbled. You do NOT know what they intended to say, and you must NOT guess or "correct" toward a plausible phrase. Report only what your ear actually hears.

Respond with ONLY this JSON (no markdown, no extra text):
{
  "heard": "<the words you actually heard, in Portuguese orthography; use ? for unintelligible syllables>",
  "ipa": "<broad IPA transcription of what you ACTUALLY heard, word by word — if a sound was wrong or English-flavored, your IPA must show the wrong sound, never the corrected one>",
  "accent_features": ["<up to 5 concrete non-native features you heard, e.g. 'English retroflex r', 'no nasal resonance on ão', 'full vowel where reduction is expected'>"],
  "intelligibility": <0-100, how easily a native speaker would understand this>
}`;

// Probe C: anchored comparison. The judge hears a native reference AND a
// deliberately American-accented reading, then places each learner word
// relative to those two audible anchors. Forced relative choices are far
// better calibrated than absolute "be strict" judgments, which these models
// reliably inflate.
function buildAnchoredComparisonPrompt(isBrazilian: boolean): string {
  return `You are a ${isBrazilian ? 'Brazilian' : 'European'} Portuguese pronunciation examiner. You will hear THREE recordings of the same Portuguese phrase, in this order:
- CLIP A: a native-quality reference
- CLIP C: a deliberately heavy American-accented reading (how a monolingual English speaker would read it)
- CLIP B: the learner's attempt

For EACH WORD of the phrase, judge which anchor the learner's pronunciation of that word is closer to:
- "like-native": the word would pass as CLIP A — a native listener would notice nothing off
- "between": clearly better than CLIP C but audibly not CLIP A
- "like-accent": the sounds pattern with CLIP C — English-influenced vowels/consonants, missing nasal, wrong r, etc.

Rules:
- All three clips have DIFFERENT voices. Ignore voice identity, pitch, gender, speed, and recording quality completely — judge only the pronunciation of the sounds.
- This is a forced choice per word. Listen for the specific segments: the r's, the nasal vowels, d/t quality, vowel quality and reduction, and stress placement.
- Syllable-final r (before a consonant or at the end of a word, as in "acordo" or "falar"): ${
    isBrazilian
      ? 'Brazilian natives use a soft "h"/[x], a quick tap, a curled caipira r (which sounds like an English r), or drop it entirely — ALL of these count as "like-native". Never penalize a coda r unless the whole word is garbled'
      : 'a quick light tap or a barely-there r counts as native; only a strongly curled English r patterns with CLIP C'
  }.
- Do not be polite. If a word's sounds pattern with CLIP C, say "like-accent" even if the word is understandable.
- The "words" array must contain exactly the words of the target phrase, in order, one entry per word.

Respond with ONLY this JSON (no markdown, no extra text):
{
  "words": [
    { "word": "<word>", "verdict": "like-native" | "between" | "like-accent", "difference": "<for between/like-accent: the concrete sound difference vs CLIP A, in plain English; empty string for like-native>" }
  ],
  "overall": "<one honest sentence: where does the learner sit between the two anchors?>"
}`;
}

// Fallback two-clip comparison, used only if the accent anchor is unavailable.
function buildComparisonPrompt(isBrazilian: boolean): string {
  return `You are a strict ${isBrazilian ? 'Brazilian' : 'European'} Portuguese pronunciation examiner. You will hear two recordings of the same phrase: CLIP 1 is a native-quality reference, CLIP 2 is a learner's attempt. Compare the learner to the reference, word by word.

Rules:
- Judge pronunciation only. Ignore speaking speed, voice pitch, gender, and recording quality.
- Be strict and honest. "native-like" means a native listener would notice nothing off in that word. If you can hear ANY difference in a sound, rate it "close" (small deviation) or "off" (clearly wrong sound, English-influenced, mumbled, or missing).
- Exception — syllable-final r (before a consonant or at word end, as in "acordo" or "falar"): ${
    isBrazilian
      ? 'any Brazilian variant is native-like: soft "h"/[x], quick tap, curled caipira r (sounds like an English r), or dropped entirely. Never rate a word down for its coda r alone'
      : 'a quick light tap or a barely-there r is native-like; only a strongly curled English r is wrong there'
  }.
- Use the full range. A careless or deliberately bad attempt should rate mostly "off". A genuinely excellent attempt should rate mostly "native-like". Do not default everything to "close".
- The "words" array must contain exactly the words of the target phrase, in order, one entry per word.

Respond with ONLY this JSON (no markdown, no extra text):
{
  "words": [
    { "word": "<word>", "match": "native-like" | "close" | "off", "difference": "<for close/off: the concrete sound difference you heard, in plain English; empty string for native-like>" }
  ],
  "overall": "<one honest sentence comparing the learner to the reference>"
}`;
}

const BR_PHONETICS = `KEY BRAZILIAN PORTUGUESE (pt-BR) FACTS FOR COACHING:
- Tap R [ɾ] (like "tt" in American "butter"): single R between vowels and in clusters (pr/br/tr/dr/cr/gr/fr/vr). Always a tap — an English r here is a major error.
- Strong R (like "h" in "hello"): word-initial R, RR, R after n/l/s.
- Coda/final R ("acordo", "porta", "falar"): Brazilians genuinely vary — soft "h"/[x] (Rio, Northeast), quick tap (São Paulo), or even an English-like curled r (caipira interior), and word-final r often drops. ALL of these are native realizations: a coda r is never more than a MINOR note, and an English-like r here should usually not be flagged at all.
- Palatalization: d before i / final unstressed e → "dj" as in "jeans" ("dia"); t before i / final unstressed e → "tch" as in "cheese" ("noite"). Hard English d/t here is an error (category "palatalization").
- Final unstressed o → short "oo"; final unstressed a → relaxed "uh".
- Nasal vowels (ã, õ, ão, vowel+m/n in syllable) resonate through the nose.
- Open vs closed vowels matter (é open as in "bet", ê closed).`;

const PT_PHONETICS = `KEY EUROPEAN PORTUGUESE (pt-PT) FACTS FOR COACHING:
- Tap R [ɾ] (like "tt" in American "butter"): single R between vowels and in clusters. Always a tap — an English r here is a major error.
- Guttural/uvular R (like French R): word-initial R, RR, R after n/l/s.
- Coda/final R ("falar", "porta"): a quick light tap [ɾ], sometimes barely there in fast speech — both fine. A curled English r IS non-native here (unlike in Brazil).
- NO palatalization: d and t are always hard ("dia" starts with plain d). Never suggest Brazilian "dj"/"tch", and never use the "palatalization" category.
- Vowel reduction is the signature: unstressed e barely whispered or dropped ("está" starts "shta"); unstressed o → "oo". Over-pronounced unstressed vowels are an error (category "vowel-reduction").
- S before a consonant or word-final → "sh" ("está" → "shtá", "mais" → "mysh") (category "s-sounds").
- Nasal vowels (ã, õ, ão, vowel+m/n in syllable) resonate through the nose.`;

const CATEGORY_RULES = `ERROR CATEGORIES (use exactly these ids in "category"):
- "r-sounds": wrong R sound
- "nasal-vowels": missing or wrong nasalization
- "vowel-quality": wrong vowel sound (English vowel substituted, open/closed confusion)
- "vowel-reduction": unstressed or final vowels over-pronounced instead of reduced
- "palatalization": d/t before i (or final unstressed e) not softened to "dj"/"tch" (Brazilian only)
- "s-sounds": s/z errors, including the European "sh" quality of s
- "stress-rhythm": stress on the wrong syllable or unnatural rhythm
- "other": anything else (lh, nh, l, diphthongs, dropped syllables, ...)`;

const TIP_GUIDE = `Every error's "tip" must be a physical instruction the learner can act on (tongue/lips/airflow), one or two sentences. Examples to adapt:
- tap r: "Flick the tip of your tongue once against the ridge behind your top teeth — the 'dd' in American 'ladder' said fast."
- strong r (BR): "Relax your tongue and breathe out a strong 'h' from the throat." / guttural r (PT): "Gargle the sound gently at the back of your throat, like a French r."
- nasal vowels: "Let air escape through your nose while saying the vowel — pinch your nose: if the sound changes, it's nasal."
- soft d / t (BR): "Say 'j' as in 'jeans' / 'ch' as in 'cheese'."
- reduced e (PT): "Barely whisper the vowel or skip it — 'de' is just a quick 'd'."
- s → sh (PT): "Pull the s back into 'sh' as in 'shoe'."`;

function buildCoachingPrompt(isBrazilian: boolean): string {
  return `You are an encouraging but precise ${isBrazilian ? 'Brazilian' : 'European'} Portuguese pronunciation coach for English-speaking learners.

The learner's attempt has already been MEASURED by a separate system (blind transcription, blind phonetic listening, and word-by-word comparison against a native reference). The score is already decided — your job is ONLY to explain the evidence as clear, actionable coaching. Do not invent findings that contradict the evidence.

${isBrazilian ? BR_PHONETICS : PT_PHONETICS}

${CATEGORY_RULES}

${TIP_GUIDE}

STRICT RULES:
1. Write ALL output in English — the learner is an English speaker. (Portuguese words from the phrase may of course be quoted.)
2. You may only report errors on the words listed as imperfect in the evidence ("close" or "off"). Never flag a word that was rated native-like.
3. Every error's "word" must be copied exactly from the target phrase, and the "sound" letters must exist in that word's spelling.
3b. The word's IPA target is GROUND TRUTH — check it before writing any error. If the IPA shows plain /d/ or /t/ for that word, never suggest "dj"/"tch" (palatalization needs d͡ʒ/t͡ʃ in the IPA: d before i, as in "dia" — NOT "comida", where d precedes a). Only claim missing nasalization if the IPA carries a tilde. Never contradict the IPA.
4. Strengths and any praise in the summary must come ONLY from words the evidence rated native-like — never praise a word listed as imperfect. 1-3 strengths, each specific (word + sound). If no word was rated native-like, do not invent praise: acknowledge the attempt and point to the most fixable issue instead.
5. Report at most ${MAX_REPORTED_ERRORS} errors — pick the ones that most affect how native the learner sounds.
5b. GROUND EVERY ERROR IN THE EVIDENCE. The "heard" description must restate the specific difference the evidence reports for that word (the judge's difference text, Azure's error type, or a blind-listen feature). Do NOT guess the "typical learner mistake" for a word — if the speaker produced a sound correctly (e.g. the blind listen heard d͡ʒ in "de"), never claim they didn't. If the evidence flags a word without naming a specific sound, describe it at the word level ("this word drifted from the native clip") rather than inventing a consonant story.
6. The summary is 1-2 encouraging sentences consistent with the measured score: an honest positive observation (only if supported by the evidence) + the single highest-impact fix.

Respond with ONLY this JSON (no markdown, no extra text):
{
  "summary": "<1-2 sentences>",
  "strengths": ["<1-3 specific positives>"],
  "errors": [
    {
      "word": "<word copied exactly from the target phrase>",
      "sound": "<the letter(s) in that word, e.g. 'r', 'ão', 'd'>",
      "category": "<one of the category ids>",
      "heard": "<what the learner actually did, in plain English>",
      "target": "<what it should sound like, anchored to an English example>",
      "tip": "<physical instruction>",
      "severity": "<'major' or 'minor'>"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

// Native reference audio, cached on disk per phrase. Generations are
// validated (transcribe-checked) before caching: a garbled reference clip
// would silently corrupt the scoring baseline for every attempt at that
// phrase. v2 evicts unvalidated caches from older deploys.
async function getReferenceAudioBase64(
  openai: OpenAI,
  phraseId: string,
  dialect: string,
  text: string
): Promise<string> {
  const cachePath = path.join(os.tmpdir(), `pt-coach-ref-v2-${dialect}-${phraseId}.mp3`);
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath).toString('base64');
  }
  const { buffer, validated } = await synthesizeValidatedSpeech(openai, text, {
    voice: 'onyx',
    speed: 1.0,
  });
  if (validated) {
    fs.writeFileSync(cachePath, buffer);
  }
  return buffer.toString('base64');
}

interface BlindListenResult {
  heard: string;
  ipa: string;
  accentFeatures: string[];
}

async function blindListen(openai: OpenAI, audioBase64: string): Promise<BlindListenResult | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: AUDIO_MODEL,
      modalities: ['text'],
      temperature: 0,
      messages: [
        { role: 'system', content: BLIND_LISTEN_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Report exactly what you hear in this recording. JSON only.' },
            { type: 'input_audio', input_audio: { data: audioBase64, format: 'mp3' } },
          ],
        },
      ],
    });
    const json = extractJson(completion.choices[0]?.message?.content || '');
    if (!json) return null;
    return {
      heard: typeof json.heard === 'string' ? json.heard : '',
      ipa: typeof json.ipa === 'string' ? json.ipa : '',
      accentFeatures: (Array.isArray(json.accent_features) ? json.accent_features : [])
        .filter((f): f is string => typeof f === 'string')
        .slice(0, 5),
    };
  } catch (err) {
    console.error('Blind listen probe failed:', err);
    return null;
  }
}

// The "what bad sounds like" anchor: a deliberately American-accented reading
// of the phrase, generated once per phrase and cached on disk.
async function getAccentAnchorBase64(
  openai: OpenAI,
  phraseId: string,
  dialect: string,
  text: string
): Promise<string | null> {
  const cachePath = path.join(os.tmpdir(), `pt-coach-anchor-${dialect}-${phraseId}.mp3`);
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath).toString('base64');
  }
  try {
    const completion = await openai.chat.completions.create({
      model: AUDIO_MODEL,
      modalities: ['text', 'audio'],
      audio: { voice: 'ash', format: 'mp3' },
      messages: [
        {
          role: 'user',
          content: `You are voicing a calibration sample for a language-learning app: a monolingual American who has never heard Portuguese, reading a phrase off a card. Say exactly this phrase, pronounced the way that American would read it: hard American r's, flat English vowels, no nasal sounds, hard d's and t's, English-style stress. Phrase: "${text}". Say only the phrase.`,
        },
      ],
    });
    const audio = (completion.choices[0]?.message as { audio?: { data?: string } })?.audio;
    if (!audio?.data) return null;
    const buffer = Buffer.from(audio.data, 'base64');
    fs.writeFileSync(cachePath, buffer);
    return audio.data;
  } catch (err) {
    console.error('Accent anchor generation failed:', err);
    return null;
  }
}

interface ComparisonResult {
  // `value` carries the continuous averaged judgment (0-1) for scoring;
  // `match` is the discrete rating used for display and severity.
  ratings: { word: string; match: WordRating; difference: string; value?: number }[];
  overall: string;
}

// Merge independent judge runs: average each word's rating value. The average
// is kept as a continuous value for scoring (no quantization loss) and only
// mapped back to a discrete rating for display.
function mergeComparisons(runs: ComparisonResult[]): ComparisonResult | null {
  if (runs.length === 0) return null;
  if (runs.length === 1) return runs[0];

  const base = runs[0];
  const ratings = base.ratings.map((baseRating, i) => {
    const wordRuns = runs
      .map(r => r.ratings[i])
      .filter(r => r && normalizeWord(r.word) === normalizeWord(baseRating.word));
    if (wordRuns.length === 0) return baseRating;

    const avg =
      wordRuns.reduce((acc, r) => acc + RATING_VALUE[r.match], 0) / wordRuns.length;
    const match: WordRating = avg >= 0.8 ? 'native-like' : avg >= 0.35 ? 'close' : 'off';
    // Keep the difference text from the harshest run (it names the problem)
    const harshest = wordRuns.reduce((a, b) =>
      RATING_VALUE[a.match] <= RATING_VALUE[b.match] ? a : b
    );
    return {
      word: baseRating.word,
      match,
      difference: harshest.difference || baseRating.difference,
      value: avg,
    };
  });

  return { ratings, overall: base.overall };
}

// Three-clip anchored comparison (preferred probe C)
async function compareAnchored(
  openai: OpenAI,
  isBrazilian: boolean,
  target: string,
  targetIpa: string,
  referenceBase64: string,
  anchorBase64: string,
  learnerBase64: string
): Promise<ComparisonResult | null> {
  try {
    const words = targetWords(target);
    const completion = await openai.chat.completions.create({
      model: AUDIO_MODEL,
      modalities: ['text'],
      temperature: 0,
      messages: [
        { role: 'system', content: buildAnchoredComparisonPrompt(isBrazilian) },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `The phrase in all three clips: "${target}"\nWords in order: ${words.join(' | ')}${targetIpa ? `\nIPA target (the segments to listen for): [${targetIpa}]` : ''}\n\nCLIP A — native reference:`,
            },
            { type: 'input_audio', input_audio: { data: referenceBase64, format: 'mp3' } },
            { type: 'text', text: 'CLIP C — heavy American accent:' },
            { type: 'input_audio', input_audio: { data: anchorBase64, format: 'mp3' } },
            { type: 'text', text: 'CLIP B — the learner:' },
            { type: 'input_audio', input_audio: { data: learnerBase64, format: 'mp3' } },
          ],
        },
      ],
    });
    const json = extractJson(completion.choices[0]?.message?.content || '');
    if (!json || !Array.isArray(json.words)) return null;

    const VERDICT_TO_RATING: Record<string, WordRating> = {
      'like-native': 'native-like',
      between: 'close',
      'like-accent': 'off',
    };

    const ratings: ComparisonResult['ratings'] = [];
    for (const item of json.words) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const word = typeof e.word === 'string' ? stripPunctuation(e.word.trim()) : '';
      const match = typeof e.verdict === 'string' ? VERDICT_TO_RATING[e.verdict] : undefined;
      if (!word || !match) continue;
      ratings.push({
        word,
        match,
        difference: typeof e.difference === 'string' ? e.difference.trim() : '',
      });
    }
    if (ratings.length === 0) return null;
    return {
      ratings,
      overall: typeof json.overall === 'string' ? json.overall.trim() : '',
    };
  } catch (err) {
    console.error('Anchored comparison probe failed:', err);
    return null;
  }
}

async function compareToReference(
  openai: OpenAI,
  isBrazilian: boolean,
  target: string,
  referenceBase64: string,
  learnerBase64: string
): Promise<ComparisonResult | null> {
  try {
    const words = targetWords(target);
    const completion = await openai.chat.completions.create({
      model: AUDIO_MODEL,
      modalities: ['text'],
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildComparisonPrompt(isBrazilian) },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `The phrase in both clips: "${target}"\nWords in order: ${words.join(' | ')}\n\nCLIP 1 — the native reference:`,
            },
            { type: 'input_audio', input_audio: { data: referenceBase64, format: 'mp3' } },
            { type: 'text', text: 'CLIP 2 — the learner:' },
            { type: 'input_audio', input_audio: { data: learnerBase64, format: 'mp3' } },
          ],
        },
      ],
    });
    const json = extractJson(completion.choices[0]?.message?.content || '');
    if (!json || !Array.isArray(json.words)) return null;

    const ratings: ComparisonResult['ratings'] = [];
    for (const item of json.words) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const word = typeof e.word === 'string' ? stripPunctuation(e.word.trim()) : '';
      const match = e.match === 'native-like' || e.match === 'close' || e.match === 'off' ? e.match : null;
      if (!word || !match) continue;
      ratings.push({
        word,
        match,
        difference: typeof e.difference === 'string' ? e.difference.trim() : '',
      });
    }
    if (ratings.length === 0) return null;
    return {
      ratings,
      overall: typeof json.overall === 'string' ? json.overall.trim() : '',
    };
  } catch (err) {
    console.error('Reference comparison probe failed:', err);
    return null;
  }
}

interface CoachingResult {
  summary: string;
  strengths: string[];
  errors: PronunciationError[];
}

async function generateCoaching(
  openai: OpenAI,
  isBrazilian: boolean,
  target: string,
  targetIpa: string,
  learnerBase64: string,
  evidence: {
    score: number;
    strictTranscript: string;
    blind: BlindListenResult | null;
    comparison: ComparisonResult | null;
    azure: AzureAssessment | null;
  }
): Promise<CoachingResult | null> {
  const azureByWord = new Map<string, AzureWordScore>();
  evidence.azure?.words.forEach(w => azureByWord.set(normalizeWord(w.word), w));
  const azureImperfect = (wordNorm: string): boolean => {
    const w = azureByWord.get(wordNorm);
    return !!w && azureWordStatus(w) !== 'good';
  };

  // Words that may be flagged: imperfect per the judge OR per Azure
  const flaggableWords = (evidence.comparison || evidence.azure)
    ? targetWords(target).filter(w => {
        const norm = normalizeWord(w);
        const rating = evidence.comparison?.ratings.find(
          r => normalizeWord(r.word) === norm
        )?.match;
        return (rating && rating !== 'native-like') || azureImperfect(norm);
      })
    : null;

  const ipaByWord = buildWordIpaMap(target, targetIpa);
  // Word-aligned IPA of what the learner actually said (when alignable)
  const heardIpaByWord = evidence.blind ? buildWordIpaMap(target, evidence.blind.ipa) : null;

  const evidenceText = [
    `TARGET PHRASE: "${target}"`,
    targetIpa ? `TARGET IPA: [${targetIpa}]` : '',
    ipaByWord
      ? `WORD-BY-WORD IPA TARGETS (ground truth — never contradict these): ${targetWords(target)
          .map(w => `${w} → [${ipaByWord.get(normalizeWord(w))}]`)
          .join(' | ')}`
      : '',
    `MEASURED SCORE (already final — do not change or mention a different one): ${evidence.score}/100`,
    `STRICT BLIND TRANSCRIPT OF THE LEARNER: "${evidence.strictTranscript}"`,
    evidence.blind
      ? `BLIND PHONETIC LISTEN — heard: "${evidence.blind.heard}" | heard IPA: [${evidence.blind.ipa}] | non-native features: ${evidence.blind.accentFeatures.length ? evidence.blind.accentFeatures.join('; ') : 'none noted'}`
      : '',
    evidence.comparison
      ? `WORD-BY-WORD VS NATIVE REFERENCE:\n${evidence.comparison.ratings
          .map(r => `- ${r.word}: ${r.match}${r.difference ? ` (${r.difference})` : ''}`)
          .join('\n')}\nOverall: ${evidence.comparison.overall}`
      : '',
    evidence.azure
      ? `OBJECTIVE PHONEME SCORES (Azure forced alignment, 0-100 per word):\n${evidence.azure.words
          .map(w => `- ${w.word}: ${Math.round(w.accuracy)}${w.errorType !== 'None' ? ` (${w.errorType})` : ''}`)
          .join('\n')}\nOverall phoneme accuracy: ${Math.round(evidence.azure.accuracy)}`
      : '',
    flaggableWords
      ? `WORDS YOU MAY FLAG AS ERRORS (only these): ${
          flaggableWords.length ? flaggableWords.join(', ') : 'none — there are no errors to report'
        }`
      : '',
    'The learner audio is attached so you can describe what you hear accurately.',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const completion = await openai.chat.completions.create({
      model: AUDIO_MODEL,
      modalities: ['text'],
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildCoachingPrompt(isBrazilian) },
        {
          role: 'user',
          content: [
            { type: 'text', text: evidenceText },
            { type: 'input_audio', input_audio: { data: learnerBase64, format: 'mp3' } },
          ],
        },
      ],
    });
    const json = extractJson(completion.choices[0]?.message?.content || '');
    if (!json) return null;

    const targetWordSet = new Set(targetWords(target).map(w => normalizeWord(w)));
    const ratingByWord = new Map<string, WordRating>();
    evidence.comparison?.ratings.forEach(r => ratingByWord.set(normalizeWord(r.word), r.match));

    const errors: PronunciationError[] = [];
    for (const item of Array.isArray(json.errors) ? json.errors : []) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;

      const word = typeof e.word === 'string' ? stripPunctuation(e.word.trim()) : '';
      const wordNorm = normalizeWord(word);
      if (!word || !targetWordSet.has(wordNorm)) continue;

      // Errors are only allowed on words a measurement probe found imperfect
      const rating = ratingByWord.get(wordNorm);
      const judgeImperfect = !!rating && rating !== 'native-like';
      if ((evidence.comparison || evidence.azure) && !judgeImperfect && !azureImperfect(wordNorm)) {
        continue;
      }

      const sound = typeof e.sound === 'string' ? e.sound.trim() : '';
      const soundNorm = sound.toLocaleLowerCase('pt');
      if (
        /^[a-zà-ÿ]{1,4}$/i.test(soundNorm) &&
        !word.toLocaleLowerCase('pt').includes(soundNorm) &&
        !normalizeWord(word).includes(deaccent(soundNorm))
      ) {
        continue;
      }

      const target_ = typeof e.target === 'string' ? e.target.trim() : '';
      if (!target_) continue;
      const heard = typeof e.heard === 'string' ? e.heard.trim() : '';
      const tip = typeof e.tip === 'string' ? e.tip.trim() : '';
      const category = ERROR_CATEGORIES.includes(e.category as ErrorCategory)
        ? (e.category as ErrorCategory)
        : 'other';

      // The word's IPA target is ground truth — drop claims it contradicts
      const wordIpa = ipaByWord?.get(wordNorm) ?? null;
      const claimText = `${heard} ${target_} ${tip}`;
      if (claimContradictsIpa(category, word, wordIpa, claimText)) {
        continue;
      }
      // In Brazil an English-like coda r is a native (caipira) realization —
      // "you used an English r" is not a real error on a coda-only-r word
      if (
        isBrazilian &&
        category === 'r-sounds' &&
        isCodaOnlyR(word) &&
        /english|curl|retroflex/i.test(claimText)
      ) {
        continue;
      }
      // ...and drop claims our own blind listener already disproved
      const heardWordIpa = heardIpaByWord?.get(wordNorm) ?? null;
      if (claimRefutedByHeardIpa(category, claimText, heardWordIpa)) {
        continue;
      }

      // Severity follows the measurement, not the model's mood
      const azWord = azureByWord.get(wordNorm);
      const azStatus = azWord ? azureWordStatus(azWord) : null;
      let severity: 'major' | 'minor' =
        rating === 'off' || azStatus === 'major'
          ? 'major'
          : rating === 'close' || azStatus === 'minor'
            ? 'minor'
            : e.severity === 'minor'
              ? 'minor'
              : 'major';
      // A Brazilian coda r has many native realizations — never a major error
      if (isBrazilian && category === 'r-sounds' && isCodaOnlyR(word)) {
        severity = 'minor';
      }

      errors.push({
        word,
        sound,
        category,
        heard,
        target: target_,
        tip,
        severity,
      });
      if (errors.length >= MAX_REPORTED_ERRORS) break;
    }

    return {
      summary: typeof json.summary === 'string' ? json.summary.trim() : '',
      strengths: (Array.isArray(json.strengths) ? json.strengths : [])
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map(s => s.trim())
        .slice(0, 3),
      errors,
    };
  } catch (err) {
    console.error('Coaching generation failed:', err);
    return null;
  }
}

const VERIFY_PROMPT = `You are a skeptical phonetician fact-checking error claims about a learner's recording of a Portuguese phrase. For each numbered claim, listen carefully to the word in question and decide whether the claimed problem is REALLY audible.

A claim is "accurate" ONLY if you clearly hear the problem it describes. If the speaker actually produced the target sound correctly — or you cannot clearly hear the claimed problem — the claim is inaccurate. Falsely telling a learner they made an error they did not make destroys their trust; when in doubt, mark the claim inaccurate.

Respond with ONLY this JSON (no markdown, no extra text):
{ "verdicts": [ { "claim": <claim number>, "accurate": true | false, "note": "<one short phrase: what you actually heard in that word>" } ] }`;

// Adversarial check: every error claim must survive a skeptical listen of the
// actual audio before it reaches the learner. False accusations are treated
// as worse than omissions.
async function verifyErrorClaims(
  openai: OpenAI,
  target: string,
  errors: PronunciationError[],
  learnerBase64: string
): Promise<PronunciationError[]> {
  if (errors.length === 0) return errors;
  try {
    const claims = errors
      .map(
        (e, i) =>
          `${i + 1}. In the word "${e.word}" (sound "${e.sound}"): the speaker supposedly produced ${e.heard || 'the wrong sound'} instead of ${e.target}.`
      )
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: AUDIO_MODEL,
      modalities: ['text'],
      temperature: 0,
      messages: [
        { role: 'system', content: VERIFY_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `The speaker attempted: "${target}"\n\nCLAIMS TO CHECK:\n${claims}\n\nListen to the recording and judge each claim.`,
            },
            { type: 'input_audio', input_audio: { data: learnerBase64, format: 'mp3' } },
          ],
        },
      ],
    });

    const json = extractJson(completion.choices[0]?.message?.content || '');
    if (!json || !Array.isArray(json.verdicts)) return errors;

    const refuted = new Set<number>();
    for (const v of json.verdicts) {
      if (!v || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      const idx = Number(e.claim);
      if (Number.isInteger(idx) && e.accurate === false) refuted.add(idx - 1);
    }
    if (refuted.size > 0) {
      console.log(
        'Verification dropped claims:',
        errors.filter((_, i) => refuted.has(i)).map(e => `${e.word}/${e.sound}`).join(', ')
      );
    }
    return errors.filter((_, i) => !refuted.has(i));
  } catch (err) {
    console.error('Claim verification failed:', err);
    return errors;
  }
}

// Best-effort category from a measured difference description
function inferCategoryFromText(text: string, isBrazilian: boolean): ErrorCategory {
  const t = text.toLowerCase();
  if (/nasal/.test(t)) return 'nasal-vowels';
  // Palatalization is Brazilian-only; for pt-PT a "dj" mention is a vowel/consonant issue
  if (
    isBrazilian &&
    /\bdj\b|\btch\b|\bch\b|palatal|jeans|cheese|(?:hard|english|plain)[^a-z]{0,3}[dt]\b/.test(t)
  ) {
    return 'palatalization';
  }
  if (/\br\b|r sound|tap|guttural|retroflex|rolled/.test(t)) return 'r-sounds';
  if (/\bsh\b|s sound/.test(t)) return 's-sounds';
  if (/stress|rhythm|emphasis|syllable/.test(t)) return 'stress-rhythm';
  if (/reduc|swallow|clipped|dropped vowel/.test(t)) return 'vowel-reduction';
  if (/vowel/.test(t)) return 'vowel-quality';
  return 'other';
}

// The letters in the word the fallback card should point at (UI shows this chip)
function fallbackSound(category: ErrorCategory, word: string): string {
  const w = word.toLocaleLowerCase('pt');
  switch (category) {
    case 'r-sounds':
      return w.includes('rr') ? 'rr' : w.includes('r') ? 'r' : '';
    case 's-sounds':
      return ['ss', 'ç', 's', 'z', 'x'].find(s => w.includes(s)) ?? '';
    case 'nasal-vowels': {
      const m = w.match(/ão|ãe|õe|ã|õ|[aeiou][mn]/);
      return m ? m[0] : '';
    }
    case 'palatalization': {
      const m = w.match(/d[ie]|t[ie]/);
      return m ? m[0][0] : '';
    }
    default:
      return '';
  }
}

// Category-specific target/tip for cards built straight from the measurement
// (coaching failed, was capped, or its claims were refuted). Mirrors the
// dialect facts in the coaching prompt.
function fallbackCoaching(
  category: ErrorCategory,
  word: string,
  isBrazilian: boolean
): { target: string; tip: string } {
  switch (category) {
    case 'r-sounds': {
      const w = normalizeWord(word);
      // Word-initial R and RR: the strong R
      if (/^r|rr/.test(w)) {
        return isBrazilian
          ? {
              target: 'a strong R from the throat, like the "h" in "hello"',
              tip: 'Relax your tongue and breathe out a strong "h" from the throat — no tongue curl at all.',
            }
          : {
              target: 'a guttural R at the back of the throat, like a French R',
              tip: 'Gargle the sound gently at the back of your throat, like a French r.',
            };
      }
      // Syllable-final r (before a consonant or at word end, e.g. "acordo",
      // "falar"): regional variants differ — and in Brazil even an
      // English-like curled r is a native (caipira) realization
      if (/r(?![aeiou])/.test(w)) {
        return isBrazilian
          ? {
              target: 'any Brazilian coda r: a soft "h" (Rio style), a quick tongue tap (São Paulo style) — even a curled r is native in the interior',
              tip: 'Easiest native option: breathe a soft "h" right where the r sits. A quick tongue tap works too, and at the end of a word many Brazilians drop the r entirely. This sound has lots of room — pick whichever feels natural.',
            }
          : {
              target: 'a quick, light tongue tap — like a softly-said "tt" in American "butter"',
              tip: 'Flick the tip of your tongue lightly against the ridge behind your top teeth and keep it short — in fast speech it can almost disappear. Just don\'t curl your tongue back like an English r.',
            };
      }
      // Between vowels or in a cluster (pr/tr/cr...): always the tap
      return {
        target: 'a quick tongue tap, like the "tt" in American "butter"',
        tip: 'Flick the tip of your tongue once against the ridge behind your top teeth — the "dd" in "ladder" said fast. Don\'t curl your tongue back like an English r.',
      };
    }
    case 'nasal-vowels':
      return {
        target: 'a vowel that resonates through the nose',
        tip: 'Let air escape through your nose while saying the vowel — pinch your nose: if the sound changes, it\'s nasal.',
      };
    case 'vowel-quality':
      return {
        target: 'a pure, short Portuguese vowel',
        tip: 'Keep the vowel short and pure — cut it off before it glides into an English diphthong.',
      };
    case 'vowel-reduction':
      return isBrazilian
        ? {
            target: 'reduced unstressed vowels — final "o" as a short "oo", final "a" as a relaxed "uh"',
            tip: 'Say the unstressed vowels quickly and lazily; give the stressed syllable all the energy.',
          }
        : {
            target: 'a barely-whispered unstressed vowel',
            tip: 'Barely whisper the unstressed vowel or skip it entirely — "de" is just a quick "d".',
          };
    case 'palatalization':
      return {
        target: '"d" as the "j" in "jeans", "t" as the "ch" in "cheese"',
        tip: 'Soften it: before "i" (and final unstressed "e"), say "d" like "j" in "jeans" and "t" like "ch" in "cheese".',
      };
    case 's-sounds':
      return isBrazilian
        ? {
            target: 'a clean Portuguese s — voiced like "z" between vowels, crisp "s" elsewhere',
            tip: 'Keep the s light and precise; between vowels let it buzz like a "z".',
          }
        : {
            target: 'the European "sh" — "mais" sounds like "mysh"',
            tip: 'Pull the s back into "sh" as in "shoe" before consonants and at the ends of words.',
          };
    case 'stress-rhythm':
      return {
        target: 'stress on the right syllable',
        tip: 'Exaggerate the stressed syllable — say it louder and longer than the rest.',
      };
    default:
      return {
        target: 'match the native clip for this word',
        tip: 'Replay the native recording, then your own, and copy the mouth movement on just this word a few times.',
      };
  }
}

// Consistency guarantee: every word tile rated minor/major must have an entry
// in "what to work on". When coaching claims were capped, filtered, or
// refuted, fall back to a card grounded directly in the measurement.
function ensureErrorCoverage(
  words: WordResult[],
  errors: PronunciationError[],
  comparison: ComparisonResult | null,
  azure: AzureAssessment | null,
  target: string,
  isBrazilian: boolean,
  ipaByWord: Map<string, string> | null,
  heardIpaByWord: Map<string, string> | null
): PronunciationError[] {
  const covered = new Set(errors.map(e => normalizeWord(e.word)));
  const result = [...errors];

  for (const w of words) {
    if (w.status === 'good') continue;
    const norm = normalizeWord(w.word);
    if (covered.has(norm)) continue;
    covered.add(norm);

    let difference =
      comparison?.ratings.find(r => normalizeWord(r.word) === norm)?.difference || '';
    const azureWord = azure?.words.find(x => normalizeWord(x.word) === norm);

    let category = inferCategoryFromText(difference, isBrazilian);
    // These cards bypass the coaching-claim verification, so apply the same
    // evidence guards here: if the target IPA or the blind listener's IPA of
    // what the learner ACTUALLY said disproves the judge's claim, never
    // repeat it — fall back to neutral word-level wording instead.
    if (difference) {
      const wordIpa = ipaByWord?.get(norm) ?? null;
      const heardToken = heardIpaByWord?.get(norm) ?? null;
      if (
        claimContradictsIpa(category, w.word, wordIpa, difference) ||
        claimRefutedByHeardIpa(category, difference, heardToken)
      ) {
        difference = '';
        category = 'other';
      } else if (
        isBrazilian &&
        category === 'r-sounds' &&
        isCodaOnlyR(w.word) &&
        /english|curl|retroflex/i.test(difference)
      ) {
        // A coda r that sounds English is native in Brazil — keep the r
        // guidance but drop the accusation
        difference = '';
      }
    }
    const coaching = fallbackCoaching(category, w.word, isBrazilian);
    result.push({
      word: w.word,
      sound: fallbackSound(category, w.word),
      category,
      heard:
        difference ||
        (azureWord
          ? `phoneme accuracy ${Math.round(azureWord.accuracy)}/100${
              azureWord.errorType !== 'None' ? ` (${azureWord.errorType.toLowerCase()})` : ''
            }`
          : 'this word drifted from the native pronunciation'),
      target: coaching.target,
      tip: coaching.tip,
      severity:
        w.status === 'major' &&
        !(isBrazilian && category === 'r-sounds' && isCodaOnlyR(w.word))
          ? 'major'
          : 'minor',
    });
  }

  // Major issues first, then phrase order
  const wordPos = new Map(targetWords(target).map((w, i) => [normalizeWord(w), i]));
  result.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'major' ? -1 : 1;
    return (wordPos.get(normalizeWord(a.word)) ?? 99) - (wordPos.get(normalizeWord(b.word)) ?? 99);
  });
  return result;
}

// Word tiles come straight from the measurement, not from the coaching text.
// When both the anchored judge and Azure rated a word, take the worse status —
// each catches problems the other can miss.
function buildWordResults(
  target: string,
  comparison: ComparisonResult | null,
  azure: AzureAssessment | null,
  errors: PronunciationError[]
): WordResult[] {
  const STATUS_RANK = { good: 0, minor: 1, major: 2 } as const;
  const ratingByWord = new Map<string, WordRating>();
  comparison?.ratings.forEach(r => ratingByWord.set(normalizeWord(r.word), r.match));
  const azureByWord = new Map<string, AzureWordScore>();
  azure?.words.forEach(w => azureByWord.set(normalizeWord(w.word), w));

  return targetWords(target).map(word => {
    const norm = normalizeWord(word);
    const statuses: ('good' | 'minor' | 'major')[] = [];

    const rating = ratingByWord.get(norm);
    if (rating) {
      statuses.push(rating === 'off' ? 'major' : rating === 'close' ? 'minor' : 'good');
    }
    const azureWord = azureByWord.get(norm);
    if (azureWord) {
      statuses.push(azureWordStatus(azureWord));
    }
    if (statuses.length === 0) {
      // Fallback when both probes failed: derive from coaching errors
      const wordErrors = errors.filter(e => normalizeWord(e.word) === norm);
      statuses.push(
        wordErrors.some(e => e.severity === 'major')
          ? 'major'
          : wordErrors.length > 0
            ? 'minor'
            : 'good'
      );
    }

    const status = statuses.reduce((worst, s) =>
      STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst
    );
    return { word, status };
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FeedbackResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let audioFilePath: string | undefined;
  let mp3Path: string | undefined;
  let wavPath: string | undefined;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Parse form data
    const form = formidable({});
    const [fields, files] = await form.parse(req);

    const phraseId = Array.isArray(fields.phraseId) ? fields.phraseId[0] : fields.phraseId;
    const dialect = (Array.isArray(fields.dialect) ? fields.dialect[0] : fields.dialect) as 'pt-BR' | 'pt-PT' | undefined;
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!phraseId || !audioFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const targetPhrase = ALL_PHRASES[phraseId];
    if (!targetPhrase) {
      return res.status(400).json({ error: 'Invalid phrase ID' });
    }
    const isBrazilian = !dialect || dialect === 'pt-BR';

    // Read + convert audio: mp3 for the OpenAI audio models, 16kHz mono WAV
    // for Azure forced alignment.
    audioFilePath = audioFile.filepath;
    const audioBuffer = fs.readFileSync(audioFilePath);
    const mp3OutputPath = audioFilePath + '.mp3';
    mp3Path = mp3OutputPath;
    const wavOutputPath = audioFilePath + '.wav';
    wavPath = wavOutputPath;
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        ffmpeg(audioFile.filepath)
          .toFormat('mp3')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(mp3OutputPath);
      }),
      new Promise<void>((resolve, reject) => {
        ffmpeg(audioFile.filepath)
          .toFormat('wav')
          .audioFrequency(16000)
          .audioChannels(1)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(wavOutputPath);
      }),
    ]);
    const audioBase64 = fs.readFileSync(mp3Path).toString('base64');
    const wavBuffer = fs.readFileSync(wavOutputPath);

    const audioFileForTranscription = new File(
      [audioBuffer],
      audioFile.originalFilename || 'recording.webm',
      { type: audioFile.mimetype || 'audio/webm' }
    );

    // ---- Stage 1: independent blind probes, in parallel --------------------
    const [strictResult, blindResult1, blindResult2, referenceResult, anchorResult, azureResult] =
      await Promise.allSettled([
        // Probe A: strict transcription with NO knowledge of the target
        openai.audio.transcriptions
          .create({
            file: audioFileForTranscription,
            model: 'gpt-4o-transcribe',
            language: 'pt',
          })
          .catch(() =>
            openai.audio.transcriptions.create({
              file: audioFileForTranscription,
              model: 'whisper-1',
              language: 'pt',
            })
          ),
        // Probe B: blind phonetic listening, two independent ears (no target shown)
        blindListen(openai, audioBase64),
        blindListen(openai, audioBase64),
        // Native reference clip for probe C (cached per phrase)
        getReferenceAudioBase64(openai, phraseId, dialect || 'pt-BR', targetPhrase.portuguese),
        // "What bad sounds like" anchor for probe C (cached per phrase)
        getAccentAnchorBase64(openai, phraseId, dialect || 'pt-BR', targetPhrase.portuguese),
        // Probe D: Azure forced-alignment pronunciation assessment (objective)
        azureAssess(wavBuffer, targetPhrase.portuguese, isBrazilian ? 'pt-BR' : 'pt-PT'),
      ]);

    const strictTranscript =
      strictResult.status === 'fulfilled' ? strictResult.value.text : '';
    const blindRuns = [blindResult1, blindResult2]
      .filter((r): r is PromiseFulfilledResult<BlindListenResult | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((v): v is BlindListenResult => v !== null);
    const blind = blindRuns[0] ?? null;
    const referenceBase64 =
      referenceResult.status === 'fulfilled' ? referenceResult.value : null;
    const anchorBase64 = anchorResult.status === 'fulfilled' ? anchorResult.value : null;
    const azure = azureResult.status === 'fulfilled' ? azureResult.value : null;

    // ---- Stage 2: word-by-word anchored comparison --------------------------
    // Preferred: place the learner between a native clip and a heavy-accent
    // clip (forced relative choice). Fallback: two-clip comparison.
    let comparison: ComparisonResult | null = null;
    if (referenceBase64 && anchorBase64) {
      // Two independent judges in parallel; merged per-word to cancel
      // single-run variance.
      const judgeRuns = await Promise.allSettled([
        compareAnchored(openai, isBrazilian, targetPhrase.portuguese, targetPhrase.ipa, referenceBase64, anchorBase64, audioBase64),
        compareAnchored(openai, isBrazilian, targetPhrase.portuguese, targetPhrase.ipa, referenceBase64, anchorBase64, audioBase64),
      ]);
      comparison = mergeComparisons(
        judgeRuns
          .filter((r): r is PromiseFulfilledResult<ComparisonResult | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter((v): v is ComparisonResult => v !== null)
      );
    }
    if (!comparison && referenceBase64) {
      comparison = await compareToReference(
        openai,
        isBrazilian,
        targetPhrase.portuguese,
        referenceBase64,
        audioBase64
      );
    }

    // ---- Stage 3: deterministic scoring (code, not model) ------------------
    const clarity = clarityScore(strictTranscript, targetPhrase.portuguese);
    // Average the blind-IPA signal across both independent ears
    const soundsRuns = targetPhrase.ipa
      ? blindRuns
          .map(b => soundsScore(b.ipa, targetPhrase.ipa))
          .filter((s): s is number => s !== null)
      : [];
    const sounds = soundsRuns.length
      ? soundsRuns.reduce((a, b) => a + b, 0) / soundsRuns.length
      : null;
    const nativeness = comparison ? nativenessScore(comparison.ratings) : null;
    const phonemes = azure ? clamp01(azure.accuracy / 100) : null;

    if (!strictTranscript && !blind && !comparison && !azure) {
      throw new Error('All measurement probes failed');
    }

    const score = computeScore(clarity, sounds, nativeness, phonemes);
    const breakdown: ScoreBreakdown = {
      clarity: Math.round(clarity * 100),
      sounds: sounds === null ? null : Math.round(sounds * 100),
      nativeness: nativeness === null ? null : Math.round(nativeness * 100),
      phonemes: phonemes === null ? null : Math.round(phonemes * 100),
    };

    // ---- Stage 4: coaching text that explains the measurement ---------------
    const coaching = await generateCoaching(
      openai,
      isBrazilian,
      targetPhrase.portuguese,
      targetPhrase.ipa,
      audioBase64,
      { score, strictTranscript, blind, comparison, azure }
    );

    // Coaching is presentation; if it fails, fall back to the raw measurement
    const candidateErrors: PronunciationError[] =
      coaching?.errors ??
      (comparison
        ? comparison.ratings
            .filter(r => r.match !== 'native-like' && r.difference)
            .slice(0, MAX_REPORTED_ERRORS)
            .map(r => {
              const category = inferCategoryFromText(r.difference, isBrazilian);
              const fallback = fallbackCoaching(category, r.word, isBrazilian);
              return {
                word: r.word,
                sound: fallbackSound(category, r.word),
                category,
                heard: r.difference,
                target: fallback.target,
                tip: fallback.tip,
                severity: r.match === 'off' ? ('major' as const) : ('minor' as const),
              };
            })
        : []);

    // Every claim must survive a skeptical listen of the actual audio
    const verifiedErrors = await verifyErrorClaims(
      openai,
      targetPhrase.portuguese,
      candidateErrors,
      audioBase64
    );

    // Tiles from measurement; then guarantee every imperfect tile has a card
    const words = buildWordResults(targetPhrase.portuguese, comparison, azure, verifiedErrors);
    const errors = ensureErrorCoverage(
      words,
      verifiedErrors,
      comparison,
      azure,
      targetPhrase.portuguese,
      isBrazilian,
      buildWordIpaMap(targetPhrase.portuguese, targetPhrase.ipa),
      blind ? buildWordIpaMap(targetPhrase.portuguese, blind.ipa) : null
    );

    const analysis: PronunciationAnalysis = {
      score,
      summary:
        coaching?.summary ||
        comparison?.overall ||
        'We measured your attempt against a native reference — see the breakdown below.',
      strengths: coaching?.strengths ?? [],
      errors,
      words,
      breakdown,
    };

    return res.status(200).json({
      feedback: errors.map(
        e => `${e.word}: ${e.heard || 'this word was off'} — aim for ${e.target}`
      ),
      transcript: strictTranscript || blind?.heard || '',
      score,
      analysis,
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return res.status(500).json({
      error: 'Failed to process audio and generate feedback',
    });
  } finally {
    // Clean up temp files on every path
    for (const p of [audioFilePath, mp3Path, wavPath]) {
      if (p && fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
    }
  }
}
