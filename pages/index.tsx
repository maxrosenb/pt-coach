import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Button,
  VStack,
  HStack,
  Text,
  Card,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { ColorModeToggle } from '../components/ColorModeToggle';
import { DialectWelcomeModal } from '../components/DialectWelcomeModal';
import { SettingsModal } from '../components/SettingsModal';
import { FlagIcon } from '../components/FlagIcon';
import { PHRASES_PT_BR, Phrase } from '../data/phrases-pt-br';
import { PHRASES_PT_PT } from '../data/phrases-pt-pt';

interface PracticeEntry {
  phraseId: string;
  phrase: string;
  score: number;
  timestamp: number;
  dialect?: 'pt-BR' | 'pt-PT';
}

export default function Home() {
  // Dialect management
  const [dialect, setDialect] = useState<'pt-BR' | 'pt-PT' | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showIpaDetails, setShowIpaDetails] = useState(false); // Default OFF
  const [currentPhrase, setCurrentPhrase] = useState<Phrase | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [practiceHistory, setPracticeHistory] = useState<PracticeEntry[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showScoreAnimation, setShowScoreAnimation] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
    setFeedback([]);
    setScore(null);
    setTranscript('');
    setError('');

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

  // Play TTS audio
  const playAudio = async () => {
    if (!currentPhrase || isPlayingAudio) return;

    try {
      setIsPlayingAudio(true);

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: currentPhrase.portuguese }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
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

    console.log('Attempting to play recorded audio:', recordedAudioUrl);

    try {
      setIsPlayingRecording(true);

      // Stop any existing recording playback
      if (recordingAudioRef.current) {
        recordingAudioRef.current.pause();
        recordingAudioRef.current = null;
      }

      const audio = new Audio(recordedAudioUrl);
      recordingAudioRef.current = audio;

      audio.onended = () => {
        console.log('Recording playback ended');
        setIsPlayingRecording(false);
      };

      audio.onerror = (e) => {
        console.error('Error playing recorded audio:', e);
        setIsPlayingRecording(false);
        setError('Failed to play recording');
      };

      await audio.play();
      console.log('Recording playback started');
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
  const savePracticeEntry = (phraseId: string, phrase: string, score: number) => {
    const entry: PracticeEntry = {
      phraseId,
      phrase,
      score,
      timestamp: Date.now(),
      dialect: dialect || undefined,
    };

    const newHistory = [entry, ...practiceHistory].slice(0, 50); // Keep last 50
    setPracticeHistory(newHistory);
    localStorage.setItem('practiceHistory', JSON.stringify(newHistory));
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
    setFeedback([]);
    setScore(null);
    setTranscript('');
    setError('');
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

      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Clean up recorded audio URL
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
  }, [isRecording, isLoading, currentPhrase]);

  // Voice activity detection - monitors audio levels
  const monitorAudioLevels = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const SILENCE_THRESHOLD = 10; // Volume threshold (0-255)
    const SILENCE_DURATION = 1500; // 1.5 seconds of silence before auto-stop

    const checkAudioLevel = () => {
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

      // Continue monitoring
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      }
    };

    checkAudioLevel();
  };

  const startRecording = async () => {
    try {
      // Get list of audio input devices for debugging
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      console.log('Available audio inputs:', audioInputs);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // Disable - can reduce speech clarity
          noiseSuppression: false,  // Disable - we want natural speech
          autoGainControl: false,   // Disable - can distort pronunciation
          sampleRate: 48000,        // High quality sample rate
        }
      });

      // Log which device is being used
      const tracks = stream.getAudioTracks();
      console.log('Using audio track:', tracks[0]?.label, tracks[0]?.getSettings());

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
        console.log('Audio data received, size:', event.data.size);
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('Created audio blob, size:', audioBlob.size);

        // Check if recording is too small (likely silence or muted mic)
        if (audioBlob.size < 1000) { // Less than 1KB is probably silence
          setError('Recording is too quiet. Please check that your microphone is unmuted and try again.');
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Clean up old recording URL
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
        }

        // Save recording for playback
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('Created audio URL for playback:', audioUrl);
        setRecordedAudioUrl(audioUrl);

        await sendAudioForFeedback(audioBlob);

        stream.getTracks().forEach((track) => track.stop());

        // Clean up audio analysis
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;
      };

      mediaRecorder.start();
      console.log('Recording started');
      setIsRecording(true);
      setError('');
      setFeedback([]);
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
    if (mediaRecorderRef.current && isRecording) {
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
      setFeedback(data.feedback || []);
      setTranscript(data.transcript || '');

      // Animate score reveal
      setShowScoreAnimation(true);
      setTimeout(() => {
        setScore(data.score ?? null);
      }, 300);

      // Save to practice history
      if (data.score !== null && data.score !== undefined && currentPhrase) {
        savePracticeEntry(currentPhrase.id, currentPhrase.portuguese, data.score);
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

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'green';
    if (score >= 80) return 'blue';
    if (score >= 70) return 'yellow';
    if (score >= 60) return 'orange';
    return 'red';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 90) return '🌟';
    if (score >= 80) return '🎉';
    if (score >= 70) return '👍';
    if (score >= 60) return '💪';
    return '📚';
  };

  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (difficulty === 'easy') return 'green';
    if (difficulty === 'medium') return 'yellow';
    return 'red';
  };

  return (
    <>
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

      <Box minH="100vh" bg={{ base: 'gray.50', _dark: 'gray.900' }}>
        {/* Header */}
      <Box
        bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        position="relative"
        overflow="hidden"
        boxShadow="0 10px 40px -10px rgba(102, 126, 234, 0.4)"
      >
        {/* Background Pattern */}
        <Box
          position="absolute"
          inset={0}
          opacity={0.1}
          bgImage="radial-gradient(circle at 2px 2px, white 1px, transparent 0)"
          bgSize="40px 40px"
        />

        <Container maxW="container.lg" py={8} position="relative">
          <HStack justifyContent="space-between" alignItems="start" mb={2}>
            <Box flex={1} />
            <Box flex={1} display="flex" justifyContent="center">
              <VStack gap={3}>
                <Box
                  bg="whiteAlpha.200"
                  backdropFilter="blur(10px)"
                  px={6}
                  py={3}
                  borderRadius="full"
                  border="1px solid"
                  borderColor="whiteAlpha.300"
                >
                  <Heading
                    as="h1"
                    fontSize={{ base: '2xl', md: '4xl' }}
                    fontWeight="black"
                    color="white"
                    letterSpacing="tight"
                    textShadow="0 2px 10px rgba(0,0,0,0.2)"
                  >
                    {dialect && <Box as="span" mr={3}><FlagIcon country={getDialectInfo().flagCode} size="1.2em" /></Box>}
                    Portuguese Coach
                  </Heading>
                </Box>
                <VStack gap={1}>
                  <Text
                    color="whiteAlpha.900"
                    fontSize={{ base: 'sm', md: 'md' }}
                    fontWeight="medium"
                    textShadow="0 1px 2px rgba(0,0,0,0.1)"
                  >
                    Master your pronunciation with AI-powered feedback
                  </Text>
                  {dialect && (
                    <Text
                      color="whiteAlpha.800"
                      fontSize={{ base: 'xs', md: 'sm' }}
                      fontWeight="semibold"
                      textShadow="0 1px 2px rgba(0,0,0,0.1)"
                    >
                      {getDialectInfo().name}
                    </Text>
                  )}
                </VStack>
              </VStack>
            </Box>
            <Box flex={1} display="flex" justifyContent="flex-end" gap={2}>
              <Button
                onClick={() => setShowSettingsModal(true)}
                size="md"
                borderRadius="full"
                bg="whiteAlpha.200"
                backdropFilter="blur(10px)"
                color="white"
                border="1px solid"
                borderColor="whiteAlpha.300"
                _hover={{
                  bg: 'whiteAlpha.300',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                _active={{ transform: 'translateY(0)' }}
                transition="all 0.2s"
                fontWeight="bold"
                fontSize="sm"
                px={4}
              >
                ⚙️ Settings
              </Button>
              <ColorModeToggle />
            </Box>
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.lg" py={8}>
        <VStack gap={6} align="stretch">

          {/* Practice Card */}
          <Card.Root
            bg={{ base: 'white', _dark: 'gray.800' }}
            borderRadius="3xl"
            boxShadow="0 20px 60px -10px rgba(0, 0, 0, 0.15)"
            overflow="hidden"
            border="1px solid"
            borderColor={{ base: 'gray.100', _dark: 'gray.700' }}
          >
            <Card.Body p={0}>
              {currentPhrase ? (
                <>
                  {/* Phrase Display */}
                  <Box
                    bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    p={{ base: 8, md: 12 }}
                    textAlign="center"
                    position="relative"
                    overflow="hidden"
                  >
                    {/* Decorative circles */}
                    <Box
                      position="absolute"
                      top="-50px"
                      right="-50px"
                      w="200px"
                      h="200px"
                      borderRadius="full"
                      bg="whiteAlpha.100"
                    />
                    <Box
                      position="absolute"
                      bottom="-30px"
                      left="-30px"
                      w="150px"
                      h="150px"
                      borderRadius="full"
                      bg="whiteAlpha.100"
                    />

                    <HStack justifyContent="center" mb={5} gap={2} position="relative" flexWrap="wrap">
                      <Badge
                        size="md"
                        borderRadius="full"
                        px={4}
                        py={2}
                        bg="whiteAlpha.200"
                        backdropFilter="blur(10px)"
                        color="white"
                        fontWeight="bold"
                        fontSize="xs"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        border="1px solid"
                        borderColor="whiteAlpha.300"
                      >
                        {currentPhrase.category}
                      </Badge>
                      <Badge
                        colorPalette={getDifficultyColor(currentPhrase.difficulty)}
                        size="md"
                        borderRadius="full"
                        px={4}
                        py={2}
                        textTransform="capitalize"
                        fontWeight="bold"
                        fontSize="xs"
                        letterSpacing="wide"
                        boxShadow="0 2px 8px rgba(0,0,0,0.1)"
                      >
                        {currentPhrase.difficulty}
                      </Badge>
                    </HStack>
                    <Text
                      fontSize={{ base: '3xl', md: '5xl' }}
                      fontWeight="black"
                      color="white"
                      mb={4}
                      lineHeight="1.1"
                      textShadow="0 4px 12px rgba(0,0,0,0.2)"
                      px={{ base: 2, md: 0 }}
                      position="relative"
                      letterSpacing="tight"
                    >
                      {currentPhrase.portuguese}
                    </Text>
                    <Text
                      fontSize={{ base: 'md', md: 'xl' }}
                      color="whiteAlpha.900"
                      fontWeight="semibold"
                      mb={6}
                      px={{ base: 2, md: 0 }}
                      position="relative"
                      textShadow="0 2px 4px rgba(0,0,0,0.1)"
                    >
                      {currentPhrase.english}
                    </Text>
                    {(feedback.length > 0 || score !== null) && (
                      <Button
                        size="md"
                        onClick={playAudio}
                        disabled={isPlayingAudio || isRecording}
                        bg="whiteAlpha.200"
                        backdropFilter="blur(10px)"
                        color="white"
                        borderRadius="full"
                        border="1px solid"
                        borderColor="whiteAlpha.300"
                        _hover={{
                          bg: 'whiteAlpha.300',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                        _active={{ transform: 'translateY(0)' }}
                        transition="all 0.2s"
                        fontWeight="bold"
                        fontSize="sm"
                        px={6}
                        py={6}
                        position="relative"
                      >
                        {isPlayingAudio ? '🔊 Playing...' : '🔊 Hear Native Pronunciation'}
                      </Button>
                    )}
                  </Box>

                  {/* Controls */}
                  <Box p={{ base: 6, md: 10 }}>
                    <VStack gap={4}>
                      {!(feedback.length > 0 || score !== null) && (
                        <Button
                          colorPalette={isRecording ? 'red' : 'blue'}
                          width="full"
                          size="2xl"
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={isLoading}
                          borderRadius="2xl"
                          fontSize={{ base: 'lg', md: '2xl' }}
                          fontWeight="bold"
                          py={{ base: 8, md: 10 }}
                          boxShadow={
                            isRecording
                              ? '0 8px 24px rgba(239, 68, 68, 0.35)'
                              : '0 8px 24px rgba(59, 130, 246, 0.35)'
                          }
                          _hover={{
                            boxShadow: isRecording
                              ? '0 12px 32px rgba(239, 68, 68, 0.45)'
                              : '0 12px 32px rgba(59, 130, 246, 0.45)',
                            transform: 'translateY(-3px)',
                          }}
                          _active={{ transform: 'translateY(-1px)' }}
                          transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                          position="relative"
                          overflow="hidden"
                          border="2px solid"
                          borderColor={isRecording ? 'red.400' : 'blue.400'}
                        >
                          {isRecording && (
                            <Box
                              position="absolute"
                              inset={0}
                              bg="whiteAlpha.300"
                              animation="pulse 1.5s ease-in-out infinite"
                              css={{
                                '@keyframes pulse': {
                                  '0%, 100%': { opacity: 0.3 },
                                  '50%': { opacity: 0.6 },
                                },
                              }}
                            />
                          )}
                          {isRecording ? (
                            <>
                              <Box as="span" fontSize="3xl" mr={3} position="relative">⏹</Box>
                              <Box as="span" position="relative" letterSpacing="wide">
                                Stop Recording
                              </Box>
                            </>
                          ) : (
                            <>
                              <Box as="span" fontSize="3xl" mr={3}>🎤</Box>
                              <Box as="span" letterSpacing="wide">Record Pronunciation</Box>
                            </>
                          )}
                        </Button>
                      )}

                      {isRecording && (
                        <Text
                          fontSize="xs"
                          color={{ base: 'gray.500', _dark: 'gray.400' }}
                          textAlign="center"
                          fontWeight="medium"
                        >
                          💡 Recording will automatically stop after 1.5s of silence
                        </Text>
                      )}

                      {(feedback.length > 0 || score !== null) && (
                        <Button
                          variant="outline"
                          colorPalette="blue"
                          width="full"
                          size="lg"
                          onClick={() => {
                            setFeedback([]);
                            setScore(null);
                            setTranscript('');
                            setError('');
                            if (recordedAudioUrl) {
                              URL.revokeObjectURL(recordedAudioUrl);
                              setRecordedAudioUrl(null);
                            }
                          }}
                          disabled={isRecording || isLoading}
                          borderRadius="xl"
                          fontSize="md"
                          fontWeight="semibold"
                          py={6}
                          borderWidth="2px"
                          _hover={{
                            bg: 'blue.50',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                          }}
                          transition="all 0.2s"
                        >
                          <Box as="span" mr={2} fontSize="lg">🔄</Box>
                          Try Again
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        colorPalette="gray"
                        width="full"
                        size="lg"
                        onClick={getRandomPhrase}
                        disabled={isRecording || isLoading}
                        borderRadius="xl"
                        fontSize="md"
                        fontWeight="semibold"
                        py={6}
                        _hover={{
                          bg: 'gray.100',
                          transform: 'translateY(-2px)',
                        }}
                        transition="all 0.2s"
                      >
                        <Box as="span" mr={2} fontSize="lg">→</Box>
                        Next Phrase
                      </Button>
                    </VStack>
                  </Box>
                </>
              ) : (
                <Box p={12} display="flex" justifyContent="center">
                  <Spinner size="xl" colorPalette="blue" />
                </Box>
              )}
            </Card.Body>
          </Card.Root>

          {/* Feedback Card */}
          <Card.Root
            bg={{ base: 'white', _dark: 'gray.800' }}
            borderRadius="3xl"
            boxShadow="0 20px 60px -10px rgba(0, 0, 0, 0.15)"
            border="1px solid"
            borderColor={{ base: 'gray.100', _dark: 'gray.700' }}
          >
            <Card.Body p={{ base: 6, md: 10 }}>
              <Box mb={8}>
                <Heading
                  as="h2"
                  fontSize={{ base: 'xl', md: '3xl' }}
                  fontWeight="black"
                  mb={2}
                  color={{ base: 'gray.900', _dark: 'white' }}
                  letterSpacing="tight"
                >
                  Your Results
                </Heading>
                <Text fontSize="xs" color="purple.600" fontStyle="italic" fontWeight="medium">
                  🎧 Scores are based on AI audio analysis of your actual pronunciation, accent, and rhythm
                </Text>
              </Box>

              {error && (
                <Box
                  p={5}
                  bg="red.50"
                  borderRadius="xl"
                  borderWidth="1px"
                  borderColor="red.200"
                  mb={6}
                >
                  <Text color="red.700" fontWeight="medium" fontSize="sm">
                    {error}
                  </Text>
                </Box>
              )}

              {isLoading ? (
                <Box
                  minH="300px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={{ base: 'gray.50', _dark: 'gray.700' }}
                  borderRadius="xl"
                >
                  <VStack gap={4}>
                    <Spinner size="xl" colorPalette="blue" />
                    <Text color="gray.600" fontSize="md" fontWeight="medium">
                      Analyzing your pronunciation...
                    </Text>
                  </VStack>
                </Box>
              ) : feedback.length > 0 || score !== null ? (
                <VStack align="stretch" gap={5}>
                  {score !== null && (
                    <Box
                      p={{ base: 8, md: 12 }}
                      bg={`linear-gradient(135deg, ${getScoreColor(score)}.50 0%, ${getScoreColor(score)}.100 100%)`}
                      borderRadius="3xl"
                      textAlign="center"
                      borderWidth="3px"
                      borderColor={`${getScoreColor(score)}.300`}
                      position="relative"
                      overflow="hidden"
                      animation={showScoreAnimation ? 'scoreReveal 0.6s ease-out' : 'none'}
                      boxShadow={`0 12px 32px -8px rgba(${
                        score >= 90 ? '34, 197, 94' :
                        score >= 80 ? '59, 130, 246' :
                        score >= 70 ? '234, 179, 8' :
                        score >= 60 ? '249, 115, 22' :
                        '239, 68, 68'
                      }, 0.3)`}
                      css={{
                        '@keyframes scoreReveal': {
                          '0%': {
                            opacity: 0,
                            transform: 'scale(0.8) translateY(20px)',
                          },
                          '60%': {
                            transform: 'scale(1.05)',
                          },
                          '100%': {
                            opacity: 1,
                            transform: 'scale(1) translateY(0)',
                          },
                        },
                      }}
                      onAnimationEnd={() => setShowScoreAnimation(false)}
                    >
                      <Box
                        position="absolute"
                        top="-20px"
                        right="-20px"
                        fontSize="120px"
                        opacity={0.1}
                      >
                        {getScoreEmoji(score)}
                      </Box>
                      <Text fontSize="6xl" mb={1} position="relative">
                        {getScoreEmoji(score)}
                      </Text>
                      <Text
                        fontSize="5xl"
                        fontWeight="bold"
                        color={`${getScoreColor(score)}.700`}
                        mb={2}
                        position="relative"
                      >
                        {score}
                      </Text>
                      <Text
                        color="gray.700"
                        fontSize="sm"
                        fontWeight="semibold"
                        textTransform="uppercase"
                        letterSpacing="wide"
                        position="relative"
                      >
                        Pronunciation Score
                      </Text>
                    </Box>
                  )}

                  {transcript && (
                    <Box
                      p={6}
                      bg="linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 197, 253, 0.1) 100%)"
                      borderRadius="2xl"
                      borderWidth="2px"
                      borderColor="blue.200"
                      boxShadow="0 4px 12px rgba(59, 130, 246, 0.1)"
                    >
                      <HStack mb={3} gap={2}>
                        <Box
                          w={2}
                          h={2}
                          borderRadius="full"
                          bg="blue.500"
                          animation="blink 2s infinite"
                          css={{
                            '@keyframes blink': {
                              '0%, 100%': { opacity: 1 },
                              '50%': { opacity: 0.3 },
                            },
                          }}
                        />
                        <Text
                          fontSize="xs"
                          fontWeight="bold"
                          textTransform="uppercase"
                          letterSpacing="wider"
                          color="blue.700"
                        >
                          What you said
                        </Text>
                      </HStack>
                      <Text fontSize="xl" fontWeight="semibold" color={{ base: 'gray.900', _dark: 'white' }} lineHeight="tall" mb={3}>
                        "{transcript}"
                      </Text>
                      {recordedAudioUrl && (
                        <Button
                          onClick={playRecording}
                          size="sm"
                          borderRadius="lg"
                          bg={{ base: 'blue.100', _dark: 'blue.900' }}
                          color={{ base: 'blue.700', _dark: 'blue.100' }}
                          fontWeight="semibold"
                          fontSize="xs"
                          px={4}
                          py={2}
                          _hover={{
                            bg: { base: 'blue.200', _dark: 'blue.800' },
                            transform: 'translateY(-1px)',
                          }}
                          transition="all 0.2s"
                          disabled={isPlayingRecording}
                        >
                          {isPlayingRecording ? '▶️ Playing...' : '▶️ Hear Your Recording'}
                        </Button>
                      )}
                    </Box>
                  )}

                  {feedback.length > 0 && (
                    <Box>
                      <HStack mb={5} gap={2}>
                        <Box w={1} h={6} bg="purple.500" borderRadius="full" />
                        <Text
                          fontSize="sm"
                          fontWeight="bold"
                          textTransform="uppercase"
                          letterSpacing="wider"
                          color="gray.700"
                        >
                          Feedback & Tips
                        </Text>
                      </HStack>
                      <VStack align="stretch" gap={3}>
                        {feedback.map((tip, index) => (
                          <Box
                            key={index}
                            p={6}
                            bg={{ base: 'white', _dark: 'gray.700' }}
                            borderRadius="2xl"
                            borderWidth="2px"
                            borderColor={{ base: 'gray.100', _dark: 'gray.600' }}
                            transition="all 0.3s"
                            _hover={{
                              bg: { base: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(196, 181, 253, 0.05) 100%)', _dark: 'gray.600' },
                              borderColor: 'purple.200',
                              transform: 'translateX(4px)',
                              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.1)',
                            }}
                            position="relative"
                            boxShadow="0 2px 8px rgba(0, 0, 0, 0.04)"
                          >
                            <HStack align="start" gap={3}>
                              <Box
                                mt={1}
                                w={6}
                                h={6}
                                borderRadius="full"
                                bg="purple.100"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                flexShrink={0}
                              >
                                <Text fontSize="xs" fontWeight="bold" color="purple.700">
                                  {index + 1}
                                </Text>
                              </Box>
                              <Text
                                fontSize="md"
                                lineHeight="tall"
                                color={{ base: 'gray.800', _dark: 'gray.100' }}
                                fontWeight="medium"
                              >
                                {filterIpaFromFeedback(tip)}
                              </Text>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              ) : (
                <Box
                  minH="300px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={{ base: 'gray.50', _dark: 'gray.700' }}
                  borderRadius="xl"
                >
                  <VStack gap={4}>
                    <Text fontSize="5xl" opacity={0.3}>🎯</Text>
                    <Text
                      color="gray.500"
                      textAlign="center"
                      fontSize="md"
                      maxW="300px"
                    >
                      Record your pronunciation to receive detailed feedback
                    </Text>
                  </VStack>
                </Box>
              )}
            </Card.Body>
          </Card.Root>

          {/* Practice Stats */}
          {practiceHistory.length > 0 && (
            <Card.Root
              bg={{ base: 'white', _dark: 'gray.800' }}
              borderRadius="3xl"
              boxShadow="0 20px 60px -10px rgba(0, 0, 0, 0.15)"
              border="1px solid"
              borderColor={{ base: 'gray.100', _dark: 'gray.700' }}
            >
              <Card.Body p={{ base: 6, md: 10 }}>
                <HStack mb={8} gap={3}>
                  <Box
                    w={1.5}
                    h={8}
                    bg="linear-gradient(to bottom, #667eea, #764ba2)"
                    borderRadius="full"
                  />
                  <Heading
                    as="h2"
                    fontSize={{ base: 'xl', md: '3xl' }}
                    fontWeight="black"
                    color={{ base: 'gray.900', _dark: 'white' }}
                    letterSpacing="tight"
                  >
                    Practice Stats
                  </Heading>
                </HStack>

                <VStack align="stretch" gap={6}>
                  {/* Summary Stats */}
                  <HStack gap={{ base: 3, md: 4 }} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                    <Box
                      flex={1}
                      minW={{ base: 'calc(50% - 6px)', md: 'auto' }}
                      p={{ base: 5, md: 6 }}
                      bg="linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 197, 253, 0.12) 100%)"
                      borderRadius="2xl"
                      textAlign="center"
                      borderWidth="2px"
                      borderColor="blue.200"
                      boxShadow="0 4px 12px rgba(59, 130, 246, 0.1)"
                      transition="all 0.3s"
                      _hover={{
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <Text fontSize={{ base: '3xl', md: '4xl' }} fontWeight="black" color="blue.600" mb={1}>
                        {practiceHistory.length}
                      </Text>
                      <Text fontSize="xs" color="blue.700" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
                        Total Attempts
                      </Text>
                    </Box>
                    <Box
                      flex={1}
                      minW={{ base: 'calc(50% - 6px)', md: 'auto' }}
                      p={{ base: 5, md: 6 }}
                      bg="linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(134, 239, 172, 0.12) 100%)"
                      borderRadius="2xl"
                      textAlign="center"
                      borderWidth="2px"
                      borderColor="green.200"
                      boxShadow="0 4px 12px rgba(34, 197, 94, 0.1)"
                      transition="all 0.3s"
                      _hover={{
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 20px rgba(34, 197, 94, 0.2)',
                      }}
                    >
                      <Text fontSize={{ base: '3xl', md: '4xl' }} fontWeight="black" color="green.600" mb={1}>
                        {Math.round(
                          practiceHistory.reduce((sum, e) => sum + e.score, 0) /
                            practiceHistory.length
                        )}
                      </Text>
                      <Text fontSize="xs" color="green.700" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
                        Average Score
                      </Text>
                    </Box>
                  </HStack>

                  {/* Recent Attempts */}
                  <Box>
                    <HStack mb={4} gap={2}>
                      <Box w={1} h={5} bg="gray.400" borderRadius="full" />
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        color="gray.600"
                      >
                        Recent Attempts
                      </Text>
                    </HStack>
                    <VStack align="stretch" gap={2}>
                      {practiceHistory.slice(0, 5).map((entry, idx) => (
                        <HStack
                          key={idx}
                          p={5}
                          bg={{ base: 'white', _dark: 'gray.700' }}
                          borderRadius="xl"
                          justifyContent="space-between"
                          borderWidth="2px"
                          borderColor={{ base: 'gray.100', _dark: 'gray.600' }}
                          transition="all 0.2s"
                          _hover={{
                            borderColor: 'purple.200',
                            bg: { base: 'purple.50', _dark: 'gray.600' },
                            transform: 'translateX(4px)',
                          }}
                          boxShadow="0 2px 4px rgba(0, 0, 0, 0.03)"
                        >
                          <Text fontSize="sm" color={{ base: 'gray.800', _dark: 'gray.100' }} flex={1} fontWeight="medium">
                            {entry.phrase}
                          </Text>
                          <Badge
                            colorPalette={getScoreColor(entry.score)}
                            size="lg"
                            borderRadius="full"
                            px={4}
                            py={1}
                            fontWeight="black"
                            fontSize="md"
                            boxShadow="0 2px 8px rgba(0,0,0,0.1)"
                          >
                            {entry.score}
                          </Badge>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                </VStack>
              </Card.Body>
            </Card.Root>
          )}
        </VStack>
      </Container>

      {/* Footer */}
      <Box mt={12} py={8} borderTopWidth="1px" borderColor={{ base: 'gray.200', _dark: 'gray.700' }} bg={{ base: 'white', _dark: 'gray.800' }}>
        <Container maxW="container.lg">
          <VStack gap={3}>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Built with AI-powered speech recognition • Helping you master Portuguese pronunciation
            </Text>
            <HStack gap={2} fontSize="xs" color="gray.500">
              <Text>Press</Text>
              <Badge size="sm" borderRadius="md" px={2} py={0.5} bg="gray.100" color="gray.700" fontWeight="bold">
                Space
              </Badge>
              <Text>to record</Text>
              <Text>•</Text>
              <Badge size="sm" borderRadius="md" px={2} py={0.5} bg="gray.100" color="gray.700" fontWeight="bold">
                Enter
              </Badge>
              <Text>for next phrase</Text>
            </HStack>
          </VStack>
        </Container>
      </Box>
      </Box>
    </>
  );
}
