import { Button } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { az } from '../lib/azulejo';

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
      size="sm"
      borderRadius="full"
      bg="transparent"
      borderWidth="1px"
      borderColor={az.cobaltLine}
      color={az.inkSoft}
      _hover={{ bg: az.cobaltWash, color: az.cobalt }}
      px={3}
      aria-label="Toggle color mode"
    >
      {colorMode === 'light' ? '☾' : '☀'}
    </Button>
  );
}
