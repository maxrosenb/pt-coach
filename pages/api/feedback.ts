import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Disable body parsing, we'll handle it with formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

const PHRASES: { [key: string]: { portuguese: string; english: string } } = {
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
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!phraseId || !audioFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const targetPhrase = PHRASES[phraseId];
    if (!targetPhrase) {
      return res.status(400).json({ error: 'Invalid phrase ID' });
    }

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

    // Step 2: Analyze pronunciation with GPT-4o using AUDIO INPUT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-audio-preview',
      modalities: ['text'],
      messages: [
        {
          role: 'system',
          content: `You are a RIGOROUS Portuguese pronunciation coach. You MUST be factually accurate about Portuguese phonetics.

PORTUGUESE PHONETIC RULES (Brazilian):
- R at START of word or RR: guttural /h/ sound (like "h" in "hello")
- R between vowels or at end: soft tap /ɾ/ (like tt in "butter")
- D before I or E: often sounds like "j" in "jeans"
- T before I or E: often sounds like "ch" in "cheese"
- Final A, O: reduced, closed vowels (/ɐ/, /u/)
- Nasal vowels (ã, õ, etc.): vowel + nasal resonance

CRITICAL: VERIFY SPELLING BEFORE COMMENTING
Before mentioning ANY sound, letter, or phoneme:
1. Check if that letter actually exists in the word
2. Check the letter's position in the word
3. Verify the expected pronunciation for that specific context

FORBIDDEN BEHAVIORS (will cause failure):
❌ Commenting on letters that don't exist (e.g., "R in cidade" when cidade has no R)
❌ Wrong phonetic advice (e.g., "open the final A" when it should be closed)
❌ Generic feedback not based on what you heard
❌ Forcing yourself to find 3-5 issues when there aren't any

REQUIRED APPROACH:
✅ Listen to the actual audio
✅ Compare to native Brazilian Portuguese
✅ Give 1-3 ACCURATE observations based on what you HEAR
✅ Focus on the most important issues
✅ Praise good pronunciation when deserved

Provide a score from 0-100 on the first line: "Score: X"

SCORING RUBRIC:
- 95-100: Native/near-native quality
- 85-94: Excellent, very minor accent
- 75-84: Advanced, noticeable but good
- 65-74: Intermediate, clear English accent
- 50-64: Basic, strong accent
- 30-49: Poor, heavy accent
- 0-29: Unintelligible

Then provide 1-3 ACCURATE, VERIFIED tips.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `TARGET: "${targetPhrase.portuguese}"
THEY SAID: "${userTranscript}"

VERIFICATION STEP - Words in target phrase:
${targetPhrase.portuguese.split(' ').map(word => `"${word}" - letters: ${word.split('').join(', ')}`).join('\n')}

Listen to the audio and provide ACCURATE feedback.
Score (0-100) based on actual pronunciation quality.
Then 1-3 VERIFIED tips about what you HEARD.

DOUBLE-CHECK: Do NOT mention letters/sounds that don't exist in the target phrase!`,
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
               !lower.includes('listen carefully');
      })
      .map((line) => line.replace(/^[•\-\d.]+\s*/, '').trim())
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
