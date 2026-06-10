import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import {
  Box,
  Container,
  Heading,
  Button,
  VStack,
  HStack,
  Flex,
  Text,
  Spinner,
} from '@chakra-ui/react';
import { ColorModeToggle } from '../components/ColorModeToggle';
import { DialectWelcomeModal } from '../components/DialectWelcomeModal';
import { SettingsModal } from '../components/SettingsModal';
import { FlagIcon } from '../components/FlagIcon';
import { PHRASES_PT_BR, Phrase } from '../data/phrases-pt-br';
import { PHRASES_PT_PT } from '../data/phrases-pt-pt';
import {
  PronunciationAnalysis,
  ErrorCategory,
  CATEGORY_LABELS,
  CATEGORY_ADVICE,
} from '../lib/pronunciation';
import { az, SOLID, SERIF, TILE_BG } from '../lib/azulejo';

interface PracticeEntry {
  phraseId: string;
  phrase: string;
  score: number;
  timestamp: number;
  dialect?: 'pt-BR' | 'pt-PT';
  categories?: ErrorCategory[];
}

// --- Azulejo design helpers -------------------------------------------------

function SectionLabel({ pt, en }: { pt: string; en: string }) {
  return (
    <HStack gap={2} mb={4}>
      <Text color={az.gold} fontSize="2xs">◆</Text>
      <Text
        fontSize="xs"
        fontWeight="bold"
        textTransform="uppercase"
        letterSpacing="0.18em"
        color={az.inkSoft}
      >
        <Box as="span" color={az.ink}>{pt}</Box>
        {'  ·  '}
        {en}
      </Text>
    </HStack>
  );
}

function TileDivider() {
  return (
    <HStack gap={3} w="full" px={{ base: 8, md: 14 }}>
      <Box flex={1} h="1px" bg={az.cardLine} />
      <Text color={az.gold} fontSize="2xs" lineHeight={1}>◆</Text>
      <Text color={az.cobalt} fontSize="xs" lineHeight={1}>❖</Text>
      <Text color={az.gold} fontSize="2xs" lineHeight={1}>◆</Text>
      <Box flex={1} h="1px" bg={az.cardLine} />
    </HStack>
  );
}

function Key({ children }: { children: string }) {
  return (
    <Box
      as="kbd"
      px={2}
      py={0.5}
      borderWidth="1px"
      borderColor={az.cardLine}
      borderRadius="md"
      bg={az.cardBg}
      fontSize="2xs"
      fontWeight="bold"
      color={az.inkSoft}
    >
      {children}
    </Box>
  );
}

const scoreTone = (s: number) => {
  if (s >= 85) return { fg: az.sage, wash: az.sageWash, line: az.sageLine };
  if (s >= 70) return { fg: az.cobalt, wash: az.cobaltWash, line: az.cobaltLine };
  if (s >= 55) return { fg: az.ochre, wash: az.ochreWash, line: az.ochreLine };
  return { fg: az.terra, wash: az.terraWash, line: az.terraLine };
};

function Meter({
  labelPt,
  labelEn,
  hint,
  value,
}: {
  labelPt: string;
  labelEn: string;
  hint: string;
  value: number;
}) {
  const tone = scoreTone(value);
  return (
    <Box
      flex={1}
      p={4}
      bg={az.washBg}
      borderWidth="1px"
      borderColor={az.cardLine}
      borderRadius="lg"
    >
      <Flex justify="space-between" align="baseline" mb={2} gap={2}>
        <Text
          fontSize="2xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="0.14em"
          color={az.inkSoft}
        >
          <Box as="span" color={az.ink}>{labelPt}</Box> · {labelEn}
        </Text>
        <Text fontFamily={SERIF} fontWeight={700} color={tone.fg}>
          {value}
        </Text>
      </Flex>
      <Box h="6px" bg={az.cardLine} borderRadius="full" overflow="hidden" mb={2}>
        <Box
          h="full"
          w={`${value}%`}
          bg={tone.fg}
          borderRadius="full"
          transition="width 0.6s ease-out"
        />
      </Box>
      <Text fontSize="2xs" color={az.inkFaint}>{hint}</Text>
    </Box>
  );
}

const LOADING_STEPS = [
  { pt: 'A ouvir a sua gravação…', en: 'Transcribing exactly what you said' },
  { pt: 'A comparar com um nativo…', en: 'Comparing each word against a native speaker' },
  { pt: 'A preparar o seu feedback…', en: 'Writing your coaching notes' },
];

const scoreVerdict = (s: number) => {
  if (s >= 90) return { pt: 'Excelente!', en: 'Native-like — beautiful work' };
  if (s >= 80) return { pt: 'Muito bem!', en: 'A strong attempt' };
  if (s >= 70) return { pt: 'Bom trabalho', en: 'Good — now refine the details' };
  if (s >= 60) return { pt: 'Quase lá', en: "You're getting there" };
  return { pt: 'Continue!', en: 'Keep practicing — it will come' };
};

const DIFFICULTY_TONE = {
  easy: az.sage,
  medium: az.ochre,
  hard: az.terra,
} as const;

const WORD_TILE_STYLES = {
  good: { bg: az.sageWash, color: az.sage, borderColor: az.sageLine },
  minor: { bg: az.ochreWash, color: az.ochre, borderColor: az.ochreLine },
  major: { bg: az.terraWash, color: az.terra, borderColor: az.terraLine },
} as const;

// -----------------------------------------------------------------------------

export default function Home() {
  // Dialect management
  const [dialect, setDialect] = useState<'pt-BR' | 'pt-PT' | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showIpaDetails, setShowIpaDetails] = useState(false); // Default OFF
  const [currentPhrase, setCurrentPhrase] = useState<Phrase | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<PronunciationAnalysis | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [practiceHistory, setPracticeHistory] = useState<PracticeEntry[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showScoreAnimation, setShowScoreAnimation] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Step the loading message through the pipeline stages
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 4500);
    return () => clearInterval(id);
  }, [isLoading]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [highlightedError, setHighlightedError] = useState<number | null>(null);

  // Mirror for the unmount cleanup, whose [] -dep closure would otherwise
  // only ever see the initial null
  const recordedAudioUrlRef = useRef<string | null>(null);
  useEffect(() => {
    recordedAudioUrlRef.current = recordedAudioUrl;
  }, [recordedAudioUrl]);

  // Dialect-tinted accent: warm gold for Brazil, cobalt for Portugal
  const accent =
    dialect === 'pt-PT'
      ? { fg: az.cobalt, line: az.cobaltLine, wash: az.cobaltWash }
      : { fg: az.gold, line: az.goldLine, wash: az.goldWash };

  // Get current phrase set based on dialect
  const getCurrentPhrases = (): Phrase[] => {
    return dialect === 'pt-PT' ? PHRASES_PT_PT : PHRASES_PT_BR;
  };

  // Get dialect info
  const getDialectInfo = () => {
    if (dialect === 'pt-PT') {
      return {
        flagCode: 'PT' as const,
        name: 'European Portuguese',
      };
    }
    return {
      flagCode: 'BR' as const,
      name: 'Brazilian Portuguese',
    };
  };

  // Handle dialect selection from welcome modal
  const handleDialectSelection = (selectedDialect: 'pt-BR' | 'pt-PT') => {
    setDialect(selectedDialect);
    localStorage.setItem('portuguese-dialect', selectedDialect);
    setShowWelcomeModal(false);
  };

  // Handle dialect change from settings
  const handleDialectChange = (newDialect: 'pt-BR' | 'pt-PT') => {
    if (newDialect === dialect) return;

    setDialect(newDialect);
    localStorage.setItem('portuguese-dialect', newDialect);

    // Clear current feedback and get new phrase from new dialect
    clearResults();

    // Get a new phrase from the new dialect set
    const phrases = newDialect === 'pt-PT' ? PHRASES_PT_PT : PHRASES_PT_BR;
    const randomIndex = Math.floor(Math.random() * phrases.length);
    setCurrentPhrase(phrases[randomIndex]);
  };

  // Handle IPA details toggle
  const handleIpaDetailsChange = (show: boolean) => {
    setShowIpaDetails(show);
    localStorage.setItem('show-ipa-details', show.toString());
  };

  // Filter IPA references from feedback for simpler display
  const filterIpaFromFeedback = (feedbackText: string): string => {
    if (showIpaDetails) {
      return feedbackText; // Show as-is if IPA details enabled
    }

    let filtered = feedbackText;

    // Remove IPA transcriptions in parentheses like (/ˈmũj̃.tu/)
    filtered = filtered.replace(/\([\/\[]?[\p{Letter}\p{Mark}\s.ˈˌ:]+[\/\]]?\)/gu, '');

    // Remove IPA in square brackets like [ɐ̃]
    filtered = filtered.replace(/\[[\p{Letter}\p{Mark}\/]+\]/gu, '');

    // Replace individual IPA symbols in slashes with plain text
    const ipaReplacements: { [key: string]: string } = {
      '/ɾ/': '"soft r" sound',
      '/ʁ/': '"guttural r" sound',
      '/r/': '"rolled r" sound',
      '/ɐ̃/': '"nasal a" sound',
      '/ẽ/': '"nasal e" sound',
      '/ĩ/': '"nasal i" sound',
      '/õ/': '"nasal o" sound',
      '/ũ/': '"nasal u" sound',
      '/ɐ/': '"a" sound',
      '/ɛ/': '"open e" sound',
      '/e/': '"closed e" sound',
      '/i/': '"i" sound',
      '/ɔ/': '"open o" sound',
      '/o/': '"closed o" sound',
      '/u/': '"u" sound',
      '/ʃ/': '"sh" sound',
      '/ʒ/': '"zh" sound',
      '/ɲ/': '"nh" sound',
      '/ʎ/': '"lh" sound',
    };

    Object.entries(ipaReplacements).forEach(([ipa, text]) => {
      filtered = filtered.replace(new RegExp(ipa.replace(/[/\\]/g, '\\$&'), 'g'), text);
    });

    // Remove any remaining IPA in slashes
    filtered = filtered.replace(/\/[\p{Letter}\p{Mark}]+\//gu, '');

    // Clean up extra spaces and punctuation
    filtered = filtered.replace(/\s+/g, ' ').trim();
    filtered = filtered.replace(/\s+,/g, ',');
    filtered = filtered.replace(/\s+\./g, '.');

    return filtered;
  };

  // Check for saved dialect and IPA details preference on mount
  useEffect(() => {
    const savedDialect = localStorage.getItem('portuguese-dialect') as 'pt-BR' | 'pt-PT' | null;
    if (savedDialect) {
      setDialect(savedDialect);
    } else {
      setShowWelcomeModal(true);
    }

    // Load IPA details preference (default OFF if not set)
    const savedIpaDetails = localStorage.getItem('show-ipa-details');
    if (savedIpaDetails === 'true') {
      setShowIpaDetails(true);
    }
  }, []);

  // Stop all app audio (native clip + recording playback)
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      recordingAudioRef.current = null;
    }
    setIsPlayingAudio(false);
    setIsPlayingRecording(false);
  };

  // Play TTS audio (blob URLs cached per phrase so repeat listens are instant)
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  const playAudio = async () => {
    if (!currentPhrase || isPlayingAudio) return;

    try {
      stopPlayback();
      setIsPlayingAudio(true);

      const cacheKey = `${dialect}-${currentPhrase.id}`;
      let audioUrl = ttsCacheRef.current.get(cacheKey);
      if (!audioUrl) {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phraseId: currentPhrase.id, dialect }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate audio');
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        ttsCacheRef.current.set(cacheKey, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
        setError('Failed to play audio');
      };

      await audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsPlayingAudio(false);
      setError('Failed to play audio');
    }
  };

  // Play recorded audio
  const playRecording = async () => {
    if (!recordedAudioUrl || isPlayingRecording) return;

    try {
      stopPlayback();
      setIsPlayingRecording(true);

      const audio = new Audio(recordedAudioUrl);
      recordingAudioRef.current = audio;

      audio.onended = () => {
        setIsPlayingRecording(false);
      };

      audio.onerror = () => {
        setIsPlayingRecording(false);
        setError('Failed to play recording');
      };

      await audio.play();
    } catch (err) {
      console.error('Error playing recording:', err);
      setIsPlayingRecording(false);
      setError('Failed to play recording');
    }
  };

  // Load practice history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('practiceHistory');
    if (stored) {
      try {
        setPracticeHistory(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load practice history', e);
      }
    }
  }, []);

  // Save to history
  const savePracticeEntry = (
    phraseId: string,
    phrase: string,
    score: number,
    categories?: ErrorCategory[]
  ) => {
    const entry: PracticeEntry = {
      phraseId,
      phrase,
      score,
      timestamp: Date.now(),
      dialect: dialect || undefined,
      categories,
    };

    const newHistory = [entry, ...practiceHistory].slice(0, 50); // Keep last 50
    setPracticeHistory(newHistory);
    localStorage.setItem('practiceHistory', JSON.stringify(newHistory));
  };

  // Revoke and drop the recorded-audio URL (functional update avoids stale closures)
  const clearRecordedAudio = () => {
    setRecordedAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const clearResults = () => {
    setFeedback([]);
    setAnalysis(null);
    setScore(null);
    setTranscript('');
    setError('');
    clearRecordedAudio();
  };

  const getRandomPhrase = () => {
    if (!dialect) return; // Wait for dialect to be set

    const phrases = getCurrentPhrases();
    let newPhrase: Phrase;
    do {
      const randomIndex = Math.floor(Math.random() * phrases.length);
      newPhrase = phrases[randomIndex];
    } while (currentPhrase && newPhrase.id === currentPhrase.id && phrases.length > 1);

    setCurrentPhrase(newPhrase);
    clearResults();
  };

  // Set initial random phrase when dialect is selected
  useEffect(() => {
    if (dialect && !currentPhrase) {
      getRandomPhrase();
    }
  }, [dialect]);

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      // Clean up timers
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Clean up recorded audio URL
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
      }

      // Clean up cached TTS blob URLs
      ttsCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      ttsCacheRef.current.clear();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignore while a modal is open
      if (showWelcomeModal || showSettingsModal) {
        return;
      }

      // Space to start/stop recording
      if (e.code === 'Space' && !isLoading && currentPhrase) {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }

      // Enter for next phrase
      if (e.code === 'Enter' && !isRecording && !isLoading) {
        e.preventDefault();
        getRandomPhrase();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRecording, isLoading, currentPhrase, showWelcomeModal, showSettingsModal]);

  // Live waveform: frequency bars drawn on the recording canvas each frame
  const drawWaveform = (data: Uint8Array) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const BARS = 48;
    const usable = Math.floor(data.length / 3); // speech lives in the lower bins
    const step = Math.max(1, Math.floor(usable / BARS));
    const barWidth = canvas.width / BARS;
    ctx.fillStyle = '#B14E2C'; // terracotta — reads on both cream and navy

    for (let i = 0; i < BARS; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j];
      const level = sum / step / 255;
      const barHeight = Math.max(2 * dpr, level * canvas.height * 0.9);
      const x = i * barWidth + barWidth * 0.25;
      const y = (canvas.height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth * 0.5, barHeight);
    }
  };

  // Voice activity detection + waveform rendering. The loop runs until the
  // recording stops (cancelAnimationFrame in stopRecording / analyser teardown)
  // rather than checking the isRecording state, which is stale in this closure.
  const monitorAudioLevels = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const SILENCE_THRESHOLD = 10; // Volume threshold (0-255)
    const SILENCE_DURATION = 1500; // 1.5 seconds of silence before auto-stop

    const checkAudioLevel = () => {
      if (!analyserRef.current) return; // recording torn down

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      if (average < SILENCE_THRESHOLD) {
        // Detected silence - start/continue timer
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            // Still silent after timeout - auto stop
            stopRecording();
          }, SILENCE_DURATION);
        }
      } else {
        // Detected sound - clear silence timer
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      }

      drawWaveform(dataArray);

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const startRecording = async () => {
    try {
      // Stop the native clip / playback first — the mic must not record it
      stopPlayback();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // Disable - can reduce speech clarity
          noiseSuppression: false,  // Disable - we want natural speech
          autoGainControl: false,   // Disable - can distort pronunciation
          sampleRate: 48000,        // High quality sample rate
        }
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up audio analysis for silence detection
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Tear down the stream and audio analysis on every path
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Check if recording is too small (likely silence or muted mic)
        if (audioBlob.size < 1000) { // Less than 1KB is probably silence
          setError('Recording is too quiet. Please check that your microphone is unmuted and try again.');
          return;
        }

        // Save recording for playback; functional update so we revoke the
        // actual previous URL, not a stale closure value
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return audioUrl;
        });

        await sendAudioForFeedback(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
      setFeedback([]);
      setAnalysis(null);
      setScore(null);
      setTranscript('');

      // Start monitoring audio levels for silence detection
      monitorAudioLevels();
    } catch (err: any) {
      console.error('Error accessing microphone:', err);

      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError') {
        setError('Microphone is being used by another application. Please close other apps and try again.');
      } else {
        setError('Could not access microphone. Please check your settings and try again.');
      }
    }
  };

  const stopRecording = () => {
    // Check the recorder's own state, not React state: this is called from the
    // silence-detection timeout, whose closure captured a stale isRecording.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Clear silence detection timers
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioForFeedback = async (audioBlob: Blob) => {
    if (!currentPhrase || !dialect) return;

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('phraseId', currentPhrase.id);
      formData.append('dialect', dialect);

      const response = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again in a moment.');
        } else {
          throw new Error(errorData.error || 'Failed to get feedback');
        }
      }

      const data = await response.json();
      const analysisData: PronunciationAnalysis | null = data.analysis ?? null;
      setFeedback(data.feedback || []);
      setAnalysis(analysisData);
      setTranscript(data.transcript || '');

      // Animate score reveal
      setShowScoreAnimation(true);
      setTimeout(() => {
        setScore(data.score ?? null);
      }, 300);

      // Save to practice history
      if (data.score !== null && data.score !== undefined && currentPhrase) {
        const errorCategories = analysisData
          ? Array.from(new Set(analysisData.errors.map((e) => e.category)))
          : undefined;
        savePracticeEntry(currentPhrase.id, currentPhrase.portuguese, data.score, errorCategories);
      }
    } catch (err: any) {
      console.error('Error getting feedback:', err);

      if (err.message) {
        setError(err.message);
      } else if (!navigator.onLine) {
        setError('No internet connection. Please check your network and try again.');
      } else {
        setError('Failed to get pronunciation feedback. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Most frequent error categories across recent practice (top 3).
  // Only entries for the current dialect — the advice differs (e.g.
  // palatalization is Brazilian-only).
  const getFocusAreas = (): [ErrorCategory, number][] => {
    const counts = new Map<ErrorCategory, number>();
    practiceHistory
      .filter((entry) => !entry.dialect || entry.dialect === dialect)
      .slice(0, 20)
      .forEach((entry) => {
        (entry.categories || []).forEach((cat) => {
          counts.set(cat, (counts.get(cat) || 0) + 1);
        });
      });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  };

  const hasResults = feedback.length > 0 || score !== null;
  const focusAreas = getFocusAreas();

  // Click a flagged word tile → scroll to (and flash) its coaching card
  const normalizeWordClient = (w: string) =>
    w.toLowerCase().replace(/[.,!?;:"'“”‘’()]/g, '');

  const scrollToErrorCard = (word: string) => {
    if (!analysis) return;
    const idx = analysis.errors.findIndex(
      (e) => normalizeWordClient(e.word) === normalizeWordClient(word)
    );
    if (idx === -1) return;
    document
      .getElementById(`work-on-card-${idx}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedError(idx);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedError(null), 1600);
  };

  const resetAttempt = () => {
    clearResults();
  };

  // Click a recent attempt → load that phrase again (switching dialect if needed)
  const practiceAgain = (entry: PracticeEntry) => {
    const entryDialect = entry.dialect || 'pt-BR';
    const phrases = entryDialect === 'pt-PT' ? PHRASES_PT_PT : PHRASES_PT_BR;
    const phrase = phrases.find((p) => p.id === entry.phraseId);
    if (!phrase) return;

    if (entryDialect !== dialect) {
      setDialect(entryDialect);
      localStorage.setItem('portuguese-dialect', entryDialect);
    }
    setCurrentPhrase(phrase);
    clearResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const timeAgo = (ts: number) => {
    const minutes = Math.floor((Date.now() - ts) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <>
      <Head>
        <title>Fala Bem · Portuguese Pronunciation Coach</title>
        <meta
          name="description"
          content="Practice Brazilian and European Portuguese pronunciation with detailed, word-by-word AI feedback."
        />
      </Head>

      {/* Welcome Modal for First-Time Users */}
      {showWelcomeModal && (
        <DialectWelcomeModal onSelectDialect={handleDialectSelection} />
      )}

      {/* Settings Modal */}
      {dialect && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentDialect={dialect}
          onDialectChange={handleDialectChange}
          showIpaDetails={showIpaDetails}
          onIpaDetailsChange={handleIpaDetailsChange}
        />
      )}

      <Box minH="100vh" bg={az.pageBg}>
        {/* Header */}
        <Box
          as="header"
          position="relative"
          overflow="hidden"
          borderBottomWidth="1px"
          borderColor={az.cardLine}
        >
          {/* Heritage double rule */}
          <Box h="5px" bg={SOLID.gold} />
          <Box h="2px" bg={SOLID.cobalt} />
          {/* Faint tile field */}
          <Box
            position="absolute"
            inset={0}
            bgImage={TILE_BG}
            bgSize="56px 56px"
            opacity={{ base: 0.06, _dark: 0.1 }}
            pointerEvents="none"
          />

          <Container maxW="5xl" py={{ base: 7, md: 9 }} position="relative">
            <Flex justify="space-between" align="flex-start" gap={3}>
              <Box w={{ base: '0px', md: '120px' }} flexShrink={0} />
              <VStack gap={2} flex={1}>
                <HStack gap={3} align="center">
                  <Text color={az.gold} fontSize="xs">◆</Text>
                  <Text color={az.cobalt} fontSize="sm">❖</Text>
                  <Heading
                    as="h1"
                    fontFamily={SERIF}
                    fontWeight={600}
                    fontSize={{ base: '3xl', md: '5xl' }}
                    color={az.ink}
                    letterSpacing="-0.02em"
                    lineHeight={1.1}
                  >
                    Fala Bem
                  </Heading>
                  <Text color={az.cobalt} fontSize="sm">❖</Text>
                  <Text color={az.gold} fontSize="xs">◆</Text>
                </HStack>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="0.28em"
                  color={az.inkSoft}
                  textAlign="center"
                >
                  Portuguese pronunciation studio
                </Text>
                {dialect && (
                  <HStack
                    mt={1}
                    px={4}
                    py={1.5}
                    borderWidth="1px"
                    borderColor={accent.line}
                    borderRadius="full"
                    bg={accent.wash}
                    gap={2}
                  >
                    <FlagIcon country={getDialectInfo().flagCode} size="1em" />
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="0.12em"
                      color={accent.fg}
                    >
                      {getDialectInfo().name}
                    </Text>
                  </HStack>
                )}
              </VStack>
              <HStack w={{ base: 'auto', md: '120px' }} justify="flex-end" gap={2} flexShrink={0}>
                <Button
                  onClick={() => setShowSettingsModal(true)}
                  size="sm"
                  borderRadius="full"
                  bg="transparent"
                  borderWidth="1px"
                  borderColor={az.cobaltLine}
                  color={az.inkSoft}
                  _hover={{ bg: az.cobaltWash, color: az.cobalt }}
                  px={3}
                  aria-label="Open settings"
                >
                  ⚙
                </Button>
                <ColorModeToggle />
              </HStack>
            </Flex>
          </Container>
        </Box>

        {/* Main Content */}
        <Container maxW="4xl" py={{ base: 8, md: 12 }}>
          <VStack gap={{ base: 6, md: 8 }} align="stretch">

            {/* Practice Card */}
            <Box
              bg={az.cardBg}
              borderWidth="1px"
              borderColor={az.cardLine}
              borderRadius="xl"
              overflow="hidden"
              boxShadow="0 18px 50px -22px rgba(23, 42, 80, 0.35)"
            >
              {currentPhrase ? (
                <>
                  {/* Phrase */}
                  <Box
                    px={{ base: 6, md: 14 }}
                    pt={{ base: 9, md: 12 }}
                    pb={{ base: 7, md: 9 }}
                    textAlign="center"
                    position="relative"
                  >
                    <Text position="absolute" top={4} left={5} color={accent.line} fontSize="sm">❖</Text>
                    <Text position="absolute" top={4} right={5} color={accent.line} fontSize="sm">❖</Text>

                    <HStack justify="center" gap={3} mb={5}>
                      <Text
                        fontSize="2xs"
                        fontWeight="bold"
                        textTransform="uppercase"
                        letterSpacing="0.2em"
                        color={az.inkSoft}
                      >
                        {currentPhrase.category}
                      </Text>
                      <Text color={az.goldLine} fontSize="2xs">◆</Text>
                      <HStack gap={1.5}>
                        <Box w={1.5} h={1.5} borderRadius="full" bg={DIFFICULTY_TONE[currentPhrase.difficulty]} />
                        <Text
                          fontSize="2xs"
                          fontWeight="bold"
                          textTransform="uppercase"
                          letterSpacing="0.2em"
                          color={az.inkSoft}
                        >
                          {currentPhrase.difficulty}
                        </Text>
                      </HStack>
                    </HStack>

                    <Text
                      fontFamily={SERIF}
                      fontSize={{ base: '3xl', md: '5xl' }}
                      fontWeight={500}
                      color={az.ink}
                      lineHeight={1.2}
                      mb={4}
                    >
                      <Box as="span" color={accent.fg}>“</Box>
                      {currentPhrase.portuguese}
                      <Box as="span" color={accent.fg}>”</Box>
                    </Text>
                    <Text
                      fontFamily={SERIF}
                      fontStyle="italic"
                      fontSize={{ base: 'md', md: 'xl' }}
                      color={az.inkSoft}
                    >
                      {currentPhrase.english}
                    </Text>
                    {showIpaDetails && currentPhrase.ipa && (
                      <Text mt={3} fontSize="sm" color={az.inkFaint} fontFamily="mono">
                        /{currentPhrase.ipa}/
                      </Text>
                    )}
                  </Box>

                  <TileDivider />

                  {/* Controls */}
                  <Box px={{ base: 6, md: 14 }} pt={6} pb={{ base: 7, md: 9 }}>
                    <VStack gap={4}>
                      {isRecording && (
                        <Box
                          w="full"
                          h="56px"
                          bg={az.washBg}
                          borderWidth="1px"
                          borderColor={az.terraLine}
                          borderRadius="lg"
                          overflow="hidden"
                          px={2}
                        >
                          <canvas
                            ref={waveformCanvasRef}
                            style={{ width: '100%', height: '100%', display: 'block' }}
                          />
                        </Box>
                      )}
                      {!hasResults ? (
                        <Flex w="full" gap={3} direction={{ base: 'column', md: 'row' }}>
                          <Button
                            onClick={playAudio}
                            disabled={isPlayingAudio || isRecording || isLoading}
                            flex={1}
                            size="lg"
                            py={7}
                            borderRadius="lg"
                            bg="transparent"
                            borderWidth="1.5px"
                            borderColor={accent.line}
                            color={accent.fg}
                            fontWeight="bold"
                            _hover={{ bg: accent.wash, transform: 'translateY(-2px)' }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.25s"
                          >
                            {isPlayingAudio ? '♪ Playing…' : '♪ Listen first'}
                          </Button>
                          <Button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isLoading}
                            flex={{ base: 1, md: 2 }}
                            size="lg"
                            py={7}
                            borderRadius="lg"
                            bg={isRecording ? SOLID.terra : SOLID.gold}
                            color={isRecording ? '#FFF6EE' : SOLID.inkOnGold}
                            fontWeight="bold"
                            letterSpacing="0.03em"
                            boxShadow={
                              isRecording
                                ? '0 12px 28px -10px rgba(177, 78, 44, 0.55)'
                                : '0 12px 28px -10px rgba(205, 154, 43, 0.55)'
                            }
                            _hover={{
                              bg: isRecording ? SOLID.terraHover : SOLID.goldHover,
                              transform: 'translateY(-2px)',
                            }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.25s"
                            position="relative"
                            overflow="hidden"
                          >
                            {isRecording && (
                              <Box
                                position="absolute"
                                inset={0}
                                bg="whiteAlpha.300"
                                animation="recPulse 1.5s ease-in-out infinite"
                                css={{
                                  '@keyframes recPulse': {
                                    '0%, 100%': { opacity: 0.2 },
                                    '50%': { opacity: 0.55 },
                                  },
                                }}
                              />
                            )}
                            <Box as="span" position="relative" mr={2}>
                              {isRecording ? '■' : '●'}
                            </Box>
                            <Box as="span" position="relative">
                              {isRecording ? 'Stop recording' : 'Record your attempt'}
                            </Box>
                          </Button>
                        </Flex>
                      ) : (
                        <Flex w="full" gap={3} direction={{ base: 'column', md: 'row' }}>
                          <Button
                            onClick={resetAttempt}
                            disabled={isRecording || isLoading}
                            flex={1}
                            size="lg"
                            py={7}
                            borderRadius="lg"
                            bg="transparent"
                            borderWidth="1.5px"
                            borderColor={az.goldLine}
                            color={az.gold}
                            fontWeight="bold"
                            _hover={{ bg: az.goldWash, transform: 'translateY(-2px)' }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.25s"
                          >
                            ↻ Try this phrase again
                          </Button>
                          <Button
                            onClick={getRandomPhrase}
                            disabled={isRecording || isLoading}
                            flex={1}
                            size="lg"
                            py={7}
                            borderRadius="lg"
                            bg={SOLID.cobalt}
                            color="#F5F0E2"
                            fontWeight="bold"
                            boxShadow="0 12px 28px -10px rgba(29, 78, 155, 0.5)"
                            _hover={{ bg: SOLID.cobaltHover, transform: 'translateY(-2px)' }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.25s"
                          >
                            Next phrase →
                          </Button>
                        </Flex>
                      )}

                      {isRecording ? (
                        <Text fontSize="xs" color={az.inkFaint}>
                          Recording stops automatically after 1.5 seconds of silence
                        </Text>
                      ) : !hasResults ? (
                        <HStack gap={4} flexWrap="wrap" justify="center">
                          <Button
                            onClick={getRandomPhrase}
                            disabled={isLoading}
                            variant="plain"
                            size="xs"
                            color={az.inkFaint}
                            fontWeight="semibold"
                            _hover={{ color: az.cobalt }}
                          >
                            skip this phrase →
                          </Button>
                        </HStack>
                      ) : null}
                    </VStack>
                  </Box>
                </>
              ) : (
                <Box p={16} display="flex" justifyContent="center">
                  <Spinner size="xl" color={az.cobalt} />
                </Box>
              )}
            </Box>

            {/* Error */}
            {error && (
              <Box
                p={5}
                bg={az.terraWash}
                borderWidth="1px"
                borderColor={az.terraLine}
                borderRadius="lg"
              >
                <Text color={az.terra} fontWeight="semibold" fontSize="sm">
                  {error}
                </Text>
              </Box>
            )}

            {/* Results */}
            {isLoading ? (
              <Box
                bg={az.cardBg}
                borderWidth="1px"
                borderColor={az.cardLine}
                borderRadius="xl"
                p={{ base: 10, md: 14 }}
                boxShadow="0 18px 50px -22px rgba(23, 42, 80, 0.35)"
              >
                <VStack gap={4}>
                  <Spinner size="xl" color={az.cobalt} />
                  <Text fontFamily={SERIF} fontSize="lg" color={az.ink}>
                    {LOADING_STEPS[loadingStep].pt}
                  </Text>
                  <Text fontSize="sm" color={az.inkSoft}>
                    {LOADING_STEPS[loadingStep].en}
                  </Text>
                  <HStack gap={1.5} mt={1}>
                    {LOADING_STEPS.map((_, i) => (
                      <Box
                        key={i}
                        w={1.5}
                        h={1.5}
                        borderRadius="full"
                        bg={i <= loadingStep ? az.gold : az.cardLine}
                        transition="background 0.3s"
                      />
                    ))}
                  </HStack>
                </VStack>
              </Box>
            ) : hasResults ? (
              <Box
                bg={az.cardBg}
                borderWidth="1px"
                borderColor={az.cardLine}
                borderRadius="xl"
                p={{ base: 6, md: 10 }}
                boxShadow="0 18px 50px -22px rgba(23, 42, 80, 0.35)"
              >
                <SectionLabel pt="Os resultados" en="Your results" />

                {/* Score medallion + verdict */}
                {score !== null && (() => {
                  const tone = scoreTone(score);
                  const verdict = scoreVerdict(score);
                  return (
                    <Flex
                      direction={{ base: 'column', md: 'row' }}
                      align="center"
                      gap={{ base: 5, md: 8 }}
                      mb={8}
                      animation={showScoreAnimation ? 'scoreReveal 0.6s ease-out' : 'none'}
                      css={{
                        '@keyframes scoreReveal': {
                          '0%': { opacity: 0, transform: 'scale(0.9) translateY(16px)' },
                          '60%': { transform: 'scale(1.03)' },
                          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
                        },
                      }}
                      onAnimationEnd={() => setShowScoreAnimation(false)}
                    >
                      <Box
                        position="relative"
                        w="150px"
                        h="150px"
                        flexShrink={0}
                        borderRadius="full"
                        bg={tone.wash}
                        borderWidth="2px"
                        borderColor={tone.line}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Box
                          position="absolute"
                          inset="7px"
                          borderRadius="full"
                          borderWidth="1px"
                          borderColor={tone.line}
                        />
                        <VStack gap={1}>
                          <Text
                            fontFamily={SERIF}
                            fontSize="5xl"
                            fontWeight={700}
                            lineHeight={1}
                            color={tone.fg}
                          >
                            {score}
                          </Text>
                          <Text
                            fontSize="2xs"
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.2em"
                            color={tone.fg}
                            opacity={0.75}
                          >
                            de 100
                          </Text>
                        </VStack>
                      </Box>
                      <Box textAlign={{ base: 'center', md: 'left' }}>
                        <Text
                          fontFamily={SERIF}
                          fontSize={{ base: '2xl', md: '3xl' }}
                          fontWeight={600}
                          color={az.ink}
                          mb={1}
                        >
                          {verdict.pt}
                        </Text>
                        <Text
                          fontSize="xs"
                          textTransform="uppercase"
                          letterSpacing="0.16em"
                          fontWeight="bold"
                          color={tone.fg}
                          mb={3}
                        >
                          {verdict.en}
                        </Text>
                        {analysis?.summary && (
                          <Text fontSize="md" color={az.inkSoft} lineHeight="tall" maxW="440px">
                            {filterIpaFromFeedback(analysis.summary)}
                          </Text>
                        )}
                      </Box>
                    </Flex>
                  );
                })()}

                {/* How the score was measured */}
                {analysis?.breakdown && (
                  <Box mb={8}>
                    <SectionLabel pt="Como medimos" en="How we measured it" />
                    <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
                      <Meter
                        labelPt="Clareza"
                        labelEn="Clarity"
                        hint="Did a blind transcription hear the right words?"
                        value={analysis.breakdown.clarity}
                      />
                      {analysis.breakdown.sounds !== null && (
                        <Meter
                          labelPt="Sons"
                          labelEn="Sounds"
                          hint="Your phonetics vs the target, judged blind"
                          value={analysis.breakdown.sounds}
                        />
                      )}
                      {analysis.breakdown.nativeness !== null && (
                        <Meter
                          labelPt="Sotaque"
                          labelEn="vs Native"
                          hint="Word-by-word against a native recording"
                          value={analysis.breakdown.nativeness}
                        />
                      )}
                      {analysis.breakdown.phonemes != null && (
                        <Meter
                          labelPt="Fonemas"
                          labelEn="Phonemes"
                          hint="Acoustic phoneme accuracy (forced alignment)"
                          value={analysis.breakdown.phonemes}
                        />
                      )}
                    </Flex>
                  </Box>
                )}

                {/* Word-by-word tiles */}
                {analysis && analysis.words.length > 0 && (
                  <Box mb={8}>
                    <SectionLabel pt="Palavra a palavra" en="Word by word" />
                    <Flex wrap="wrap" gap={2} mb={3}>
                      {analysis.words.map((w, index) => (
                        <Box
                          key={index}
                          px={4}
                          py={2}
                          borderRadius="md"
                          borderWidth="1.5px"
                          fontFamily={SERIF}
                          fontWeight={600}
                          fontSize={{ base: 'lg', md: 'xl' }}
                          {...WORD_TILE_STYLES[w.status]}
                          {...(w.status !== 'good'
                            ? {
                                cursor: 'pointer',
                                onClick: () => scrollToErrorCard(w.word),
                                title: 'See how to fix this word',
                                _hover: {
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 4px 12px rgba(23, 42, 80, 0.15)',
                                },
                                transition: 'all 0.2s',
                              }
                            : {})}
                        >
                          {w.word}
                        </Box>
                      ))}
                    </Flex>
                    <HStack gap={5} flexWrap="wrap">
                      <HStack gap={1.5}>
                        <Text color={az.sage} fontSize="2xs">◆</Text>
                        <Text fontSize="xs" color={az.inkSoft}>Sounded great</Text>
                      </HStack>
                      <HStack gap={1.5}>
                        <Text color={az.ochre} fontSize="2xs">◆</Text>
                        <Text fontSize="xs" color={az.inkSoft}>Small slip</Text>
                      </HStack>
                      <HStack gap={1.5}>
                        <Text color={az.terra} fontSize="2xs">◆</Text>
                        <Text fontSize="xs" color={az.inkSoft}>Needs work</Text>
                      </HStack>
                      <Text fontSize="xs" color={az.inkFaint}>
                        · tap a flagged word to jump to its tip
                      </Text>
                    </HStack>
                  </Box>
                )}

                {/* Transcript + listen & compare */}
                {transcript && (
                  <Box
                    mb={8}
                    p={5}
                    bg={az.washBg}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={az.cardLine}
                  >
                    <SectionLabel pt="O que ouvimos" en="What we heard" />
                    <Text
                      fontFamily={SERIF}
                      fontStyle="italic"
                      fontSize={{ base: 'lg', md: 'xl' }}
                      color={az.ink}
                      mb={4}
                    >
                      “{transcript}”
                    </Text>
                    <HStack gap={3} flexWrap="wrap">
                      <Button
                        onClick={playAudio}
                        disabled={isPlayingAudio || isRecording}
                        size="sm"
                        borderRadius="md"
                        bg="transparent"
                        borderWidth="1.5px"
                        borderColor={az.cobaltLine}
                        color={az.cobalt}
                        fontWeight="bold"
                        fontSize="xs"
                        _hover={{ bg: az.cobaltWash }}
                      >
                        {isPlayingAudio ? '♪ Playing…' : '♪ Native speaker'}
                      </Button>
                      {recordedAudioUrl && (
                        <Button
                          onClick={playRecording}
                          disabled={isPlayingRecording}
                          size="sm"
                          borderRadius="md"
                          bg="transparent"
                          borderWidth="1.5px"
                          borderColor={az.goldLine}
                          color={az.gold}
                          fontWeight="bold"
                          fontSize="xs"
                          _hover={{ bg: az.goldWash }}
                        >
                          {isPlayingRecording ? '▶ Playing…' : '▶ Your recording'}
                        </Button>
                      )}
                    </HStack>
                    <Text fontSize="xs" color={az.inkFaint} mt={3}>
                      Alternate between the two — focus on one highlighted word at a time.
                    </Text>
                  </Box>
                )}

                {/* Strengths */}
                {analysis && analysis.strengths.length > 0 && (
                  <Box
                    mb={8}
                    p={5}
                    bg={az.sageWash}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={az.sageLine}
                  >
                    <SectionLabel pt="Acertou" en="What you nailed" />
                    <VStack align="stretch" gap={2}>
                      {analysis.strengths.map((strength, index) => (
                        <HStack key={index} align="start" gap={2.5}>
                          <Text color={az.sage} fontSize="2xs" mt={1.5}>◆</Text>
                          <Text fontSize="md" lineHeight="tall" color={az.ink}>
                            {filterIpaFromFeedback(strength)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}

                {/* Perfect attempt */}
                {analysis && analysis.errors.length === 0 && score !== null && score >= 90 && (
                  <Box
                    mb={8}
                    p={5}
                    textAlign="center"
                    bg={az.sageWash}
                    borderWidth="1px"
                    borderColor={az.sageLine}
                    borderRadius="lg"
                  >
                    <Text fontFamily={SERIF} fontSize="lg" fontWeight={600} color={az.sage} mb={1}>
                      Sem erros — soou como um nativo!
                    </Text>
                    <Text fontSize="sm" color={az.inkSoft}>
                      No pronunciation errors detected — that sounded native-like.
                    </Text>
                  </Box>
                )}

                {/* Errors */}
                {analysis && analysis.errors.length > 0 ? (
                  <Box>
                    <SectionLabel pt="A melhorar" en="What to work on" />
                    <VStack align="stretch" gap={3}>
                      {analysis.errors.map((err, index) => (
                        <Box
                          key={index}
                          id={`work-on-card-${index}`}
                          p={5}
                          bg={az.cardBg}
                          borderWidth="1px"
                          borderColor={az.cardLine}
                          borderLeftWidth="3px"
                          borderLeftColor={err.severity === 'major' ? SOLID.terra : SOLID.gold}
                          borderRadius="lg"
                          boxShadow={
                            highlightedError === index
                              ? '0 0 0 3px rgba(205, 154, 43, 0.55)'
                              : 'none'
                          }
                          transition="box-shadow 0.4s"
                        >
                          <Flex justify="space-between" align="baseline" mb={3} gap={2} wrap="wrap">
                            <HStack gap={2} align="baseline">
                              <Text fontFamily={SERIF} fontSize="xl" fontWeight={600} color={az.ink}>
                                {err.word}
                              </Text>
                              {err.sound && (
                                <Box
                                  px={2}
                                  py={0.5}
                                  bg={az.cobaltWash}
                                  borderRadius="sm"
                                  borderWidth="1px"
                                  borderColor={az.cobaltLine}
                                >
                                  <Text fontSize="xs" fontWeight="bold" color={az.cobalt}>
                                    “{err.sound}”
                                  </Text>
                                </Box>
                              )}
                            </HStack>
                            <Text
                              fontSize="2xs"
                              fontWeight="bold"
                              textTransform="uppercase"
                              letterSpacing="0.16em"
                              color={az.inkFaint}
                            >
                              {CATEGORY_LABELS[err.category]}
                            </Text>
                          </Flex>
                          <VStack align="stretch" gap={1} mb={3}>
                            {err.heard && (
                              <Text fontSize="sm" color={az.inkSoft} lineHeight="tall">
                                <Box as="span" fontWeight="bold" color={az.terra}>You said — </Box>
                                {filterIpaFromFeedback(err.heard)}
                              </Text>
                            )}
                            <Text fontSize="sm" color={az.inkSoft} lineHeight="tall">
                              <Box as="span" fontWeight="bold" color={az.sage}>Aim for — </Box>
                              {filterIpaFromFeedback(err.target)}
                            </Text>
                          </VStack>
                          {err.tip && (
                            <Box p={3} bg={az.cobaltWash} borderRadius="md">
                              <Text fontSize="sm" color={az.ink} lineHeight="tall">
                                <Box
                                  as="span"
                                  fontWeight="bold"
                                  color={az.cobalt}
                                  textTransform="uppercase"
                                  fontSize="2xs"
                                  letterSpacing="0.14em"
                                  mr={2}
                                >
                                  Como fazer · How
                                </Box>
                                {filterIpaFromFeedback(err.tip)}
                              </Text>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : !analysis && feedback.length > 0 ? (
                  <Box>
                    <SectionLabel pt="Sugestões" en="Feedback & tips" />
                    <VStack align="stretch" gap={3}>
                      {feedback.map((tip, index) => (
                        <Box
                          key={index}
                          p={5}
                          bg={az.cardBg}
                          borderWidth="1px"
                          borderColor={az.cardLine}
                          borderLeftWidth="3px"
                          borderLeftColor={SOLID.gold}
                          borderRadius="lg"
                        >
                          <HStack align="start" gap={3}>
                            <Text fontFamily={SERIF} fontWeight={700} color={az.gold} fontSize="md">
                              {index + 1}.
                            </Text>
                            <Text fontSize="md" lineHeight="tall" color={az.ink}>
                              {filterIpaFromFeedback(tip)}
                            </Text>
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : null}
              </Box>
            ) : (
              <Box
                p={6}
                textAlign="center"
                bg={az.washBg}
                borderWidth="1px"
                borderColor={az.cardLine}
                borderRadius="lg"
              >
                <Text fontSize="sm" color={az.inkFaint}>
                  <Box as="span" color={az.gold}>❖</Box>
                  {'  '}Listen, then record your attempt to unlock word-by-word feedback{'  '}
                  <Box as="span" color={az.gold}>❖</Box>
                </Text>
              </Box>
            )}

            {/* Practice Stats */}
            {practiceHistory.length > 0 && (
              <Box
                bg={az.cardBg}
                borderWidth="1px"
                borderColor={az.cardLine}
                borderRadius="xl"
                p={{ base: 6, md: 10 }}
                boxShadow="0 18px 50px -22px rgba(23, 42, 80, 0.35)"
              >
                <SectionLabel pt="O seu progresso" en="Practice stats" />

                <Flex gap={4} mb={8} direction={{ base: 'column', sm: 'row' }}>
                  <Box
                    flex={1}
                    p={5}
                    bg={az.washBg}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={az.cardLine}
                    textAlign="center"
                  >
                    <Text fontFamily={SERIF} fontSize="4xl" fontWeight={700} color={az.cobalt}>
                      {practiceHistory.length}
                    </Text>
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="0.18em"
                      color={az.inkSoft}
                    >
                      Total attempts
                    </Text>
                  </Box>
                  <Box
                    flex={1}
                    p={5}
                    bg={az.washBg}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={az.cardLine}
                    textAlign="center"
                  >
                    <Text fontFamily={SERIF} fontSize="4xl" fontWeight={700} color={az.gold}>
                      {Math.round(
                        practiceHistory.reduce((sum, e) => sum + e.score, 0) /
                          practiceHistory.length
                      )}
                    </Text>
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="0.18em"
                      color={az.inkSoft}
                    >
                      Average score
                    </Text>
                  </Box>
                  <Box
                    flex={1}
                    p={5}
                    bg={az.washBg}
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor={az.cardLine}
                    textAlign="center"
                  >
                    <Text fontFamily={SERIF} fontSize="4xl" fontWeight={700} color={az.sage}>
                      {Math.max(...practiceHistory.map((e) => e.score))}
                    </Text>
                    <Text
                      fontSize="2xs"
                      fontWeight="bold"
                      textTransform="uppercase"
                      letterSpacing="0.18em"
                      color={az.inkSoft}
                    >
                      Best score
                    </Text>
                  </Box>
                </Flex>

                {focusAreas.length > 0 && (
                  <Box mb={8}>
                    <SectionLabel pt="Áreas de foco" en="Your focus areas" />
                    <VStack align="stretch" gap={2}>
                      {focusAreas.map(([category, count]) => (
                        <Box
                          key={category}
                          p={4}
                          bg={az.goldWash}
                          borderWidth="1px"
                          borderColor={az.goldLine}
                          borderRadius="lg"
                        >
                          <Flex justify="space-between" align="baseline" mb={1}>
                            <Text fontSize="sm" fontWeight="bold" color={az.ink}>
                              {CATEGORY_LABELS[category]}
                            </Text>
                            <Text fontFamily={SERIF} fontWeight={700} color={az.gold}>
                              {count}×
                            </Text>
                          </Flex>
                          <Text fontSize="xs" color={az.inkSoft} lineHeight="tall">
                            {CATEGORY_ADVICE[category]}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}

                <SectionLabel pt="Tentativas recentes" en="Recent attempts" />
                <VStack align="stretch" gap={2}>
                  {practiceHistory.slice(0, 5).map((entry, idx) => (
                    <Flex
                      key={idx}
                      p={4}
                      justify="space-between"
                      align="center"
                      bg={az.washBg}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor={az.cardLine}
                      gap={3}
                      cursor="pointer"
                      title="Practice this phrase again"
                      onClick={() => practiceAgain(entry)}
                      _hover={{
                        borderColor: az.cobaltLine,
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(23, 42, 80, 0.12)',
                      }}
                      transition="all 0.2s"
                    >
                      <Box flex={1} minW={0}>
                        <Text fontFamily={SERIF} fontSize="md" color={az.ink}>
                          {entry.phrase}
                        </Text>
                        <HStack gap={2} mt={1}>
                          {entry.dialect && (
                            <FlagIcon
                              country={entry.dialect === 'pt-PT' ? 'PT' : 'BR'}
                              size="0.85em"
                            />
                          )}
                          <Text fontSize="2xs" color={az.inkFaint} fontWeight="semibold">
                            {timeAgo(entry.timestamp)}
                          </Text>
                          <Text fontSize="2xs" color={az.inkFaint}>
                            · tap to retry
                          </Text>
                        </HStack>
                      </Box>
                      <Text
                        fontFamily={SERIF}
                        fontSize="xl"
                        fontWeight={700}
                        color={scoreTone(entry.score).fg}
                        flexShrink={0}
                      >
                        {entry.score}
                      </Text>
                    </Flex>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </Container>

        {/* Footer */}
        <Box as="footer" pb={10} pt={2}>
          <Container maxW="4xl">
            <TileDivider />
            <VStack gap={3} mt={6}>
              <Text
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.24em"
                fontWeight="bold"
                color={az.inkFaint}
              >
                Fala Bem · fale bonito
              </Text>
              <HStack fontSize="xs" color={az.inkFaint} gap={2}>
                <Key>Space</Key>
                <Text>to record</Text>
                <Text color={az.goldLine}>◆</Text>
                <Key>Enter</Key>
                <Text>for next phrase</Text>
              </HStack>
            </VStack>
          </Container>
        </Box>
      </Box>
    </>
  );
}
