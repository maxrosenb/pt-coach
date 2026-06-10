import OpenAI from 'openai';

// tts-1 generations are stochastic and occasionally come out slurred or
// garbled. Callers cache clips to disk, which would make a one-time bad
// generation permanent — so every clip is transcribe-checked against its
// text before being accepted, with one retry. Unvalidated clips are still
// returned (better than no audio) but must not be cached.

function deaccent(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

function toWords(s: string): string[] {
  return s
    .split(/\s+/)
    .map(w => deaccent(w.replace(/[.,!?;:"'“”‘’()¿¡…]/g, '').toLocaleLowerCase('pt')))
    .filter(Boolean);
}

function levenshtein(a: string[], b: string[]): number {
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

function transcriptAccuracy(transcript: string, target: string): number {
  const heard = toWords(transcript);
  const expected = toWords(target);
  if (expected.length === 0) return 0;
  return 1 - levenshtein(heard, expected) / Math.max(heard.length, expected.length, 1);
}

// Whisper transcribes clean TTS clips near-perfectly, so anything below this
// means the generation itself is defective (slurred, truncated, gibberish).
const VALIDATION_THRESHOLD = 0.7;
const MAX_ATTEMPTS = 2;

export interface SynthesisResult {
  buffer: Buffer;
  validated: boolean;
}

export async function synthesizeValidatedSpeech(
  openai: OpenAI,
  text: string,
  opts: { voice?: 'onyx' | 'nova' | 'ash'; speed?: number } = {}
): Promise<SynthesisResult> {
  const { voice = 'onyx', speed = 1.0 } = opts;
  let buffer: Buffer | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice,
      input: text,
      speed,
    });
    buffer = Buffer.from(await mp3.arrayBuffer());

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: new File([new Uint8Array(buffer)], 'clip.mp3', { type: 'audio/mpeg' }),
        model: 'whisper-1',
        language: 'pt',
      });
      if (transcriptAccuracy(transcription.text, text) >= VALIDATION_THRESHOLD) {
        return { buffer, validated: true };
      }
      console.warn(
        `TTS validation failed (attempt ${attempt}) for "${text}" — whisper heard "${transcription.text}"`
      );
    } catch (err) {
      // Validation itself unavailable — serve the clip rather than fail,
      // but don't certify it for caching
      console.error('TTS validation transcription failed:', err);
      return { buffer, validated: false };
    }
  }

  return { buffer: buffer as Buffer, validated: false };
}
