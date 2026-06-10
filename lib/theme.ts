import { createSystem, defaultConfig } from '@chakra-ui/react';

export const system = createSystem(defaultConfig, {
  globalCss: {
    body: {
      backgroundColor: { base: '#F6F0E1', _dark: '#0D1830' },
      color: { base: '#1E3157', _dark: '#EFE7D2' },
      fontFamily: 'var(--font-karla), -apple-system, "Segoe UI", sans-serif',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: 'var(--font-fraunces), Georgia, "Times New Roman", serif' },
        body: { value: 'var(--font-karla), -apple-system, "Segoe UI", sans-serif' },
      },
    },
  },
});
