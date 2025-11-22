# Project: Portuguese Pronunciation Coach (MVP)

Goal: Web app where English speakers learning Portuguese can:
- Pick a phrase
- Hear a native recording
- Record themselves
- Get simple AI pronunciation feedback

Core loop (v0):
1. User selects a phrase from a small set (hardcoded list).
2. User plays native audio (mp3 stored in /public/audio).
3. User records themselves in the browser (desktop Chrome).
4. Frontend sends audio + selected phrase to /api/feedback.
5. Backend:
   - Sends audio to OpenAI Speech-to-Text (model: whisper-1, language: pt) to get transcript.
   - Calls a GPT model with target phrase + transcript + phrase metadata.
   - GPT returns 3–5 short, practical pronunciation tips.
6. Frontend displays feedback nicely.

Tech:
- Next.js (TypeScript)
- Chakra UI for UI
- Next.js API route for /api/feedback
- OpenAI Node SDK for Whisper + GPT
- No auth, no DB, no payments in v0
- Desktop Chrome only for now

