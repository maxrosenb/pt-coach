import { useEffect } from 'react';
import { Box, Button, VStack, Text, Heading, HStack } from '@chakra-ui/react';
import { FlagIcon } from './FlagIcon';
import { az, SERIF } from '../lib/azulejo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDialect: 'pt-BR' | 'pt-PT';
  onDialectChange: (dialect: 'pt-BR' | 'pt-PT') => void;
  showIpaDetails: boolean;
  onIpaDetailsChange: (show: boolean) => void;
}

function SettingsLabel({ pt, en }: { pt: string; en: string }) {
  return (
    <HStack gap={2} mb={3}>
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

function DialectButton({
  country,
  name,
  nativeName,
  selected,
  onClick,
}: {
  country: 'BR' | 'PT';
  name: string;
  nativeName: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      w="full"
      h="auto"
      py={4}
      px={5}
      borderRadius="lg"
      bg={selected ? az.cobaltWash : 'transparent'}
      borderWidth="1.5px"
      borderColor={selected ? az.cobalt : az.cardLine}
      _hover={{
        borderColor: az.cobalt,
        bg: az.cobaltWash,
        transform: 'translateY(-1px)',
      }}
      _active={{ transform: 'translateY(0)' }}
      transition="all 0.2s"
    >
      <HStack gap={3} w="full" justify="flex-start">
        <FlagIcon country={country} size="1.6rem" />
        <Box textAlign="left">
          <Text fontSize="sm" fontWeight="bold" color={az.ink}>
            {name}
          </Text>
          <Text fontSize="xs" fontWeight="normal" color={az.inkSoft}>
            {nativeName}
          </Text>
        </Box>
        <Box flex={1} />
        {selected && <Text color={az.cobalt} fontSize="sm">❖</Text>}
      </HStack>
    </Button>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
  currentDialect,
  onDialectChange,
  showIpaDetails,
  onIpaDetailsChange,
}: SettingsModalProps) {
  // Close on Escape while open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      inset={0}
      bg="rgba(13, 24, 48, 0.65)"
      backdropFilter="blur(8px)"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <Box
        bg={az.cardBg}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={az.cardLine}
        maxW="500px"
        w="full"
        overflow="hidden"
        boxShadow="0 30px 80px -10px rgba(7, 14, 30, 0.5)"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Heritage double rule */}
        <Box h="5px" bg="#CD9A2B" />
        <Box h="2px" bg="#1D4E9B" />

        <Box p={{ base: 7, md: 9 }}>
          <VStack gap={7} align="stretch">
            {/* Header */}
            <HStack justify="space-between">
              <Heading
                as="h2"
                fontFamily={SERIF}
                fontWeight={600}
                fontSize="2xl"
                color={az.ink}
              >
                Definições
              </Heading>
              <Button
                onClick={onClose}
                size="sm"
                borderRadius="full"
                bg="transparent"
                borderWidth="1px"
                borderColor={az.cardLine}
                color={az.inkSoft}
                _hover={{ bg: az.washBg, color: az.ink }}
                aria-label="Close settings"
              >
                ✕
              </Button>
            </HStack>

            {/* Dialect Selection */}
            <Box>
              <SettingsLabel pt="Dialeto" en="Portuguese dialect" />
              <VStack gap={2.5}>
                <DialectButton
                  country="BR"
                  name="Brazilian Portuguese"
                  nativeName="Português Brasileiro"
                  selected={currentDialect === 'pt-BR'}
                  onClick={() => onDialectChange('pt-BR')}
                />
                <DialectButton
                  country="PT"
                  name="European Portuguese"
                  nativeName="Português Europeu"
                  selected={currentDialect === 'pt-PT'}
                  onClick={() => onDialectChange('pt-PT')}
                />
              </VStack>
              <Text fontSize="xs" color={az.inkFaint} mt={3} lineHeight="tall">
                Changing your dialect gives you a new phrase and clears the
                current feedback.
              </Text>
            </Box>

            {/* IPA Details Toggle */}
            <Box>
              <SettingsLabel pt="Notação" en="Feedback display" />
              <Button
                onClick={() => onIpaDetailsChange(!showIpaDetails)}
                w="full"
                h="auto"
                py={4}
                px={5}
                borderRadius="lg"
                bg={showIpaDetails ? az.goldWash : 'transparent'}
                borderWidth="1.5px"
                borderColor={showIpaDetails ? az.goldLine : az.cardLine}
                _hover={{ borderColor: az.gold, transform: 'translateY(-1px)' }}
                _active={{ transform: 'translateY(0)' }}
                transition="all 0.2s"
              >
                <HStack gap={3} w="full" justify="flex-start">
                  <Box textAlign="left">
                    <Text fontSize="sm" fontWeight="bold" color={az.ink}>
                      Show IPA details
                    </Text>
                    <Text fontSize="xs" fontWeight="normal" color={az.inkSoft}>
                      Phonetic notation in phrases and feedback
                    </Text>
                  </Box>
                  <Box flex={1} />
                  <Box
                    w="46px"
                    h="26px"
                    bg={showIpaDetails ? '#CD9A2B' : az.cardLine}
                    borderRadius="full"
                    position="relative"
                    transition="all 0.2s"
                    flexShrink={0}
                  >
                    <Box
                      w="20px"
                      h="20px"
                      bg="#FFFDF6"
                      borderRadius="full"
                      position="absolute"
                      top="3px"
                      left={showIpaDetails ? '23px' : '3px'}
                      transition="all 0.2s"
                      boxShadow="0 2px 4px rgba(0,0,0,0.25)"
                    />
                  </Box>
                </HStack>
              </Button>
              <Text fontSize="xs" color={az.inkFaint} mt={3} lineHeight="tall">
                When enabled, feedback includes IPA (International Phonetic
                Alphabet) symbols. Off is simpler and beginner-friendly.
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>
    </Box>
  );
}
