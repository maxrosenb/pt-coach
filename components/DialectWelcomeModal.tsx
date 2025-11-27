import { Box, Button, VStack, Text, Heading, HStack } from '@chakra-ui/react';
import { FlagIcon } from './FlagIcon';

interface DialectWelcomeModalProps {
  onSelectDialect: (dialect: 'pt-BR' | 'pt-PT') => void;
}

export function DialectWelcomeModal({ onSelectDialect }: DialectWelcomeModalProps) {
  return (
    <Box
      position="fixed"
      inset={0}
      bg="blackAlpha.600"
      backdropFilter="blur(8px)"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        bg={{ base: 'white', _dark: 'gray.800' }}
        borderRadius="3xl"
        maxW="600px"
        w="full"
        p={{ base: 8, md: 12 }}
        boxShadow="0 30px 80px -10px rgba(0, 0, 0, 0.3)"
        border="1px solid"
        borderColor={{ base: 'gray.100', _dark: 'gray.700' }}
      >
        <VStack gap={6}>
          {/* Header */}
          <Box textAlign="center">
            <HStack gap={4} mb={4} justifyContent="center">
              <FlagIcon country="BR" size="4rem" />
              <FlagIcon country="PT" size="4rem" />
            </HStack>
            <Heading
              as="h2"
              fontSize={{ base: '2xl', md: '4xl' }}
              fontWeight="black"
              color={{ base: 'gray.900', _dark: 'white' }}
              mb={3}
              letterSpacing="tight"
            >
              Welcome to Portuguese Coach!
            </Heading>
            <Text
              fontSize={{ base: 'md', md: 'lg' }}
              color={{ base: 'gray.600', _dark: 'gray.300' }}
              lineHeight="tall"
            >
              Choose which Portuguese dialect you'd like to practice
            </Text>
          </Box>

          {/* Dialect Options */}
          <VStack gap={4} w="full">
            <Button
              onClick={() => onSelectDialect('pt-BR')}
              size="2xl"
              w="full"
              borderRadius="2xl"
              bg="linear-gradient(135deg, #009c3b 0%, #00a859 100%)"
              color="white"
              py={8}
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              boxShadow="0 8px 24px rgba(0, 156, 59, 0.35)"
              _hover={{
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 32px rgba(0, 156, 59, 0.45)',
              }}
              _active={{ transform: 'translateY(-1px)' }}
              transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              <VStack gap={1}>
                <HStack gap={2}>
                  <FlagIcon country="BR" size="2rem" />
                  <Text>Brazilian Portuguese</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="normal" opacity={0.9}>
                  Português Brasileiro
                </Text>
              </VStack>
            </Button>

            <Button
              onClick={() => onSelectDialect('pt-PT')}
              size="2xl"
              w="full"
              borderRadius="2xl"
              bg="linear-gradient(135deg, #006600 0%, #009900 100%)"
              color="white"
              py={8}
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              boxShadow="0 8px 24px rgba(0, 102, 0, 0.35)"
              _hover={{
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 32px rgba(0, 102, 0, 0.45)',
              }}
              _active={{ transform: 'translateY(-1px)' }}
              transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              <VStack gap={1}>
                <HStack gap={2}>
                  <FlagIcon country="PT" size="2rem" />
                  <Text>European Portuguese</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="normal" opacity={0.9}>
                  Português Europeu
                </Text>
              </VStack>
            </Button>
          </VStack>

          <Text
            fontSize="xs"
            color={{ base: 'gray.500', _dark: 'gray.400' }}
            textAlign="center"
            mt={2}
          >
            You can change this later in settings
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
