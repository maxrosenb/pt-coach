// Empirical discrimination test for the pronunciation pipeline.
// Generates a known-good and a known-bad audio sample, posts both to the
// running dev server, and prints score + signal breakdown for each.
import OpenAI from 'openai';
import fs from 'fs';

const key = fs.readFileSync('.env.local', 'utf8').match(/OPENAI_API_KEY=(.+)/)[1].trim();
const openai = new OpenAI({ apiKey: key });

const PHRASE = 'Bom dia, como você está hoje?'; // br1
const GOOD_PATH = '/tmp/pt-test-good.mp3';
const BAD_PATH = '/tmp/pt-test-bad.mp3';

async function makeGood() {
  if (fs.existsSync(GOOD_PATH)) return;
  // Native-quality sample in a DIFFERENT voice from the server's reference (onyx)
  const r = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'nova',
    input: PHRASE,
    speed: 1.0,
  });
  fs.writeFileSync(GOOD_PATH, Buffer.from(await r.arrayBuffer()));
  console.log('generated good sample');
}

async function makeBad() {
  if (fs.existsSync(BAD_PATH)) return;
  // A heavy American-accented reading, via gpt-audio speech generation
  const completion = await openai.chat.completions.create({
    model: 'gpt-audio-1.5',
    modalities: ['text', 'audio'],
    audio: { voice: 'ash', format: 'mp3' },
    messages: [
      {
        role: 'user',
        content: `You are voicing a character in a language-learning app: a monolingual American tourist who has never heard Portuguese, reading a phrase off a card. Say exactly this phrase, but pronounce it the way that American would: hard American r's, flat English vowels, no nasal sounds, English-style stress, hard d's and t's. Phrase: "${PHRASE}". Say only the phrase.`,
      },
    ],
  });
  const audio = completion.choices[0]?.message?.audio;
  if (!audio?.data) throw new Error('no audio in response: ' + JSON.stringify(completion.choices[0]?.message).slice(0, 300));
  fs.writeFileSync(BAD_PATH, Buffer.from(audio.data, 'base64'));
  console.log('generated bad sample (transcript said:', audio.transcript, ')');
}

async function assess(file, label) {
  const form = new FormData();
  form.append('audio', new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }), 'recording.webm');
  form.append('phraseId', 'br1');
  form.append('dialect', 'pt-BR');
  const res = await fetch('http://localhost:3000/api/feedback', { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok) {
    console.log(label, 'FAILED', res.status, JSON.stringify(json));
    return;
  }
  console.log(`\n=== ${label} ===`);
  console.log('score:     ', json.score);
  console.log('breakdown: ', JSON.stringify(json.analysis?.breakdown));
  console.log('words:     ', json.analysis?.words?.map((w) => `${w.word}:${w.status}`).join('  '));
  console.log('errors:    ', json.analysis?.errors?.map((e) => `${e.word}(${e.severity})`).join('  '));
  console.log('transcript:', json.transcript);
  console.log('summary:   ', json.analysis?.summary);
}

await makeGood();
await makeBad();
await assess(GOOD_PATH, 'GOOD (native TTS, different voice)');
await assess(BAD_PATH, 'BAD (deliberate heavy American accent)');
