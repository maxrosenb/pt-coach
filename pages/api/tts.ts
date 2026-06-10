import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import os from 'os';
import path from 'path';
import OpenAI from 'openai';
import { PHRASES_PT_BR } from '../../data/phrases-pt-br';
import { PHRASES_PT_PT } from '../../data/phrases-pt-pt';

// Only known phrases can be synthesized — the endpoint must not be an open
// text-to-speech proxy on our API key.
const ALL_PHRASES: { [key: string]: string } = {
  ...Object.fromEntries(PHRASES_PT_BR.map(p => [p.id, p.portuguese])),
  ...Object.fromEntries(PHRASES_PT_PT.map(p => [p.id, p.portuguese])),
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phraseId, dialect } = req.body;
    const text = typeof phraseId === 'string' ? ALL_PHRASES[phraseId] : undefined;
    if (!text) {
      return res.status(400).json({ error: 'Unknown phrase' });
    }
    const dialectKey = dialect === 'pt-PT' ? 'pt-PT' : 'pt-BR';

    // Cached on disk per phrase: TTS is deterministic enough for a practice
    // clip, and repeat listens should be fast and free.
    const cachePath = path.join(os.tmpdir(), `pt-coach-listen-${dialectKey}-${phraseId}.mp3`);
    if (fs.existsSync(cachePath)) {
      const cached = fs.readFileSync(cachePath);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.length);
      return res.status(200).send(cached);
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 'onyx' provides a warm, natural male voice good for Portuguese
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',
      input: text,
      speed: 0.9, // Slightly slower for learning
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(cachePath, buffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Error generating TTS:', error);
    return res.status(500).json({
      error: 'Failed to generate audio',
    });
  }
}
