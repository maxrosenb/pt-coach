import { Box, Button, VStack, Text, Heading, HStack } from '@chakra-ui/react';
import { FlagIcon } from './FlagIcon';
import { az, SERIF } from '../lib/azulejo';

interface DialectWelcomeModalProps {
  onSelectDialect: (dialect: 'pt-BR' | 'pt-PT') => void;
}

function DialectOption({
  country,
  name,
  nativeName,
  onClick,
}: {
  country: 'BR' | 'PT';
  name: string;
  nativeName: string;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      w="full"
      h="auto"
      py={6}
      px={6}
      borderRadius="lg"
      bg={az.cardBg}
      borderWidth="1.5px"
      borderColor={az.cardLine}
      boxShadow="0 4px 16px -8px rgba(23, 42, 80, 0.2)"
      _hover={{
        borderColor: az.cobalt,
        bg: az.cobaltWash,
        transform: 'translateY(-2px)',
        boxShadow: '0 10px 24px -10px rgba(29, 78, 155, 0.35)',
      }}
      _active={{ transform: 'translateY(0)' }}
      transition="all 0.25s"
    >
      <HStack gap={4} w="full" justify="flex-start">
        <FlagIcon country={country} size="2.25rem" />
        <Box textAlign="left">
          <Text fontFamily={SERIF} fontSize="lg" fontWeight={600} color={az.ink}>
            {name}
          </Text>
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="0.14em"
            color={az.inkSoft}
          >
            {nativeName}
          </Text>
        </Box>
        <Box flex={1} />
        <Text color={az.gold} fontSize="sm">❖</Text>
      </HStack>
    </Button>
  );
}

export function DialectWelcomeModal({ onSelectDialect }: DialectWelcomeModalProps) {
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
      role="dialog"
      aria-modal="true"
      aria-label="Choose your Portuguese dialect"
    >
      <Box
        bg={az.cardBg}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={az.cardLine}
        maxW="540px"
        w="full"
        overflow="hidden"
        boxShadow="0 30px 80px -10px rgba(7, 14, 30, 0.5)"
      >
        {/* Heritage double rule */}
        <Box h="5px" bg="#CD9A2B" />
        <Box h="2px" bg="#1D4E9B" />

        <Box p={{ base: 8, md: 10 }}>
          <VStack gap={7}>
            <Box textAlign="center">
              <HStack gap={3} justify="center" mb={3}>
                <Text color={az.gold} fontSize="xs">◆</Text>
                <Text color={az.cobalt} fontSize="sm">❖</Text>
                <Heading
                  as="h2"
                  fontFamily={SERIF}
                  fontWeight={600}
                  fontSize={{ base: '2xl', md: '3xl' }}
                  color={az.ink}
                >
                  Bem-vindo ao Fala Bem
                </Heading>
                <Text color={az.cobalt} fontSize="sm">❖</Text>
                <Text color={az.gold} fontSize="xs">◆</Text>
              </HStack>
              <Text fontSize="md" color={az.inkSoft} lineHeight="tall">
                Welcome! Choose the Portuguese you want to practice — you can
                switch any time in settings.
              </Text>
            </Box>

            <VStack gap={3} w="full">
              <DialectOption
                country="BR"
                name="Brazilian Portuguese"
                nativeName="Português Brasileiro"
                onClick={() => onSelectDialect('pt-BR')}
              />
              <DialectOption
                country="PT"
                name="European Portuguese"
                nativeName="Português Europeu"
                onClick={() => onSelectDialect('pt-PT')}
              />
            </VStack>
          </VStack>
        </Box>
      </Box>
    </Box>
  );
}
