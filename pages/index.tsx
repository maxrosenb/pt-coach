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

interface Phrase {
  id: string;
  portuguese: string;
  english: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PracticeEntry {
  phraseId: string;
  phrase: string;
  score: number;
  timestamp: number;
}

const PHRASES: Phrase[] = [
  { id: '1', portuguese: 'Bom dia, como você está hoje?', english: 'Good morning, how are you today?', category: 'Greetings', difficulty: 'easy' },
  { id: '2', portuguese: 'Eu gostaria de um café, por favor.', english: 'I would like a coffee, please.', category: 'Food & Dining', difficulty: 'easy' },
  { id: '3', portuguese: 'Onde fica a estação de trem mais próxima?', english: 'Where is the nearest train station?', category: 'Travel', difficulty: 'medium' },
  { id: '4', portuguese: 'Quanto custa este livro aqui?', english: 'How much does this book cost?', category: 'Shopping', difficulty: 'easy' },
  { id: '5', portuguese: 'Você pode me ajudar, por favor?', english: 'Can you help me, please?', category: 'General', difficulty: 'easy' },
  { id: '6', portuguese: 'Eu não entendo o que você disse.', english: "I don't understand what you said.", category: 'General', difficulty: 'medium' },
  { id: '7', portuguese: 'Onde posso comprar um bilhete de ônibus?', english: 'Where can I buy a bus ticket?', category: 'Travel', difficulty: 'medium' },
  { id: '8', portuguese: 'Qual é o seu nome completo?', english: 'What is your full name?', category: 'Introductions', difficulty: 'easy' },
  { id: '9', portuguese: 'Eu estou aprendendo português há três meses.', english: 'I have been learning Portuguese for three months.', category: 'Personal', difficulty: 'hard' },
  { id: '10', portuguese: 'A comida aqui está muito deliciosa.', english: 'The food here is very delicious.', category: 'Food & Dining', difficulty: 'easy' },
  { id: '11', portuguese: 'Preciso de um médico urgentemente.', english: 'I need a doctor urgently.', category: 'Emergency', difficulty: 'medium' },
  { id: '12', portuguese: 'Que horas são agora?', english: 'What time is it now?', category: 'General', difficulty: 'easy' },
  { id: '13', portuguese: 'Eu moro em um apartamento pequeno.', english: 'I live in a small apartment.', category: 'Personal', difficulty: 'medium' },
  { id: '14', portuguese: 'Você tem alguma sugestão de restaurante?', english: 'Do you have any restaurant suggestions?', category: 'Food & Dining', difficulty: 'medium' },
  { id: '15', portuguese: 'O tempo está muito bonito hoje.', english: 'The weather is very nice today.', category: 'Small Talk', difficulty: 'easy' },
  { id: '16', portuguese: 'Eu trabalho como professor de inglês.', english: 'I work as an English teacher.', category: 'Personal', difficulty: 'medium' },
  { id: '17', portuguese: 'Poderia falar mais devagar, por favor?', english: 'Could you speak more slowly, please?', category: 'General', difficulty: 'hard' },
  { id: '18', portuguese: 'Eu gosto muito de música brasileira.', english: 'I really like Brazilian music.', category: 'Hobbies', difficulty: 'medium' },
  { id: '19', portuguese: 'Onde você nasceu e cresceu?', english: 'Where were you born and raised?', category: 'Introductions', difficulty: 'medium' },
  { id: '20', portuguese: 'Eu preciso ir ao banco agora.', english: 'I need to go to the bank now.', category: 'Daily Life', difficulty: 'easy' },
  { id: '21', portuguese: 'Você já visitou o Brasil antes?', english: 'Have you visited Brazil before?', category: 'Travel', difficulty: 'medium' },
  { id: '22', portuguese: 'Minha família mora em Portugal.', english: 'My family lives in Portugal.', category: 'Personal', difficulty: 'easy' },
  { id: '23', portuguese: 'Eu adoro tomar café da manhã.', english: 'I love having breakfast.', category: 'Food & Dining', difficulty: 'medium' },
  { id: '24', portuguese: 'Qual é o melhor caminho para o centro?', english: 'What is the best way to downtown?', category: 'Travel', difficulty: 'medium' },
  { id: '25', portuguese: 'Eu vou viajar na próxima semana.', english: 'I am going to travel next week.', category: 'Travel', difficulty: 'easy' },
  { id: '26', portuguese: 'Você tem irmãos ou irmãs?', english: 'Do you have brothers or sisters?', category: 'Introductions', difficulty: 'easy' },
  { id: '27', portuguese: 'Eu acordo todos os dias às sete.', english: 'I wake up every day at seven.', category: 'Daily Life', difficulty: 'medium' },
  { id: '28', portuguese: 'Esta cidade é muito bonita e limpa.', english: 'This city is very beautiful and clean.', category: 'Small Talk', difficulty: 'medium' },
  { id: '29', portuguese: 'Eu prefiro chá em vez de café.', english: 'I prefer tea instead of coffee.', category: 'Food & Dining', difficulty: 'medium' },
  { id: '30', portuguese: 'Vamos jantar juntos hoje à noite?', english: "Let's have dinner together tonight?", category: 'Social', difficulty: 'medium' },
  { id: '31', portuguese: 'Eu estou com muita fome agora.', english: 'I am very hungry now.', category: 'Food & Dining', difficulty: 'easy' },
  { id: '32', portuguese: 'Onde você aprendeu a falar português?', english: 'Where did you learn to speak Portuguese?', category: 'Introductions', difficulty: 'hard' },
  { id: '33', portuguese: 'Eu tenho uma reunião importante amanhã.', english: 'I have an important meeting tomorrow.', category: 'Work', difficulty: 'medium' },
  { id: '34', portuguese: 'Você pode recomendar um bom hotel?', english: 'Can you recommend a good hotel?', category: 'Travel', difficulty: 'medium' },
  { id: '35', portuguese: 'Eu gosto de caminhar no parque.', english: 'I like to walk in the park.', category: 'Hobbies', difficulty: 'easy' },
  { id: '36', portuguese: 'O supermercado fecha às nove da noite.', english: 'The supermarket closes at nine at night.', category: 'Daily Life', difficulty: 'hard' },
  { id: '37', portuguese: 'Eu não sei como chegar lá.', english: "I don't know how to get there.", category: 'Travel', difficulty: 'medium' },
  { id: '38', portuguese: 'Você gostaria de sair comigo hoje?', english: 'Would you like to go out with me today?', category: 'Social', difficulty: 'medium' },
  { id: '39', portuguese: 'Eu tenho dois filhos e uma filha.', english: 'I have two sons and one daughter.', category: 'Personal', difficulty: 'medium' },
  { id: '40', portuguese: 'A biblioteca fica perto da universidade.', english: 'The library is near the university.', category: 'Directions', difficulty: 'medium' },
  { id: '41', portuguese: 'Eu sempre leio antes de dormir.', english: 'I always read before sleeping.', category: 'Daily Life', difficulty: 'medium' },
  { id: '42', portuguese: 'Você conhece algum lugar para dançar?', english: 'Do you know any place to dance?', category: 'Social', difficulty: 'medium' },
  { id: '43', portuguese: 'Eu preciso comprar frutas e vegetais.', english: 'I need to buy fruits and vegetables.', category: 'Shopping', difficulty: 'medium' },
  { id: '44', portuguese: 'O ônibus vai passar em dez minutos.', english: 'The bus will pass in ten minutes.', category: 'Travel', difficulty: 'hard' },
  { id: '45', portuguese: 'Eu quero aprender a cozinhar bem.', english: 'I want to learn to cook well.', category: 'Hobbies', difficulty: 'medium' },
  { id: '46', portuguese: 'Meu telefone está sem bateria agora.', english: 'My phone is out of battery now.', category: 'Daily Life', difficulty: 'medium' },
  { id: '47', portuguese: 'Você se sente bem hoje?', english: 'Do you feel well today?', category: 'General', difficulty: 'medium' },
  { id: '48', portuguese: 'Eu vou à academia três vezes por semana.', english: 'I go to the gym three times a week.', category: 'Hobbies', difficulty: 'hard' },
  { id: '49', portuguese: 'Podemos nos encontrar na praça central?', english: 'Can we meet at the central square?', category: 'Social', difficulty: 'hard' },
  { id: '50', portuguese: 'Eu sempre sonho em viajar pelo mundo.', english: 'I always dream of traveling the world.', category: 'Personal', difficulty: 'hard' },
];

export default function Home() {
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    };

    const newHistory = [entry, ...practiceHistory].slice(0, 50); // Keep last 50
    setPracticeHistory(newHistory);
    localStorage.setItem('practiceHistory', JSON.stringify(newHistory));
  };

  const getRandomPhrase = () => {
    let newPhrase: Phrase;
    do {
      const randomIndex = Math.floor(Math.random() * PHRASES.length);
      newPhrase = PHRASES[randomIndex];
    } while (currentPhrase && newPhrase.id === currentPhrase.id && PHRASES.length > 1);

    setCurrentPhrase(newPhrase);
    setFeedback([]);
    setScore(null);
    setTranscript('');
    setError('');
  };

  // Set initial random phrase on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * PHRASES.length);
    setCurrentPhrase(PHRASES[randomIndex]);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioForFeedback(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
      setFeedback([]);
      setScore(null);
      setTranscript('');
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
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioForFeedback = async (audioBlob: Blob) => {
    if (!currentPhrase) return;

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('phraseId', currentPhrase.id);

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
                    Portuguese Coach
                  </Heading>
                </Box>
                <Text
                  color="whiteAlpha.900"
                  fontSize={{ base: 'sm', md: 'md' }}
                  fontWeight="medium"
                  textShadow="0 1px 2px rgba(0,0,0,0.1)"
                >
                  Master your pronunciation with AI-powered feedback
                </Text>
              </VStack>
            </Box>
            <Box flex={1} display="flex" justifyContent="flex-end">
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
                      {isPlayingAudio ? '🔊 Playing...' : '🔊 Hear Pronunciation'}
                    </Button>
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
                      <Text fontSize="xl" fontWeight="semibold" color={{ base: 'gray.900', _dark: 'white' }} lineHeight="tall">
                        "{transcript}"
                      </Text>
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
                                {tip}
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
  );
}
