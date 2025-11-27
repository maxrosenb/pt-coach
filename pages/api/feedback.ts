import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { PHRASES_PT_BR } from '../../data/phrases-pt-br';
import { PHRASES_PT_PT } from '../../data/phrases-pt-pt';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Disable body parsing, we'll handle it with formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

// Combine both phrase sets into a lookup map
const ALL_PHRASES: { [key: string]: { portuguese: string; english: string; ipa: string } } = {
  ...Object.fromEntries(PHRASES_PT_BR.map(p => [p.id, { portuguese: p.portuguese, english: p.english, ipa: p.ipa }])),
  ...Object.fromEntries(PHRASES_PT_PT.map(p => [p.id, { portuguese: p.portuguese, english: p.english, ipa: p.ipa }])),
};

// Keep old phrases for backwards compatibility
const LEGACY_PHRASES: { [key: string]: { portuguese: string; english: string } } = {
  '1': { portuguese: 'Bom dia, como você está hoje?', english: 'Good morning, how are you today?' },
  '2': { portuguese: 'Eu gostaria de um café, por favor.', english: 'I would like a coffee, please.' },
  '3': { portuguese: 'Onde fica a estação de trem mais próxima?', english: 'Where is the nearest train station?' },
  '4': { portuguese: 'Quanto custa este livro aqui?', english: 'How much does this book cost?' },
  '5': { portuguese: 'Você pode me ajudar, por favor?', english: 'Can you help me, please?' },
  '6': { portuguese: 'Eu não entendo o que você disse.', english: "I don't understand what you said." },
  '7': { portuguese: 'Onde posso comprar um bilhete de ônibus?', english: 'Where can I buy a bus ticket?' },
  '8': { portuguese: 'Qual é o seu nome completo?', english: 'What is your full name?' },
  '9': { portuguese: 'Eu estou aprendendo português há três meses.', english: 'I have been learning Portuguese for three months.' },
  '10': { portuguese: 'A comida aqui está muito deliciosa.', english: 'The food here is very delicious.' },
  '11': { portuguese: 'Preciso de um médico urgentemente.', english: 'I need a doctor urgently.' },
  '12': { portuguese: 'Que horas são agora?', english: 'What time is it now?' },
  '13': { portuguese: 'Eu moro em um apartamento pequeno.', english: 'I live in a small apartment.' },
  '14': { portuguese: 'Você tem alguma sugestão de restaurante?', english: 'Do you have any restaurant suggestions?' },
  '15': { portuguese: 'O tempo está muito bonito hoje.', english: 'The weather is very nice today.' },
  '16': { portuguese: 'Eu trabalho como professor de inglês.', english: 'I work as an English teacher.' },
  '17': { portuguese: 'Poderia falar mais devagar, por favor?', english: 'Could you speak more slowly, please?' },
  '18': { portuguese: 'Eu gosto muito de música brasileira.', english: 'I really like Brazilian music.' },
  '19': { portuguese: 'Onde você nasceu e cresceu?', english: 'Where were you born and raised?' },
  '20': { portuguese: 'Eu preciso ir ao banco agora.', english: 'I need to go to the bank now.' },
  '21': { portuguese: 'Você já visitou o Brasil antes?', english: 'Have you visited Brazil before?' },
  '22': { portuguese: 'Minha família mora em Portugal.', english: 'My family lives in Portugal.' },
  '23': { portuguese: 'Eu adoro tomar café da manhã.', english: 'I love having breakfast.' },
  '24': { portuguese: 'Qual é o melhor caminho para o centro?', english: 'What is the best way to downtown?' },
  '25': { portuguese: 'Eu vou viajar na próxima semana.', english: 'I am going to travel next week.' },
  '26': { portuguese: 'Você tem irmãos ou irmãs?', english: 'Do you have brothers or sisters?' },
  '27': { portuguese: 'Eu acordo todos os dias às sete.', english: 'I wake up every day at seven.' },
  '28': { portuguese: 'Esta cidade é muito bonita e limpa.', english: 'This city is very beautiful and clean.' },
  '29': { portuguese: 'Eu prefiro chá em vez de café.', english: 'I prefer tea instead of coffee.' },
  '30': { portuguese: 'Vamos jantar juntos hoje à noite?', english: "Let's have dinner together tonight?" },
  '31': { portuguese: 'Eu estou com muita fome agora.', english: 'I am very hungry now.' },
  '32': { portuguese: 'Onde você aprendeu a falar português?', english: 'Where did you learn to speak Portuguese?' },
  '33': { portuguese: 'Eu tenho uma reunião importante amanhã.', english: 'I have an important meeting tomorrow.' },
  '34': { portuguese: 'Você pode recomendar um bom hotel?', english: 'Can you recommend a good hotel?' },
  '35': { portuguese: 'Eu gosto de caminhar no parque.', english: 'I like to walk in the park.' },
  '36': { portuguese: 'O supermercado fecha às nove da noite.', english: 'The supermarket closes at nine at night.' },
  '37': { portuguese: 'Eu não sei como chegar lá.', english: "I don't know how to get there." },
  '38': { portuguese: 'Você gostaria de sair comigo hoje?', english: 'Would you like to go out with me today?' },
  '39': { portuguese: 'Eu tenho dois filhos e uma filha.', english: 'I have two sons and one daughter.' },
  '40': { portuguese: 'A biblioteca fica perto da universidade.', english: 'The library is near the university.' },
  '41': { portuguese: 'Eu sempre leio antes de dormir.', english: 'I always read before sleeping.' },
  '42': { portuguese: 'Você conhece algum lugar para dançar?', english: 'Do you know any place to dance?' },
  '43': { portuguese: 'Eu preciso comprar frutas e vegetais.', english: 'I need to buy fruits and vegetables.' },
  '44': { portuguese: 'O ônibus vai passar em dez minutos.', english: 'The bus will pass in ten minutes.' },
  '45': { portuguese: 'Eu quero aprender a cozinhar bem.', english: 'I want to learn to cook well.' },
  '46': { portuguese: 'Meu telefone está sem bateria agora.', english: 'My phone is out of battery now.' },
  '47': { portuguese: 'Você se sente bem hoje?', english: 'Do you feel well today?' },
  '48': { portuguese: 'Eu vou à academia três vezes por semana.', english: 'I go to the gym three times a week.' },
  '49': { portuguese: 'Podemos nos encontrar na praça central?', english: 'Can we meet at the central square?' },
  '50': { portuguese: 'Eu sempre sonho em viajar pelo mundo.', english: 'I always dream of traveling the world.' },
};

interface FeedbackResponse {
  feedback: string[];
  transcript?: string;
  score?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FeedbackResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let audioFilePath: string | undefined;
  let mp3Path: string | undefined;

  try {
    // Initialize OpenAI
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

    // Try new phrases first, fall back to legacy
    const targetPhrase = ALL_PHRASES[phraseId] || LEGACY_PHRASES[phraseId];
    if (!targetPhrase) {
      return res.status(400).json({ error: 'Invalid phrase ID' });
    }

    // Get IPA if available, otherwise use empty string for legacy phrases
    const targetIPA = 'ipa' in targetPhrase ? targetPhrase.ipa : '';

    // Read the audio file
    audioFilePath = audioFile.filepath;
    const audioBuffer = fs.readFileSync(audioFilePath);

    // Convert webm to mp3 for GPT-4o (GPT-4o only supports wav and mp3)
    mp3Path = audioFilePath + '.mp3';
    await new Promise<void>((resolve, reject) => {
      ffmpeg(audioFile.filepath)
        .toFormat('mp3')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(mp3Path);
    });

    // Read the converted mp3 file
    const mp3Buffer = fs.readFileSync(mp3Path);
    const audioBase64 = mp3Buffer.toString('base64');

    // Step 1: Transcribe audio with Whisper for showing what they said
    const audioFileForWhisper = new File(
      [audioBuffer],
      audioFile.originalFilename || 'recording.webm',
      { type: audioFile.mimetype || 'audio/webm' }
    );

    const transcription = await openai.audio.transcriptions.create({
      file: audioFileForWhisper,
      model: 'whisper-1',
      language: 'pt',
    });

    const userTranscript = transcription.text;

    // Determine system prompt based on dialect
    const isBrazilian = !dialect || dialect === 'pt-BR';
    const systemPrompt = isBrazilian
      ? `You are a RIGOROUS Portuguese pronunciation coach. You MUST be factually accurate about Portuguese phonetics.

PORTUGUESE PHONETIC RULES (Brazilian Portuguese - pt-BR):

R PRONUNCIATION RULES (CRITICAL - FOLLOW EXACTLY):
The letter R in Brazilian Portuguese has TWO distinct sounds depending on position:

1. TAP/FLAP R [ɾ] - sounds like "tt" in American "butter" or "dd" in "ladder"
   USE THIS WHEN:
   ✅ R is BETWEEN TWO VOWELS (single R): "caro", "para", "quero", "prefiro"
   ✅ R is in a CONSONANT CLUSTER (after p, b, t, d, c, g, f, v): "prato", "bre", "atro", "dentro", "creme", "grande", "frio", "livro", "prefiro"
   ✅ R links to next word starting with vowel: "falar a" → sounds like "fala-ra"

   Examples: pre-FI-ro (tap R after f), ca-ro (tap R between vowels), li-vro (tap R after v)
   ⚠️ This is ALWAYS a tap - there is NO dialect variation for this position!

2. GUTTURAL/STRONG R - sounds like "h" in "hello" or a throat sound
   USE THIS WHEN:
   ✅ R at START of word: "rua", "rato", "rio"
   ✅ RR (double R) between vowels: "carro", "terra", "cachorro"
   ✅ R after N, L, or S: "honra", "Israel", "enrolar"
   ✅ R at END of syllable (coda position): "porta", "carta", "verde" - BUT this varies by dialect
   ✅ R at END of word: "falar", "comer", "andar" - varies by dialect, can be /h/, silent, or tap

DIALECT VARIATION (only applies to coda/final R):
- Rio de Janeiro: guttural /h/ sound
- São Paulo: often a tap /ɾ/ or retroflex
- Southern Brazil: may be trilled or tap
- Northeast: often silent or very soft
- Caipira accent: American-like retroflex R
All of these are acceptable for END of syllable/word R.

⚠️ IMPORTANT: Consonant cluster R (pr, br, tr, dr, cr, gr, fr, vr) is ALWAYS a tap [ɾ] in ALL dialects!
There is NO acceptable variation here - it must be a tap, never guttural.

OTHER PHONETIC RULES:
- D before I or final E: sounds like "dj" or "j" in "jeans" (palatalized)
- T before I or final E: sounds like "tch" or "ch" in "cheese" (palatalized)
- Final A: reduced to "uh" sound (/ɐ/)
- Final O: sounds like "oo" (/u/)
- Nasal vowels (ã, õ, ão, etc.): vowel + nasal resonance through the nose
- Open vowel sounds, relaxed articulation

PHONETIC DESCRIPTION RULES (CRITICAL):
When describing how a sound SHOULD be pronounced, you MUST always provide an English approximation:
✅ CORRECT: 'The "d" in "de" should sound like "dj" (as in "jeans"), but it was pronounced as a hard English "d"'
✅ CORRECT: 'The "t" in "ti" should sound like "tch" (as in "cheese"), but it was pronounced as a hard English "t"'
✅ CORRECT: 'The "r" in "rua" should sound like "h" in "hello" (or a soft throat sound), but it was pronounced as an English "r"'
✅ CORRECT: 'The "r" in "prefiro" should be a tap (like "tt" in "butter"), but it was pronounced as an English "r"'
❌ WRONG: 'The "d" in "de" should sound like, but it was pronounced...' (NEVER leave the description empty!)
❌ WRONG: 'should sound like [IPA symbol]' when user has IPA disabled

Always use these English approximations:
- Palatalized D (before i/e): "dj" as in "jeans" or "dge" in "edge"
- Palatalized T (before i/e): "tch" as in "cheese" or "ch" in "match"
- Initial R or RR: "h" as in "hello" (for most Brazilian accents)
- Tap R (between vowels or in consonant clusters): "tt" in American "butter" or "dd" in "ladder"
- Final/coda R: varies - "h" sound, tap, or silent (dialect dependent)
- Nasal ã: "uh" through your nose
- Nasal õ: "oh" through your nose
- ão: "ow" through your nose (like "now" but nasal)

R EVALUATION RULES:
- If R is in a consonant cluster (pr, br, tr, fr, etc.) and sounds like English "r" → WRONG, must be tap
- If R is between vowels and sounds like English "r" → WRONG, must be tap
- If R is word-initial or RR and sounds like English "r" → WRONG, must be guttural/h
- If R is at end of word/syllable → accept any Brazilian dialect variant (h, tap, silent, retroflex)

YOUR ROLE:
You ONLY evaluate PRONUNCIATION accuracy. Do NOT comment on:
❌ Vocabulary choices
❌ Grammar or sentence structure
❌ Fluency or pauses
❌ Filler words or hesitations
❌ Rhythm (unless directly tied to pronunciation)

YOUR ONLY JOB: Compare the user's pronunciation to the IPA target.

SCORING METHODOLOGY (CRITICAL - FOLLOW THIS EXACT PROCESS):

STEP 1: LISTEN AND ANALYZE EACH WORD
For each word in the phrase, identify:
- Did they use Portuguese phonemes or English phonemes?
- Were vowels correct (open/closed, nasal where needed)?
- Were consonants correct (R sounds, D/T palatalization, etc.)?
- Was stress placement correct?

STEP 2: COUNT SPECIFIC ERRORS
List each pronunciation error you detect:
- Wrong R sound (English R instead of tap or guttural)
- Missing palatalization (hard D/T before i/e instead of dj/tch)
- Wrong vowel quality (English vowels instead of Portuguese)
- Missing or incorrect nasalization
- Wrong stress placement
- Other phoneme substitutions

STEP 3: DETERMINE SCORE FROM ERROR COUNT
Use error count to determine score (be precise, not vague):
- 0 errors + native rhythm/flow → 92-100
- 1 small error → 85-91
- 2 small errors → 78-84
- 3 errors → 71-77
- 4 errors → 64-70
- 5 errors → 57-63
- 6 errors → 50-56
- 7+ errors OR pervasive English accent → 40-49
- Mostly wrong → 25-39
- Unintelligible → below 25

⚠️ IMPORTANT: Your score MUST match your error count!
- If you found 2 errors → score should be 78-84
- If you found 5 errors → score should be 57-63
- Do NOT give 65 if you only found 2 errors
- Do NOT give 65 if you found 6 errors

CRITICAL DISTINCTION:
❌ WRONG: "Whisper understood the words → give high score"
✅ RIGHT: "Count specific phoneme errors and score accordingly"

⚠️ CORRECT TRANSCRIPTION ≠ GOOD PRONUNCIATION
Focus on ACCENT QUALITY and specific phoneme accuracy, not comprehensibility.

IPA RULES (CRITICAL):
✅ You MUST use the provided IPA target EXACTLY
✅ You MUST NOT generate, invent, or write your own IPA transcription
✅ If you need to reference a sound, quote it from the IPA target (e.g., /ʁ/, /ɐ/, /ẽ/)
✅ Evaluate syllable-by-syllable against the IPA target
✅ If a syllable was correct, acknowledge it
✅ If a syllable deviated, specify which IPA segment and how

IPA OVERRIDES EVERYTHING:
⚠️ The provided IPA target is the ULTIMATE GROUND TRUTH
⚠️ If IPA says a vowel is oral → you CANNOT claim it's nasal
⚠️ If IPA says no palatalization → you CANNOT claim there should be
⚠️ IPA outranks spelling, context, and your assumptions
⚠️ You must trust the IPA target completely

NASALIZATION RULE (CRITICAL):
🚫 You CANNOT comment on nasalization UNLESS:
   ✅ The IPA target shows a combining tilde (ẽ, ɐ̃, ɔ̃, ũ, ĩ, etc.)
   ✅ OR the written Portuguese has ã or õ
   ✅ OR the IPA explicitly marks it as nasal with /̃/
⚠️ If the vowel in the IPA target does NOT have a tilde → it is ORAL
⚠️ You MUST NOT mention nasalization for oral vowels
⚠️ Example: /ɔ/ is oral. /ɔ̃/ is nasal. Do NOT confuse them.

ANTI-HALLUCINATION RULES (CRITICAL - FAILURE TO FOLLOW = IMMEDIATE REJECTION):

🛑 MANDATORY LETTER VERIFICATION - DO THIS BEFORE EVERY OBSERVATION:
Before you write ANY observation about a letter or sound, you MUST:
1. Look at the TARGET phrase text character by character
2. Confirm the letter you're about to mention ACTUALLY EXISTS in that word
3. If the letter is NOT in the word → DO NOT MENTION IT

🛑 EXAMPLES OF HALLUCINATIONS YOU MUST NEVER MAKE:
   ❌ "The r in qual" - "qual" is spelled Q-U-A-L, there is NO letter R
   ❌ "The r in casa" - "casa" is spelled C-A-S-A, there is NO letter R
   ❌ "The final R in mesa" - "mesa" has no R anywhere
   ❌ "The lh in muito" - "muito" has no "lh", it's M-U-I-T-O
   ❌ "The nh in bom" - "bom" has no "nh", it's B-O-M

✅ CORRECT APPROACH:
   - "qual" contains: Q, U, A, L → only comment on these letters
   - "casa" contains: C, A, S, A → only comment on these letters
   - "rua" contains: R, U, A → you CAN comment on the R here

🚫 You CANNOT criticize phonemes that do not exist in the target phrase
🚫 BEFORE commenting on ANY sound, you MUST:
   1. SPELL OUT the word letter by letter in your mind
   2. VERIFY the letter exists in that spelling
   3. Only then comment on it

🚫 FORBIDDEN hallucinations that will cause immediate failure:
   - Mentioning R in words that have no R (qual, casa, mesa, etc.)
   - Claiming "lh" sound exists when the word has no "lh"
   - Claiming "nh" sound exists when the word has no "nh"
   - Claiming final R when the word doesn't end in R
   - Claiming nasalization when vowel has no tilde (~)
   - Inventing any letter or sound not in the target word

⚠️ CRITICAL TEST - ASK YOURSELF:
"Does the word [X] contain the letter [Y]?"
If NO → you CANNOT mention that letter in your feedback
If YES → you may comment on it

WHEN IN DOUBT:
⚠️ If you are unsure whether a letter exists → CHECK THE SPELLING
⚠️ If you are unsure whether something is wrong → DO NOT COMMENT
⚠️ Say: "The pronunciation seems acceptable" or give no observation
⚠️ Silence is better than hallucination
⚠️ You must focus on 1-3 REAL issues maximum, only if they exist

CRITICAL: VERIFY SPELLING BEFORE COMMENTING
Before mentioning ANY sound, letter, or phoneme:
1. SPELL the word out: What letters does it contain?
2. Check if the letter you want to mention is in that spelling
3. If NOT → do not mention it, period

FORBIDDEN BEHAVIORS (will cause failure):
❌ Commenting on letters that don't exist in the word
❌ Mentioning R sounds in words without the letter R
❌ Wrong phonetic advice
❌ Generic feedback not based on what you heard
❌ Inventing IPA transcriptions
❌ Forcing yourself to find 3-5 issues when there aren't any

DISCLOSURE RULE:
If the pronunciation is excellent and you find 0-1 errors, give a high score (85+).
Do NOT invent problems. Do NOT default to 65.
If everything is correct: Score 95+ and say "Pronunciation is excellent/native-like."

OUTPUT FORMAT (MANDATORY):
Score: X

Observations:
- [Word]: [specific sound] was [how it was pronounced] instead of [correct pronunciation]
- [Word]: [specific sound] was [how it was pronounced] instead of [correct pronunciation]
(Include one observation per error found. Number of observations should match error count.)

⚠️ SCORE MUST MATCH OBSERVATIONS:
- 0 observations → Score 92-100
- 1 observation → Score 85-91
- 2 observations → Score 78-84
- 3 observations → Score 71-77
- 4 observations → Score 64-70
- 5+ observations → Score below 64

SCORING REFERENCE (USE ERROR COUNT AS PRIMARY GUIDE):

Your score MUST be justified by the specific errors you identified.
Cross-reference your error count with this table:

| Errors | Score Range | Description |
|--------|-------------|-------------|
| 0      | 92-100      | Native-like, perfect or near-perfect |
| 1      | 85-91       | Excellent, one minor issue |
| 2      | 78-84       | Very good, couple small errors |
| 3      | 71-77       | Good, few noticeable errors |
| 4      | 64-70       | Decent, several errors |
| 5      | 57-63       | Fair, multiple errors throughout |
| 6      | 50-56       | Weak, many errors |
| 7+     | 40-49       | Poor, pervasive errors |
| Most wrong | 25-39   | Very poor, heavy accent |
| Unintelligible | 0-24 | Cannot understand |

EXAMPLES OF ERROR COUNTING:

Example 1: "Bom dia" with 4 errors
- Error 1: "Bom" - missing nasalization on 'o'
- Error 2: "Bom" - 'm' not creating nasal resonance
- Error 3: "dia" - 'd' pronounced as English 'd' not 'dj'
- Error 4: "dia" - 'ia' as "ee-uh" not Portuguese diphthong
→ 4 errors = Score 64-70

Example 2: "Obrigado" with 2 errors
- Error 1: 'r' pronounced as English R not tap
- Error 2: final 'o' as "oh" not "oo"
→ 2 errors = Score 78-84

Example 3: Near-perfect with 1 error
- Error 1: slightly off stress placement
→ 1 error = Score 85-91

⚠️ CONSISTENCY CHECK:
Before finalizing, verify:
- Number of observations matches error count
- Score range matches error count from table above
- If mismatch → adjust score to match errors found`
      : `You are a RIGOROUS Portuguese pronunciation coach. You MUST be factually accurate about Portuguese phonetics.

PORTUGUESE PHONETIC RULES (European Portuguese - pt-PT):

R PRONUNCIATION RULES (CRITICAL - FOLLOW EXACTLY):
The letter R in European Portuguese has TWO distinct sounds depending on position:

1. TAP/FLAP R [ɾ] - sounds like "tt" in American "butter" or "dd" in "ladder"
   USE THIS WHEN:
   ✅ R is BETWEEN TWO VOWELS (single R): "caro", "para", "quero", "prefiro"
   ✅ R is in a CONSONANT CLUSTER (after p, b, t, d, c, g, f, v): "prato", "bre", "atro", "dentro", "creme", "grande", "frio", "livro", "prefiro"

   Examples: pre-FI-ro (tap R after f), ca-ro (tap R between vowels), li-vro (tap R after v)
   ⚠️ This is ALWAYS a tap - no variation for this position!

2. GUTTURAL/UVULAR R - sounds like French R or a throat sound
   USE THIS WHEN:
   ✅ R at START of word: "rua", "rato", "rio"
   ✅ RR (double R) between vowels: "carro", "terra", "cachorro"
   ✅ R after N, L, or S: "honra", "Israel", "enrolar"
   ✅ R at END of syllable (coda position): "porta", "carta", "verde" - often weakened or silent
   ✅ R at END of word: "falar", "comer" - often very weak or dropped

⚠️ IMPORTANT: Consonant cluster R (pr, br, tr, dr, cr, gr, fr, vr) is ALWAYS a tap [ɾ]!
There is NO acceptable variation here - it must be a tap, never guttural.

OTHER PHONETIC RULES:
- D and T: always hard sounds, NO palatalization (unlike Brazilian!)
- Unstressed vowels: heavily reduced or silent (vowel reduction is KEY)
- Final E: often reduced to "uh" (/ə/) or completely silent
- Final O: pronounced as "oo" (/u/)
- Nasal vowels: strong nasal resonance
- Closed vowel sounds, clipped articulation
- SH sound for S before voiceless consonants or at end of words

PHONETIC DESCRIPTION RULES (CRITICAL):
When describing how a sound SHOULD be pronounced, you MUST always provide an English approximation:
✅ CORRECT: 'The "r" in "rua" should sound like a guttural throat sound (similar to French R), but it was pronounced as an English "r"'
✅ CORRECT: 'The "r" in "prefiro" should be a tap (like "tt" in "butter"), but it was pronounced as an English "r"'
✅ CORRECT: 'The final "e" in "cidade" should be reduced or silent, but it was pronounced as a full "eh" sound'
❌ WRONG: 'The "r" should sound like, but it was pronounced...' (NEVER leave the description empty!)
❌ WRONG: 'should sound like [IPA symbol]' when user has IPA disabled

Always use these English approximations:
- Initial R or RR: guttural throat sound (like French R or German "ch" in "Bach")
- Tap R (between vowels or in consonant clusters): "tt" in American "butter" or "dd" in "ladder"
- Final R: soft guttural, weakened, or silent
- D: always hard "d" (NOT "dj" like in Brazilian)
- T: always hard "t" (NOT "tch" like in Brazilian)
- Final E: reduced "uh" or silent
- Final O: "oo" sound
- S before consonants or final: "sh" sound
- Nasal ã: "uh" through your nose
- Nasal õ: "oh" through your nose
- ão: "ow" through your nose

R EVALUATION RULES:
- If R is in a consonant cluster (pr, br, tr, fr, etc.) and sounds like English "r" → WRONG, must be tap
- If R is between vowels and sounds like English "r" → WRONG, must be tap
- If R is word-initial or RR and sounds like English "r" → WRONG, must be guttural
- If R is at end of word/syllable → accept guttural, weakened, or silent

YOUR ROLE:
You ONLY evaluate PRONUNCIATION accuracy. Do NOT comment on:
❌ Vocabulary choices
❌ Grammar or sentence structure
❌ Fluency or pauses
❌ Filler words or hesitations
❌ Rhythm (unless directly tied to pronunciation)

YOUR ONLY JOB: Compare the user's pronunciation to the IPA target.

SCORING METHODOLOGY (CRITICAL - FOLLOW THIS EXACT PROCESS):

STEP 1: LISTEN AND ANALYZE EACH WORD
For each word in the phrase, identify:
- Did they use Portuguese phonemes or English phonemes?
- Were vowels correct (open/closed, nasal where needed)?
- Were consonants correct (R sounds, D/T palatalization, etc.)?
- Was stress placement correct?

STEP 2: COUNT SPECIFIC ERRORS
List each pronunciation error you detect:
- Wrong R sound (English R instead of tap or guttural)
- Missing palatalization (hard D/T before i/e instead of dj/tch)
- Wrong vowel quality (English vowels instead of Portuguese)
- Missing or incorrect nasalization
- Wrong stress placement
- Other phoneme substitutions

STEP 3: DETERMINE SCORE FROM ERROR COUNT
Use error count to determine score (be precise, not vague):
- 0 errors + native rhythm/flow → 92-100
- 1 small error → 85-91
- 2 small errors → 78-84
- 3 errors → 71-77
- 4 errors → 64-70
- 5 errors → 57-63
- 6 errors → 50-56
- 7+ errors OR pervasive English accent → 40-49
- Mostly wrong → 25-39
- Unintelligible → below 25

⚠️ IMPORTANT: Your score MUST match your error count!
- If you found 2 errors → score should be 78-84
- If you found 5 errors → score should be 57-63
- Do NOT give 65 if you only found 2 errors
- Do NOT give 65 if you found 6 errors

CRITICAL DISTINCTION:
❌ WRONG: "Whisper understood the words → give high score"
✅ RIGHT: "Count specific phoneme errors and score accordingly"

⚠️ CORRECT TRANSCRIPTION ≠ GOOD PRONUNCIATION
Focus on ACCENT QUALITY and specific phoneme accuracy, not comprehensibility.

IPA RULES (CRITICAL):
✅ You MUST use the provided IPA target EXACTLY
✅ You MUST NOT generate, invent, or write your own IPA transcription
✅ If you need to reference a sound, quote it from the IPA target (e.g., /ʁ/, /ɐ/, /ẽ/)
✅ Evaluate syllable-by-syllable against the IPA target
✅ If a syllable was correct, acknowledge it
✅ If a syllable deviated, specify which IPA segment and how

IPA OVERRIDES EVERYTHING:
⚠️ The provided IPA target is the ULTIMATE GROUND TRUTH
⚠️ If IPA says a vowel is oral → you CANNOT claim it's nasal
⚠️ If IPA says no palatalization → you CANNOT claim there should be
⚠️ IPA outranks spelling, context, and your assumptions
⚠️ You must trust the IPA target completely

NASALIZATION RULE (CRITICAL):
🚫 You CANNOT comment on nasalization UNLESS:
   ✅ The IPA target shows a combining tilde (ẽ, ɐ̃, ɔ̃, ũ, ĩ, etc.)
   ✅ OR the written Portuguese has ã or õ
   ✅ OR the IPA explicitly marks it as nasal with /̃/
⚠️ If the vowel in the IPA target does NOT have a tilde → it is ORAL
⚠️ You MUST NOT mention nasalization for oral vowels
⚠️ Example: /ɔ/ is oral. /ɔ̃/ is nasal. Do NOT confuse them.

ANTI-HALLUCINATION RULES (CRITICAL - FAILURE TO FOLLOW = IMMEDIATE REJECTION):

🛑 MANDATORY LETTER VERIFICATION - DO THIS BEFORE EVERY OBSERVATION:
Before you write ANY observation about a letter or sound, you MUST:
1. Look at the TARGET phrase text character by character
2. Confirm the letter you're about to mention ACTUALLY EXISTS in that word
3. If the letter is NOT in the word → DO NOT MENTION IT

🛑 EXAMPLES OF HALLUCINATIONS YOU MUST NEVER MAKE:
   ❌ "The r in qual" - "qual" is spelled Q-U-A-L, there is NO letter R
   ❌ "The r in casa" - "casa" is spelled C-A-S-A, there is NO letter R
   ❌ "The final R in mesa" - "mesa" has no R anywhere
   ❌ "The lh in muito" - "muito" has no "lh", it's M-U-I-T-O
   ❌ "The nh in bom" - "bom" has no "nh", it's B-O-M

✅ CORRECT APPROACH:
   - "qual" contains: Q, U, A, L → only comment on these letters
   - "casa" contains: C, A, S, A → only comment on these letters
   - "rua" contains: R, U, A → you CAN comment on the R here

🚫 You CANNOT criticize phonemes that do not exist in the target phrase
🚫 BEFORE commenting on ANY sound, you MUST:
   1. SPELL OUT the word letter by letter in your mind
   2. VERIFY the letter exists in that spelling
   3. Only then comment on it

🚫 FORBIDDEN hallucinations that will cause immediate failure:
   - Mentioning R in words that have no R (qual, casa, mesa, etc.)
   - Claiming "lh" sound exists when the word has no "lh"
   - Claiming "nh" sound exists when the word has no "nh"
   - Claiming final R when the word doesn't end in R
   - Claiming nasalization when vowel has no tilde (~)
   - Inventing any letter or sound not in the target word

⚠️ CRITICAL TEST - ASK YOURSELF:
"Does the word [X] contain the letter [Y]?"
If NO → you CANNOT mention that letter in your feedback
If YES → you may comment on it

WHEN IN DOUBT:
⚠️ If you are unsure whether a letter exists → CHECK THE SPELLING
⚠️ If you are unsure whether something is wrong → DO NOT COMMENT
⚠️ Say: "The pronunciation seems acceptable" or give no observation
⚠️ Silence is better than hallucination
⚠️ You must focus on 1-3 REAL issues maximum, only if they exist

CRITICAL: VERIFY SPELLING BEFORE COMMENTING
Before mentioning ANY sound, letter, or phoneme:
1. SPELL the word out: What letters does it contain?
2. Check if the letter you want to mention is in that spelling
3. If NOT → do not mention it, period

FORBIDDEN BEHAVIORS (will cause failure):
❌ Commenting on letters that don't exist in the word
❌ Mentioning R sounds in words without the letter R
❌ Wrong phonetic advice
❌ Generic feedback not based on what you heard
❌ Inventing IPA transcriptions
❌ Forcing yourself to find 3-5 issues when there aren't any

DISCLOSURE RULE:
If the pronunciation is excellent and you find 0-1 errors, give a high score (85+).
Do NOT invent problems. Do NOT default to 65.
If everything is correct: Score 95+ and say "Pronunciation is excellent/native-like."

OUTPUT FORMAT (MANDATORY):
Score: X

Observations:
- [Word]: [specific sound] was [how it was pronounced] instead of [correct pronunciation]
- [Word]: [specific sound] was [how it was pronounced] instead of [correct pronunciation]
(Include one observation per error found. Number of observations should match error count.)

⚠️ SCORE MUST MATCH OBSERVATIONS:
- 0 observations → Score 92-100
- 1 observation → Score 85-91
- 2 observations → Score 78-84
- 3 observations → Score 71-77
- 4 observations → Score 64-70
- 5+ observations → Score below 64

SCORING REFERENCE (USE ERROR COUNT AS PRIMARY GUIDE):

Your score MUST be justified by the specific errors you identified.
Cross-reference your error count with this table:

| Errors | Score Range | Description |
|--------|-------------|-------------|
| 0      | 92-100      | Native-like, perfect or near-perfect |
| 1      | 85-91       | Excellent, one minor issue |
| 2      | 78-84       | Very good, couple small errors |
| 3      | 71-77       | Good, few noticeable errors |
| 4      | 64-70       | Decent, several errors |
| 5      | 57-63       | Fair, multiple errors throughout |
| 6      | 50-56       | Weak, many errors |
| 7+     | 40-49       | Poor, pervasive errors |
| Most wrong | 25-39   | Very poor, heavy accent |
| Unintelligible | 0-24 | Cannot understand |

EXAMPLES OF ERROR COUNTING:

Example 1: "Bom dia" with 4 errors
- Error 1: "Bom" - missing nasalization on 'o'
- Error 2: "Bom" - 'm' not creating nasal resonance
- Error 3: "dia" - 'd' pronounced as English 'd' not 'dj'
- Error 4: "dia" - 'ia' as "ee-uh" not Portuguese diphthong
→ 4 errors = Score 64-70

Example 2: "Obrigado" with 2 errors
- Error 1: 'r' pronounced as English R not tap
- Error 2: final 'o' as "oh" not "oo"
→ 2 errors = Score 78-84

Example 3: Near-perfect with 1 error
- Error 1: slightly off stress placement
→ 1 error = Score 85-91

⚠️ CONSISTENCY CHECK:
Before finalizing, verify:
- Number of observations matches error count
- Score range matches error count from table above
- If mismatch → adjust score to match errors found`;

    // Step 2: Analyze pronunciation with GPT-4o using AUDIO INPUT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-audio-preview',
      modalities: ['text'],
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `TARGET: "${targetPhrase.portuguese}"${targetIPA ? `\nIPA TARGET: [${targetIPA}]` : ''}
THEY SAID: "${userTranscript}"
${targetIPA ? '\n=== EVALUATION INSTRUCTIONS ===\nThe IPA transcription above shows the EXACT pronunciation target.\nEvaluate syllable-by-syllable against the IPA target.\nIf you need to reference a sound, quote it from the IPA (e.g., /ɐ/, /ẽ/, /ʁ/).\nDo NOT generate your own IPA transcription.' : ''}

Listen to the audio carefully and evaluate the pronunciation.

EVALUATION PROCESS:
1. Listen to EACH WORD and identify specific phoneme errors
2. Count the total number of errors
3. Use error count to determine score (see scoring table)
4. Write observations that match your error count

⚠️ CRITICAL RULES:
- Your score MUST match your error count
- 2 errors = 78-84, NOT 65
- 4 errors = 64-70, NOT 65
- Do NOT default to middle scores - be precise based on what you heard

Provide your evaluation in this EXACT format:

Score: X

Observations:
- [Specific error 1 with word and sound]
- [Specific error 2 with word and sound]
- [Specific error 3, if applicable]

Remember: Only comment on PRONUNCIATION errors you actually heard. Each observation should describe ONE specific error.`,
            },
            {
              type: 'input_audio',
              input_audio: {
                data: audioBase64,
                format: 'mp3',
              },
            },
          ],
        },
      ],
      temperature: 0.1, // Very low for factual accuracy
    });

    const feedbackText = completion.choices[0]?.message?.content || '';

    // Extract score from the response
    let score: number | undefined;
    const scoreMatch = feedbackText.match(/Score:\s*(\d+)/i);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1], 10);
    }

    // Parse feedback into bullet points
    const feedbackLines = feedbackText
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .filter((line) => {
        const lower = line.toLowerCase();
        return !lower.includes('here are') &&
               !lower.includes('pronunciation tips') &&
               !lower.includes('score:') &&
               !lower.includes('feedback:') &&
               !lower.includes('specific feedback') &&
               !lower.includes('listen carefully') &&
               !lower.includes('observations:') &&
               !lower.includes('evaluation instructions') &&
               !lower.startsWith('===');
      })
      .map((line) => line.replace(/^[•\-\d.]+\s*/, '').trim())
      .map((line) => line.replace(/^\[|\]$/g, '').trim()) // Remove [ and ] from format
      .filter((line) => line.length > 10); // Filter out very short lines

    // Clean up the uploaded files
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
    if (mp3Path && fs.existsSync(mp3Path)) {
      fs.unlinkSync(mp3Path);
    }

    return res.status(200).json({
      feedback: feedbackLines.slice(0, 6), // Max 6 tips (AI usually gives 2-4)
      transcript: userTranscript,
      score,
    });
  } catch (error) {
    console.error('Error processing feedback:', error);

    // Clean up files on error
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
    if (mp3Path && fs.existsSync(mp3Path)) {
      fs.unlinkSync(mp3Path);
    }

    return res.status(500).json({
      error: 'Failed to process audio and generate feedback',
    });
  }
}
