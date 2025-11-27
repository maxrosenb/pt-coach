import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, dialect } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Use tts-1-hd for higher quality, more natural voice
    // 'onyx' provides a warm, natural male voice good for Portuguese
    // 'nova' provides a warm female voice
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',
      input: text,
      speed: 0.9, // Slightly slower for learning
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

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
