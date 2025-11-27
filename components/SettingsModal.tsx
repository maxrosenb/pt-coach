import { Box, Button, VStack, Text, Heading, HStack } from '@chakra-ui/react';
import { FlagIcon } from './FlagIcon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDialect: 'pt-BR' | 'pt-PT';
  onDialectChange: (dialect: 'pt-BR' | 'pt-PT') => void;
  showIpaDetails: boolean;
  onIpaDetailsChange: (show: boolean) => void;
}

export function SettingsModal({ isOpen, onClose, currentDialect, onDialectChange, showIpaDetails, onIpaDetailsChange }: SettingsModalProps) {
  if (!isOpen) return null;

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
      onClick={onClose}
    >
      <Box
        bg={{ base: 'white', _dark: 'gray.800' }}
        borderRadius="3xl"
        maxW="550px"
        w="full"
        p={{ base: 8, md: 10 }}
        boxShadow="0 30px 80px -10px rgba(0, 0, 0, 0.3)"
        border="1px solid"
        borderColor={{ base: 'gray.100', _dark: 'gray.700' }}
        onClick={(e) => e.stopPropagation()}
      >
        <VStack gap={6} align="stretch">
          {/* Header */}
          <HStack justifyContent="space-between" mb={2}>
            <Heading
              as="h2"
              fontSize={{ base: 'xl', md: '2xl' }}
              fontWeight="black"
              color={{ base: 'gray.900', _dark: 'white' }}
              letterSpacing="tight"
            >
              ⚙️ Settings
            </Heading>
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
              borderRadius="full"
              fontSize="xl"
              color={{ base: 'gray.600', _dark: 'gray.400' }}
              _hover={{ bg: { base: 'gray.100', _dark: 'gray.700' } }}
            >
              ✕
            </Button>
          </HStack>

          {/* Dialect Selection */}
          <Box>
            <Text
              fontSize="sm"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="wider"
              color={{ base: 'gray.600', _dark: 'gray.400' }}
              mb={3}
            >
              Portuguese Dialect
            </Text>

            <VStack gap={3}>
              <Button
                onClick={() => onDialectChange('pt-BR')}
                w="full"
                size="lg"
                borderRadius="xl"
                bg={currentDialect === 'pt-BR' ? 'linear-gradient(135deg, #009c3b 0%, #00a859 100%)' : { base: 'white', _dark: 'gray.700' }}
                color={currentDialect === 'pt-BR' ? 'white' : { base: 'gray.800', _dark: 'gray.100' }}
                borderWidth="2px"
                borderColor={currentDialect === 'pt-BR' ? 'green.500' : { base: 'gray.200', _dark: 'gray.600' }}
                py={6}
                fontSize="md"
                fontWeight="bold"
                boxShadow={currentDialect === 'pt-BR' ? '0 4px 16px rgba(0, 156, 59, 0.25)' : 'none'}
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: currentDialect === 'pt-BR'
                    ? '0 6px 20px rgba(0, 156, 59, 0.35)'
                    : '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
                transition="all 0.2s"
              >
                <HStack gap={3} justifyContent="space-between" w="full">
                  <HStack gap={2}>
                    <FlagIcon country="BR" size="1.75rem" />
                    <Box textAlign="left">
                      <Text>Brazilian Portuguese</Text>
                      <Text fontSize="xs" fontWeight="normal" opacity={0.8}>
                        Português Brasileiro
                      </Text>
                    </Box>
                  </HStack>
                  {currentDialect === 'pt-BR' && (
                    <Text fontSize="xl">✓</Text>
                  )}
                </HStack>
              </Button>

              <Button
                onClick={() => onDialectChange('pt-PT')}
                w="full"
                size="lg"
                borderRadius="xl"
                bg={currentDialect === 'pt-PT' ? 'linear-gradient(135deg, #006600 0%, #009900 100%)' : { base: 'white', _dark: 'gray.700' }}
                color={currentDialect === 'pt-PT' ? 'white' : { base: 'gray.800', _dark: 'gray.100' }}
                borderWidth="2px"
                borderColor={currentDialect === 'pt-PT' ? 'green.600' : { base: 'gray.200', _dark: 'gray.600' }}
                py={6}
                fontSize="md"
                fontWeight="bold"
                boxShadow={currentDialect === 'pt-PT' ? '0 4px 16px rgba(0, 102, 0, 0.25)' : 'none'}
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: currentDialect === 'pt-PT'
                    ? '0 6px 20px rgba(0, 102, 0, 0.35)'
                    : '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
                transition="all 0.2s"
              >
                <HStack gap={3} justifyContent="space-between" w="full">
                  <HStack gap={2}>
                    <FlagIcon country="PT" size="1.75rem" />
                    <Box textAlign="left">
                      <Text>European Portuguese</Text>
                      <Text fontSize="xs" fontWeight="normal" opacity={0.8}>
                        Português Europeu
                      </Text>
                    </Box>
                  </HStack>
                  {currentDialect === 'pt-PT' && (
                    <Text fontSize="xl">✓</Text>
                  )}
                </HStack>
              </Button>
            </VStack>

            <Text
              fontSize="xs"
              color={{ base: 'gray.500', _dark: 'gray.400' }}
              mt={4}
              p={3}
              bg={{ base: 'blue.50', _dark: 'blue.900/20' }}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={{ base: 'blue.200', _dark: 'blue.800' }}
            >
              💡 Changing your dialect will give you a new phrase and clear your current feedback.
            </Text>
          </Box>

          {/* IPA Details Toggle */}
          <Box>
            <Text
              fontSize="sm"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="wider"
              color={{ base: 'gray.600', _dark: 'gray.400' }}
              mb={3}
            >
              Feedback Display
            </Text>

            <Button
              onClick={() => onIpaDetailsChange(!showIpaDetails)}
              w="full"
              size="lg"
              borderRadius="xl"
              bg={{ base: 'white', _dark: 'gray.700' }}
              color={{ base: 'gray.800', _dark: 'gray.100' }}
              borderWidth="2px"
              borderColor={showIpaDetails ? 'purple.400' : { base: 'gray.200', _dark: 'gray.600' }}
              py={6}
              fontSize="md"
              fontWeight="bold"
              boxShadow={showIpaDetails ? '0 4px 16px rgba(139, 92, 246, 0.25)' : 'none'}
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: showIpaDetails
                  ? '0 6px 20px rgba(139, 92, 246, 0.35)'
                  : '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
              transition="all 0.2s"
            >
              <HStack gap={3} justifyContent="space-between" w="full">
                <HStack gap={2}>
                  <Text fontSize="2xl">🔤</Text>
                  <Box textAlign="left">
                    <Text>Show IPA Details</Text>
                    <Text fontSize="xs" fontWeight="normal" opacity={0.8}>
                      Display phonetic notation in feedback
                    </Text>
                  </Box>
                </HStack>
                <Box
                  w="50px"
                  h="28px"
                  bg={showIpaDetails ? 'purple.500' : { base: 'gray.300', _dark: 'gray.600' }}
                  borderRadius="full"
                  position="relative"
                  transition="all 0.2s"
                >
                  <Box
                    w="24px"
                    h="24px"
                    bg="white"
                    borderRadius="full"
                    position="absolute"
                    top="2px"
                    left={showIpaDetails ? "24px" : "2px"}
                    transition="all 0.2s"
                    boxShadow="0 2px 4px rgba(0,0,0,0.2)"
                  />
                </Box>
              </HStack>
            </Button>

            <Text
              fontSize="xs"
              color={{ base: 'gray.500', _dark: 'gray.400' }}
              mt={4}
              p={3}
              bg={{ base: 'purple.50', _dark: 'purple.900/20' }}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={{ base: 'purple.200', _dark: 'purple.800' }}
            >
              📚 When enabled, feedback will include IPA (International Phonetic Alphabet) symbols. Turn off for simpler, beginner-friendly feedback.
            </Text>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
