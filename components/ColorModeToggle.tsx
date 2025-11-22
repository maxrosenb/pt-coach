import { Button } from '@chakra-ui/react';
import { useState, useEffect } from 'react';

export function ColorModeToggle() {
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check for saved preference or system preference
    const savedMode = localStorage.getItem('chakra-ui-color-mode') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialMode = savedMode || (systemPrefersDark ? 'dark' : 'light');

    setColorMode(initialMode);
    document.documentElement.setAttribute('data-theme', initialMode);
    document.documentElement.classList.toggle('dark', initialMode === 'dark');
  }, []);

  const toggleColorMode = () => {
    const newMode = colorMode === 'light' ? 'dark' : 'light';
    setColorMode(newMode);
    localStorage.setItem('chakra-ui-color-mode', newMode);
    document.documentElement.setAttribute('data-theme', newMode);
    document.documentElement.classList.toggle('dark', newMode === 'dark');
  };

  return (
    <Button
      onClick={toggleColorMode}
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
      {colorMode === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
    </Button>
  );
}
